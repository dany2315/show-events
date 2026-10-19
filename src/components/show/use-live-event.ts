"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { LiveEventInfo, LiveEventsResponse, LiveMessage, LiveSnapshot } from "@/lib/live/types";
import { applyCategoryDelta } from "@/lib/categories";
import type { ShowEffect } from "./stage";

export type LiveSource = { kind: "screen"; token: string } | { kind: "event"; eventId: string };
export type ConnectionStatus = "connecting" | "live" | "polling" | "offline";

type State = LiveSnapshot & { effect: ShowEffect | null; effectSeq: number };

type Action =
  | { type: "snapshot"; snapshot: LiveSnapshot }
  | { type: "messages"; messages: LiveMessage[]; withEffects: boolean };

const MAX_DONATIONS = 30;

function withCategoryDelta(event: LiveEventInfo, categoryId: string | null | undefined, amount: number, count: number): LiveEventInfo {
  if (!event.categories || !categoryId) return event;
  const categories = applyCategoryDelta(event.categories, categoryId, amount, count);
  return categories === event.categories ? event : { ...event, categories };
}

function reducer(state: State, action: Action): State {
  if (action.type === "snapshot") {
    return { ...action.snapshot, effect: state.effect, effectSeq: state.effectSeq };
  }
  let next = state;
  for (const msg of action.messages) {
    if (msg.seq <= next.seq) continue;
    switch (msg.type) {
      case "donation.created": {
        const exists = next.donations.some((d) => d.id === msg.donation.id);
        const effectSeq = next.effectSeq + 1;
        next = {
          ...next,
          seq: msg.seq,
          total: msg.total,
          count: msg.count,
          event: exists ? next.event : withCategoryDelta(next.event, msg.donation.categoryId, msg.donation.amount, 1),
          donations: exists ? next.donations : [msg.donation, ...next.donations].slice(0, MAX_DONATIONS),
          ...(action.withEffects && !exists
            ? { effect: { id: effectSeq, kind: "donation" as const, donation: msg.donation }, effectSeq }
            : {}),
        };
        break;
      }
      case "donation.updated": {
        // Totaux par catégorie : on retire l'ancienne part de la promesse, puis on ajoute la nouvelle.
        let event = next.event;
        if (msg.previous) {
          event = withCategoryDelta(event, msg.previous.categoryId, -msg.previous.amount, -1);
          event = withCategoryDelta(event, msg.donation.categoryId, msg.donation.amount, 1);
        }
        next = {
          ...next,
          seq: msg.seq,
          total: msg.total,
          count: msg.count,
          event,
          donations: next.donations.map((d) => (d.id === msg.donation.id ? msg.donation : d)),
        };
        break;
      }
      case "donation.deleted":
        next = {
          ...next,
          seq: msg.seq,
          total: msg.total,
          count: msg.count,
          event: msg.removed ? withCategoryDelta(next.event, msg.removed.categoryId, -msg.removed.amount, -1) : next.event,
          donations: next.donations.filter((d) => d.id !== msg.donationId),
        };
        break;
      case "control": {
        const effectSeq = next.effectSeq + 1;
        next = {
          ...next,
          seq: msg.seq,
          control: msg.control,
          ...(action.withEffects && msg.command
            ? { effect: { id: effectSeq, kind: msg.command === "goal" ? ("goal" as const) : ("celebrate" as const) }, effectSeq }
            : {}),
        };
        break;
      }
      default:
        next = { ...next, seq: msg.seq };
    }
  }
  return next;
}

/**
 * Live State Engine : maintient l'état du direct à partir de l'outbox serveur.
 *  - Ably (WebSocket) si configuré, sinon synchronisation HTTP rapide.
 *  - Ne dépend jamais uniquement du WebSocket : un filet HTTP comble les trous
 *    et l'état complet est rechargé à la reconnexion.
 */
