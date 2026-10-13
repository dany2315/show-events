"use client";

import { memo, useMemo } from "react";
import type { AmbientKind } from "@/lib/show/themes";

/** Générateur pseudo-aléatoire déterministe (rendu identique serveur / client). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Couche d'ambiance animée en CSS pur (léger pour tourner des heures sur l'écran géant). */
export const Ambient = memo(function Ambient({ kind, enabled }: { kind: AmbientKind; enabled: boolean }) {
  const items = useMemo(() => {
    const rand = seeded(kind.length * 9973 + 17);
    return Array.from({ length: 70 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      s: rand(),
      d: rand(),
      t: rand(),
    }));
  }, [kind]);

  if (!enabled || kind === "none") return null;

  if (kind === "rays") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute"
          style={{
            left: "-30%",
            top: "-80%",
            width: "160%",
            height: "220%",
            background:
              "repeating-conic-gradient(from 0deg at 50% 50%, color-mix(in oklab, var(--show-accent) 9%, transparent) 0deg 6deg, transparent 6deg 18deg)",
            animation: "show-rays 140s linear infinite",
            maskImage: "radial-gradient(closest-side, black 20%, transparent 80%)",
          }}
        />
        {items.slice(0, 18).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: 140 + it.s * 260,
              height: 140 + it.s * 260,
              background: "radial-gradient(circle, color-mix(in oklab, var(--show-accent2) 22%, transparent), transparent 70%)",
              animation: `show-drift ${16 + it.d * 18}s ease-in-out ${-it.t * 20}s infinite`,
              ["--dx" as string]: `${(it.d - 0.5) * 120}px`,
              ["--dy" as string]: `${(it.s - 0.5) * 90}px`,
            }}
          />
        ))}
      </div>
    );
  }

  if (kind === "bokeh") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {items.slice(0, 26).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: 40 + it.s * 220,
              height: 40 + it.s * 220,
              background:
                i % 3 === 0
                  ? "radial-gradient(circle, color-mix(in oklab, var(--show-accent2) 30%, transparent), transparent 68%)"
                  : "radial-gradient(circle, color-mix(in oklab, var(--show-accent) 26%, transparent), transparent 68%)",
              filter: `blur(${2 + it.d * 8}px)`,
              animation: `show-drift ${14 + it.d * 20}s ease-in-out ${-it.t * 30}s infinite`,
              ["--dx" as string]: `${(it.d - 0.5) * 160}px`,
              ["--dy" as string]: `${(it.s - 0.5) * 120}px`,
            }}
          />
        ))}
      </div>
    );
  }

  // sparkles (gala) & stars (féerie)
  const star = kind === "stars";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((it, i) => (
        <span
          key={`t${i}`}
          className="absolute"
          style={{
            left: `${it.x}%`,
            top: `${it.y}%`,
            width: star ? 6 + it.s * 12 : 2 + it.s * 4,
            height: star ? 6 + it.s * 12 : 2 + it.s * 4,
            borderRadius: star ? 0 : 9999,
            clipPath: star
              ? "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)"
              : undefined,
            background: i % 4 === 0 ? "var(--show-accent2)" : "var(--show-accent)",
            boxShadow: star ? undefined : "0 0 10px var(--show-accent)",
            animation: `show-twinkle ${2.4 + it.d * 3.6}s ease-in-out ${-it.t * 6}s infinite`,
          }}
        />
      ))}
      {items.slice(0, 28).map((it, i) => (
        <span
          key={`f${i}`}
          className="absolute rounded-full"
          style={{
            left: `${it.x}%`,
            bottom: `${-4 + it.s * 10}%`,
            width: 3 + it.d * 5,
            height: 3 + it.d * 5,
            background: "var(--show-accent2)",
            boxShadow: "0 0 14px var(--show-accent)",
            animation: `show-float ${9 + it.s * 10}s linear ${-it.t * 18}s infinite`,
            ["--dx" as string]: `${(it.d - 0.5) * 140}px`,
            ["--o" as string]: String(0.35 + it.s * 0.5),
          }}
        />
      ))}
    </div>
  );
});
