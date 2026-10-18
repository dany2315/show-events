"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { STAGE_HEIGHT, STAGE_WIDTH, type ThemeId } from "@/lib/show/config";
import { backgroundScene, getBackground, themeCssVars } from "@/lib/show/themes";
import { formatMoney } from "@/lib/money";
import { dictionaries } from "@/i18n/dictionaries";
import type { AppLocale } from "@/lib/constants";
import { Ambient } from "./ambient";

/** Faux QR code des vignettes (motifs de repérage + modules pseudo-aléatoires fixes). */
const QR_PATH = (() => {
  let d = "";
  for (const [x, y] of [[0, 0], [14, 0], [0, 14]]) d += `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  let s = 7;
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
      s = (s * 1103515245 + 12345) % 2147483648;
      if (s % 5 < 2) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
})();

/** Décor statique de l'arrière-plan (peint une seule fois, jamais animé). */
export const Backdrop = memo(function Backdrop({ theme }: { theme: ThemeId }) {
  return (
    <div
      aria-hidden
      data-backdrop={getBackground(theme).id}
      className="pointer-events-none absolute inset-0"
      style={{ background: backgroundScene(theme) }}
    />
  );
});

/**
 * Vignette fidèle d'un arrière-plan : le vrai décor et une image fixe de son ambiance,
 * avec des éléments d'exemple (total, objectif, dons, QR code), dessinés sur la surface
 * 1920 × 1080 puis réduits à la taille de la vignette.
 */
export const BackdropThumb = memo(function BackdropThumb({ theme, locale, className }: { theme: ThemeId; locale: AppLocale; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const def = getBackground(theme);
  const vars = themeCssVars({ theme: def.id, colors: {} });
  const scale = width / STAGE_WIDTH;
  const names = dictionaries[locale].landing.demoDonors.slice(0, 4);
  const amounts = [5000, 1800, 2500, 1000];
  const currency = locale === "he" ? "ILS" : "EUR";

  return (
    <span ref={ref} aria-hidden className={`relative block aspect-video overflow-hidden ${className ?? ""}`} style={{ background: def.vars.bg }}>
      {width > 0 && (
        <span
          dir={locale === "he" ? "rtl" : "ltr"}
          className="show-root show-lowpower absolute start-0 top-0 block"
          style={{
            ...(vars as React.CSSProperties),
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: locale === "he" ? "100% 0" : "0 0",
          }}
        >
          <Backdrop theme={def.id} />
          <Ambient kind={def.ambient} enabled still />
          {/* Total */}
          <span className="absolute block text-center" style={{ insetInlineStart: "37%", top: "9%", width: "44.5%" }}>
            <span className="block font-semibold uppercase" style={{ fontSize: 30, letterSpacing: "0.24em", color: "var(--show-muted)" }}>
              {dictionaries[locale].show.totalLabel}
            </span>
            <span className="show-accent-text tabular mt-3 inline-block font-extrabold leading-none" style={{ fontSize: 170 }}>
              {formatMoney(locale === "he" ? 512_000 : 128_450, currency, locale)}
            </span>
          </span>
          {/* Objectif */}
          <span className="absolute block overflow-hidden rounded-full" style={{ insetInlineStart: "37%", top: "36%", width: "44.5%", height: 34, background: "var(--show-track)" }}>
            <span className="show-bar-fill absolute inset-y-0 start-0 block rounded-full" style={{ width: "64%" }} />
          </span>
          {/* Titre */}
          <span className="show-display absolute block font-semibold" style={{ insetInlineStart: "3.2%", top: "34%", width: "30%", fontSize: 92, lineHeight: 1.05 }}>
            {def.label[locale]}
          </span>
          {/* Liste des dons */}
          <span className="show-panel absolute block rounded-[28px]" style={{ insetInlineStart: "37%", top: "46.5%", width: "59.8%", height: "48%", padding: "36px 44px" }}>
            {names.map((name, i) => (
              <span key={name} className="flex items-center justify-between" style={{ height: 96, borderTop: i ? "1px solid var(--show-panel-border)" : undefined, fontSize: 46 }}>
                <span className="truncate font-semibold">{name}</span>
                <span className="tabular font-bold" style={{ color: "var(--show-accent)" }}>
                  {formatMoney(amounts[i] * (locale === "he" ? 4 : 1), currency, locale)}
                </span>
              </span>
            ))}
          </span>
          {/* QR code */}
          <span className="absolute block rounded-[24px]" style={{ insetInlineStart: "85.5%", top: "7%", width: 210, height: 210, padding: 18, background: "var(--show-qr-card)" }}>
            <svg viewBox="0 0 21 21" className="block size-full" shapeRendering="crispEdges">
              <path d={QR_PATH} fill="#111" />
            </svg>
          </span>
        </span>
      )}
    </span>
  );
});