export function useLiveEvent(source: LiveSource, initial: LiveSnapshot) {
  const [state, dispatch] = useReducer(reducer, { ...initial, effect: null, effectSeq: 0 });
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const seqRef = useRef(initial.seq);
  const ablyConnected = useRef(false);
  const inflight = useRef(false);
  const failures = useRef(0);

  useEffect(() => {
    seqRef.current = state.seq;
  }, [state.seq]);

  const endpoint = source.kind === "screen" ? `/api/live/screen/${source.token}` : `/api/live/event/${source.eventId}`;

  const resync = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const snapshot = (await res.json()) as LiveSnapshot;
    seqRef.current = snapshot.seq;
    dispatch({ type: "snapshot", snapshot });
  }, [endpoint]);

  const pull = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(`${endpoint}?after=${seqRef.current}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as LiveEventsResponse;
      if (data.mode === "resync") {
        seqRef.current = data.snapshot.seq;
        dispatch({ type: "snapshot", snapshot: data.snapshot });
      } else if (data.messages.length > 0) {
        const needsSnapshot = data.messages.some((m) => m.type === "layout.updated" || m.type === "event.updated");
        const fresh = data.messages.filter((m) => m.type !== "donation.created" || Date.now() - Date.parse(m.donation.createdAt) < 60_000);
        dispatch({ type: "messages", messages: data.messages, withEffects: fresh.length > 0 && data.messages.length <= 6 });
        seqRef.current = data.seq;
        if (needsSnapshot) await resync();
      }
      failures.current = 0;
      setStatus(ablyConnected.current ? "live" : "polling");
    } catch {
      failures.current += 1;
      if (failures.current >= 2) setStatus("offline");
    } finally {
      inflight.current = false;
    }
  }, [endpoint, resync]);

  // Ably (optionnel)
  useEffect(() => {
    let cancelled = false;
    let client: import("ably").Realtime | null = null;
    (async () => {
      try {
        const body = source.kind === "screen" ? { displayToken: source.token } : { eventId: source.eventId };
        const probe = await fetch("/api/realtime/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!probe.ok || cancelled) return;
        const first = await probe.json();
        if (!first?.enabled) return;
        const Ably = await import("ably");
        if (cancelled) return;
        client = new Ably.Realtime({
          authCallback: async (_params, callback) => {
            try {
              const r = await fetch("/api/realtime/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
              const data = await r.json();
              callback(null, data.tokenRequest);
            } catch (error) {
              callback(String(error), null);
            }
          },
          closeOnUnload: true,
        });
        client.connection.on((change) => {
          ablyConnected.current = change.current === "connected";
          if (change.current === "connected") {
            setStatus("live");
            void pull();
          }
        });
        const channel = client.channels.get(first.channel as string);
        await channel.subscribe((message) => {
          const msg = message.data as LiveMessage;
          if (!msg || typeof msg.seq !== "number") return;
          if (msg.seq === seqRef.current + 1) {
            if (msg.type === "layout.updated" || msg.type === "event.updated") {
              void pull();
              return;
            }
            seqRef.current = msg.seq;
            dispatch({ type: "messages", messages: [msg], withEffects: true });
          } else if (msg.seq > seqRef.current + 1) {
            void pull(); // trou dans la séquence : on complète via HTTP
          }
        });
      } catch (error) {
        console.warn("[live] Ably indisponible, synchronisation HTTP", error);
      }
    })();
    return () => {
      cancelled = true;
      ablyConnected.current = false;
      client?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Synchronisation HTTP : rapide sans Ably, filet de sécurité avec Ably.
  useEffect(() => {
    let timer: number;
    const loop = async () => {
      await pull();
      const base = ablyConnected.current ? 12_000 : 1_500;
      const backoff = failures.current > 0 ? Math.min(10_000, 1_500 * 2 ** failures.current) : base;
      timer = window.setTimeout(loop, backoff);
    };
    timer = window.setTimeout(loop, 300);
    const onOnline = () => void resync().catch(() => undefined);
    const onVisible = () => document.visibilityState === "visible" && void pull();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pull, resync]);

  // Resynchronisation complète périodique (garantie du total).
  useEffect(() => {
    const id = window.setInterval(() => void resync().catch(() => undefined), 120_000);
    return () => window.clearInterval(id);
  }, [resync]);

  return { state, status, resync };
}

/** Exporté pour les tests unitaires. */
export { reducer as liveReducer };
