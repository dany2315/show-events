"use client";

import { useEffect, useMemo, useState } from "react";
import { ShowStage, type ShowEffect } from "@/components/show/stage";
import { ShowViewport } from "@/components/show/viewport";
import { useLowPower } from "@/components/show/use-low-power";
import { demoConfig, demoDonations, demoEvent } from "@/lib/show/demo";
import type { ThemeId } from "@/lib/show/config";
import type { PublicDonation } from "@/lib/live/types";
import { EMPTY_CONTROL } from "@/lib/live/types";
import { useI18n } from "@/i18n/client";

const BASE_TOTAL = 126_000;

/** Aperçu vivant du show : des promesses arrivent toutes les quelques secondes. */
export function HeroDemo({ theme = "gala", interval = 3600, className }: { theme?: ThemeId; interval?: number; className?: string }) {
  const { locale } = useI18n();
  const lowPower = useLowPower();
  const event = useMemo(() => demoEvent(locale), [locale]);
  const config = useMemo(() => demoConfig(theme, locale), [theme, locale]);
  const pool = useMemo(() => demoDonations(locale), [locale]);
  const [donations, setDonations] = useState<PublicDonation[]>(() => pool.slice(0, 6));
  const [total, setTotal] = useState(locale === "he" ? BASE_TOTAL * 4 : BASE_TOTAL);
  const [effect, setEffect] = useState<ShowEffect | null>(null);

  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      const source = pool[n % pool.length];
      const amount = [500, 1000, 1800, 2500, 5000, 360][n % 6] * (locale === "he" ? 4 : 1);
      const donation: PublicDonation = { id: `live-${n}`, donorName: source.donorName, amount, createdAt: new Date().toISOString() };
      setDonations((list) => [donation, ...list].slice(0, 12));
      setTotal((t) => {
        const goal = event.goalAmount;
        // Boucle douce : on repart à ~60 % quand l'objectif est presque atteint.
        return t + amount > goal * 0.97 ? Math.round(goal * 0.6) : t + amount;
      });
      setEffect({ id: n, kind: "donation", donation });
    }, interval);
    return () => window.clearInterval(id);
  }, [pool, interval, locale, event.goalAmount]);

  return (
    <ShowViewport className={className} background="transparent">
      <ShowStage
        config={config}
        event={event}
        total={total}
        donations={donations}
        control={EMPTY_CONTROL}
        formUrl={null}
        effect={effect}
        lowPower={lowPower}
      />
    </ShowViewport>
  );
}
