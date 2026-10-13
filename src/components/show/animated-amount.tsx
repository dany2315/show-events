"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { formatMoney } from "@/lib/money";
import type { AppLocale, CurrencyCode } from "@/lib/constants";

/** Compteur animé (moteur GSAP) : le total « défile » jusqu'à sa nouvelle valeur. */
export function AnimatedAmount({
  value,
  currency,
  locale,
  animate,
  className,
  style,
}: {
  value: number;
  currency: CurrencyCode;
  locale: AppLocale;
  animate: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!animate || current.current === value) {
      current.current = value;
      el.textContent = formatMoney(value, currency, locale);
      return;
    }
    const state = { v: current.current };
    const delta = Math.abs(value - state.v);
    const duration = Math.min(2.6, 0.9 + Math.log10(delta + 1) * 0.32);
    const tween = gsap.to(state, {
      v: value,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = formatMoney(Math.round(state.v), currency, locale);
      },
      onComplete: () => {
        current.current = value;
      },
    });
    return () => {
      tween.kill();
      current.current = Math.round(state.v);
    };
  }, [value, currency, locale, animate]);

  return (
    <span ref={ref} className={className} style={style}>
      {formatMoney(value, currency, locale)}
    </span>
  );
}
