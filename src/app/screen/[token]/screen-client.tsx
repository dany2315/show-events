"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, WifiOff } from "lucide-react";
import { ShowStage } from "@/components/show/stage";
import { ShowViewport } from "@/components/show/viewport";
import { useLowPower } from "@/components/show/use-low-power";
import { useLiveEvent } from "@/components/show/use-live-event";
import { useScreenFormat } from "@/components/show/use-screen-format";
import { dictionaries } from "@/i18n/dictionaries";
import type { LiveSnapshot } from "@/lib/live/types";
import { stageSize } from "@/lib/show/config";
import type { FormatId } from "@/lib/show/formats";
import { cn } from "@/lib/utils";

export function ScreenClient({ token, snapshot, forcedFormat = null }: { token: string; snapshot: LiveSnapshot; forcedFormat?: FormatId | null }) {
  const { state, status } = useLiveEvent({ kind: "screen", token }, snapshot);
  const lowPower = useLowPower();
  // Format le plus proche de la fenêtre (ou imposé par ?format=) : la scène reste montée.
  const format = useScreenFormat(forcedFormat);
  const t = dictionaries[state.event.locale].show;
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef<number | null>(null);

  // Curseur et commandes masqués après quelques secondes d'inactivité.
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  // Empêche la mise en veille de l'ordinateur relié à l'écran.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {
        // non supporté : sans conséquence
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // refusé par le navigateur
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  useEffect(() => {
    document.title = `${state.event.name} · Live`;
  }, [state.event.name]);

  return (
    <div className={cn("fixed inset-0 overflow-hidden bg-black", idle && "cursor-none")} onDoubleClick={toggleFullscreen}>
      <ShowViewport className="size-full" stage={stageSize(format)}>
        <ShowStage
          config={state.layout}
          event={state.event}
          total={state.total}
          donations={state.donations}
          control={state.control}
          formUrl={state.formUrl}
          effect={state.effect}
          lowPower={lowPower}
          format={format}
        />
      </ShowViewport>

      {(state.event.status === "TEST" || state.event.status === "DRAFT") && (
        <div
          className={cn(
            "pointer-events-none absolute start-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold tracking-[0.2em] shadow-lg",
            state.event.status === "TEST" ? "bg-amber-400 text-black" : "bg-white/80 text-black",
          )}
        >
          {state.event.status === "TEST" ? t.testBadge : t.draftBadge}
        </div>
      )}

      {status === "offline" && (
        <div className="absolute bottom-4 start-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
          <WifiOff className="size-3.5 text-red-400" />
          {t.offline}
        </div>
      )}

      <button
        type="button"
        onClick={toggleFullscreen}
        className={cn(
          "absolute end-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur transition-opacity duration-500",
          idle ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        {fullscreen ? t.exitFullscreen : t.fullscreen}
      </button>
    </div>
  );
}
