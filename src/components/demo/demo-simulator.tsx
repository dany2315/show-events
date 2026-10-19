"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulateDemoDonationAction } from "@/app/actions/demo";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

/** Nombre de promesses d'une simulation. */
const SIMULATED = 6;

/** Régie de démo : quelques promesses fictives arrivent à quelques secondes d'intervalle. */
export function DemoSimulator({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const stopRef = useRef(false);

  async function run() {
    stopRef.current = false;
    setRunning(true);
    setCount(0);
    let added = 0;
    // Point de départ tiré au sort dans la liste des donateurs fictifs.
    const base = Math.floor(Math.random() * 1000);
    for (let i = 0; i < SIMULATED && !stopRef.current; i++) {
      if (i > 0) await new Promise((resolve) => window.setTimeout(resolve, 1600 + Math.random() * 1800));
      if (stopRef.current) break;
      try {
        const result = await simulateDemoDonationAction(eventId, base + i);
        if (!result.ok) {
          toast.error(result.error === "CLOSED" ? t.regie.statusEnded : t.demo.limitGeneric);
          break;
        }
        added++;
        setCount(added);
      } catch {
        toast.error(t.common.errorNetwork);
        break;
      }
    }
    setRunning(false);
    if (added > 0) toast.success(fmt(t.demo.simulateDone, { count: added }));
  }

  return (
    <div className="rounded-3xl border border-gold/30 bg-gold/[0.06] p-5" data-demo-simulator>
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-gold" />
        {t.demo.simulateTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.demo.simulateText}</p>
      <div className="mt-4 flex items-center gap-3">
        {running ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              stopRef.current = true;
            }}
          >
            <Square className="size-3.5" />
            {t.demo.simulateStop}
          </Button>
        ) : (
          <Button type="button" className="rounded-full bg-gold font-semibold text-ink hover:bg-[#e3b45c]" onClick={run} disabled={disabled} data-demo-simulate>
            <Wand2 className="size-4" />
            {t.demo.simulateStart}
          </Button>
        )}
        {running && (
          <span className="flex items-center gap-2 text-sm tabular text-muted-foreground" data-demo-simulate-progress>
            <Loader2 className="size-3.5 animate-spin" />
            {fmt(t.demo.simulateProgress, { count, max: SIMULATED })}
          </span>
        )}
      </div>
    </div>
  );
}
