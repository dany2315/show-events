"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { donations as seedDonations, events, layouts, organizations, team } from "@/lib/seed";
import type { Donation, DonationStatus, FundraisingEvent, ShowBlockId, ShowLayout } from "@/lib/types";

const STORAGE_KEY = "show-events-mvp-state";
const CHANNEL = "show-events-mvp";

type AppState = {
  organizations: typeof organizations;
  events: FundraisingEvent[];
  donations: Donation[];
  layouts: ShowLayout[];
  team: typeof team;
};

const initialState: AppState = {
  organizations,
  events,
  donations: seedDonations,
  layouts,
  team,
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function readState(): AppState {
  if (typeof window === "undefined") return initialState;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialState;

  try {
    return JSON.parse(stored) as AppState;
  } catch {
    return initialState;
  }
}

function writeState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDemoState() {
  if (typeof window === "undefined") return;
  writeState(initialState);
  window.dispatchEvent(new Event("show-events-state"));
}

export function useShowStore() {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    const timer = window.setTimeout(() => setState(readState()), 0);
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
    const sync = () => setState(readState());

    channel?.addEventListener("message", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("show-events-state", sync);

    return () => {
      window.clearTimeout(timer);
      channel?.removeEventListener("message", sync);
      channel?.close();
      window.removeEventListener("storage", sync);
      window.removeEventListener("show-events-state", sync);
    };
  }, []);

  const commit = useCallback((next: AppState) => {
    setState(next);
    writeState(next);
    window.dispatchEvent(new Event("show-events-state"));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage({ type: "sync" });
      channel.close();
    }
  }, []);

  const addDonation = useCallback(
    (donation: Omit<Donation, "id" | "createdAt" | "status"> & { status?: DonationStatus }) => {
      const nextDonation: Donation = {
        ...donation,
        id: createId("don"),
        createdAt: new Date().toISOString(),
        status: donation.status ?? "approved",
      };

      const next = { ...readState(), donations: [nextDonation, ...readState().donations] };
      commit(next);
      return nextDonation;
    },
    [commit],
  );

  const updateDonationStatus = useCallback(
    (id: string, status: DonationStatus) => {
      const current = readState();
      commit({
        ...current,
        donations: current.donations.map((donation) =>
          donation.id === id ? { ...donation, status } : donation,
        ),
      });
    },
    [commit],
  );

  const updateEvent = useCallback(
    (eventId: string, patch: Partial<FundraisingEvent>) => {
      const current = readState();
      commit({
        ...current,
        events: current.events.map((event) =>
          event.id === eventId ? { ...event, ...patch } : event,
        ),
      });
    },
    [commit],
  );

  const updateLayout = useCallback(
    (eventId: string, patch: Partial<ShowLayout>) => {
      const current = readState();
      commit({
        ...current,
        layouts: current.layouts.map((layout) =>
          layout.eventId === eventId ? { ...layout, ...patch } : layout,
        ),
      });
    },
    [commit],
  );

  const toggleBlock = useCallback(
    (eventId: string, blockId: ShowBlockId) => {
      const current = readState();
      commit({
        ...current,
        layouts: current.layouts.map((layout) =>
          layout.eventId === eventId
            ? {
                ...layout,
                blocks: layout.blocks.map((block) =>
                  block.id === blockId ? { ...block, visible: !block.visible } : block,
                ),
              }
            : layout,
        ),
      });
    },
    [commit],
  );

  const totalsByEvent = useMemo(() => {
    return state.events.reduce<Record<string, number>>((acc, event) => {
      acc[event.id] = state.donations
        .filter((donation) => donation.eventId === event.id)
        .filter((donation) =>
          event.totalIncludesPending
            ? donation.status !== "rejected" && donation.status !== "cancelled"
            : donation.status === "approved" || donation.status === "paid",
        )
        .reduce((sum, donation) => sum + donation.amount, 0);
      return acc;
    }, {});
  }, [state.donations, state.events]);

  return {
    ...state,
    totalsByEvent,
    addDonation,
    updateDonationStatus,
    updateEvent,
    updateLayout,
    toggleBlock,
    reset: () => commit(initialState),
  };
}

export function getPublicEventUrl(slug: string) {
  if (typeof window === "undefined") return `/donate/${slug}`;
  return `${window.location.origin}/donate/${slug}`;
}

export function getShowUrl(eventId: string) {
  if (typeof window === "undefined") return `/show/${eventId}`;
  return `${window.location.origin}/show/${eventId}`;
}
