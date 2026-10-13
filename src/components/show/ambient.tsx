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

/**
 * Couche d'ambiance animée en CSS pur, volontairement sobre en ressources :
 * uniquement des animations de transform / opacity (composées par le GPU),
 * aucun filtre ni masque animé, peu d'éléments — elle doit tourner des heures
 * sur l'ordinateur de la salle sans faiblir.
 */
export const Ambient = memo(function Ambient({ kind, enabled }: { kind: AmbientKind; enabled: boolean }) {
  const items = useMemo(() => {
    const rand = seeded(kind.length * 9973 + 17);
    return Array.from({ length: 40 }, () => ({ x: rand() * 100, y: rand() * 100, s: rand(), d: rand(), t: rand() }));
  }, [kind]);

  if (!enabled || kind === "none") return null;

  if (kind === "rays") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Rayons statiques : un seul dégradé, sans rotation ni masque. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 70% at 30% 0%, color-mix(in oklab, var(--show-accent) 12%, transparent), transparent 70%), repeating-conic-gradient(from 200deg at 30% -10%, color-mix(in oklab, var(--show-accent) 7%, transparent) 0deg 5deg, transparent 5deg 16deg)",
            opacity: 0.9,
          }}
        />
        {items.slice(0, 8).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: 180 + it.s * 220,
              height: 180 + it.s * 220,
              background: "radial-gradient(circle, color-mix(in oklab, var(--show-accent2) 20%, transparent), transparent 70%)",
              animation: `show-drift ${18 + it.d * 18}s ease-in-out ${-it.t * 20}s infinite`,
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
        {items.slice(0, 14).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: 60 + it.s * 220,
              height: 60 + it.s * 220,
              background:
                i % 3 === 0
                  ? "radial-gradient(circle, color-mix(in oklab, var(--show-accent2) 26%, transparent), transparent 65%)"
                  : "radial-gradient(circle, color-mix(in oklab, var(--show-accent) 22%, transparent), transparent 65%)",
              animation: `show-drift ${16 + it.d * 20}s ease-in-out ${-it.t * 30}s infinite`,
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
            width: star ? 8 + it.s * 12 : 4 + it.s * 6,
            height: star ? 8 + it.s * 12 : 4 + it.s * 6,
            borderRadius: star ? 0 : 9999,
            clipPath: star ? "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)" : undefined,
            background: star
              ? i % 4 === 0
                ? "var(--show-accent2)"
                : "var(--show-accent)"
              : "radial-gradient(circle, var(--show-accent2) 0%, var(--show-accent) 45%, transparent 72%)",
            animation: `show-twinkle ${2.6 + it.d * 3.6}s ease-in-out ${-it.t * 6}s infinite`,
          }}
        />
      ))}
      {items.slice(0, 14).map((it, i) => (
        <span
          key={`f${i}`}
          className="absolute rounded-full"
          style={{
            left: `${it.x}%`,
            bottom: `${-4 + it.s * 10}%`,
            width: 6 + it.d * 8,
            height: 6 + it.d * 8,
            background: "radial-gradient(circle, var(--show-accent2) 0%, var(--show-accent) 40%, transparent 70%)",
            animation: `show-float ${10 + it.s * 10}s linear ${-it.t * 18}s infinite`,
            ["--dx" as string]: `${(it.d - 0.5) * 140}px`,
            ["--o" as string]: String(0.35 + it.s * 0.5),
          }}
        />
      ))}
    </div>
  );
});
