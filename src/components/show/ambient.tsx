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
 * Nombre d'éléments animés par ambiance. Plafond de 20 : le show tourne des heures,
 * y compris sur des machines modestes, et chaque élément animé est une couche du GPU.
 */
export const AMBIENT_ELEMENT_COUNT: Record<AmbientKind, number> = {
  none: 0,
  sparkles: 18,
  stars: 16,
  glints: 10,
  bokeh: 10,
  rays: 6,
  aurora: 3,
  dust: 13,
  sheen: 1,
};

const STAR = "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

type Item = { x: number; y: number; s: number; d: number; t: number };

/**
 * Couche d'ambiance animée en CSS pur, posée sur le décor statique de l'arrière-plan :
 * uniquement des animations de transform / opacity (composées par le GPU), aucun filtre
 * ni masque animé, aucune rotation, 20 éléments animés au plus.
 * `still` : image fixe (vignettes de la bibliothèque), sans aucune animation.
 */
export const Ambient = memo(function Ambient({ kind, enabled, still = false }: { kind: AmbientKind; enabled: boolean; still?: boolean }) {
  const items = useMemo<Item[]>(() => {
    const rand = seeded(kind.length * 9973 + 17);
    return Array.from({ length: 20 }, () => ({ x: rand() * 100, y: rand() * 100, s: rand(), d: rand(), t: rand() }));
  }, [kind]);

  if (!enabled || kind === "none") return null;
  const anim = (value: string) => (still ? undefined : value);
  const count = AMBIENT_ELEMENT_COUNT[kind];
  const wrap = (children: React.ReactNode) => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-ambient={kind}>
      {children}
    </div>
  );

  if (kind === "rays") {
    return wrap(
      <>
        {/* Rayons statiques : un seul dégradé, sans rotation ni masque. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 70% at 30% 0%, color-mix(in oklab, var(--show-glow) 12%, transparent), transparent 70%), repeating-conic-gradient(from 200deg at 30% -10%, color-mix(in oklab, var(--show-glow) 7%, transparent) 0deg 5deg, transparent 5deg 16deg)",
            opacity: 0.9,
          }}
        />
        {items.slice(0, count).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: 180 + it.s * 220,
              height: 180 + it.s * 220,
              background: "radial-gradient(circle, color-mix(in oklab, var(--show-glow2) 20%, transparent), transparent 70%)",
              animation: anim(`show-drift ${18 + it.d * 18}s ease-in-out ${-it.t * 20}s infinite`),
              ["--dx" as string]: `${(it.d - 0.5) * 120}px`,
              ["--dy" as string]: `${(it.s - 0.5) * 90}px`,
            }}
          />
        ))}
      </>,
    );
  }

  if (kind === "bokeh") {
    return wrap(
      items.slice(0, count).map((it, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${it.x}%`,
            top: `${20 + it.y * 0.8}%`,
            width: 80 + it.s * 200,
            height: 80 + it.s * 200,
            background:
              i % 3 === 0
                ? "radial-gradient(circle, color-mix(in oklab, var(--show-glow2) 26%, transparent), transparent 65%)"
                : "radial-gradient(circle, color-mix(in oklab, var(--show-glow) 22%, transparent), transparent 65%)",
            animation: anim(`show-drift ${16 + it.d * 20}s ease-in-out ${-it.t * 30}s infinite`),
            ["--dx" as string]: `${(it.d - 0.5) * 160}px`,
            ["--dy" as string]: `${(it.s - 0.5) * 120}px`,
          }}
        />
      )),
    );
  }

  if (kind === "aurora") {
    // Trois grands voiles lumineux qui glissent lentement (translation + opacité seulement).
    const veils = [
      { left: "-10%", top: "4%", w: 1100, h: 420, color: "var(--show-glow)", dur: 38, delay: 0, dx: 220 },
      { left: "45%", top: "10%", w: 1000, h: 380, color: "var(--show-glow2)", dur: 46, delay: -18, dx: -200 },
      { left: "15%", top: "26%", w: 1300, h: 300, color: "var(--show-glow)", dur: 54, delay: -30, dx: 160 },
    ];
    return wrap(
      veils.map((v, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: v.left,
            top: v.top,
            width: v.w,
            height: v.h,
            background: `radial-gradient(closest-side, color-mix(in oklab, ${v.color} 30%, transparent), transparent)`,
            opacity: 0.7,
            animation: anim(`show-veil ${v.dur}s ease-in-out ${v.delay}s infinite`),
            ["--dx" as string]: `${v.dx}px`,
          }}
        />
      )),
    );
  }

  if (kind === "dust") {
    // Projecteur qui « respire » et poussières de lumière qui montent dans le faisceau.
    return wrap(
      <>
        <span
          className="absolute"
          style={{
            left: "26%",
            top: "-6%",
            width: "48%",
            height: "100%",
            background: "radial-gradient(50% 60% at 50% 30%, color-mix(in oklab, var(--show-glow) 14%, transparent), transparent 72%)",
            animation: anim("show-breathe 9s ease-in-out infinite"),
          }}
        />
        {items.slice(0, count - 1).map((it, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${30 + it.x * 0.4}%`,
              bottom: `${4 + it.s * 50}%`,
              width: 4 + it.d * 6,
              height: 4 + it.d * 6,
              background: "radial-gradient(circle, var(--show-glow2) 0%, var(--show-glow) 45%, transparent 72%)",
              opacity: still ? 0.25 + it.s * 0.4 : undefined,
              animation: anim(`show-float ${12 + it.s * 10}s linear ${-it.t * 20}s infinite`),
              ["--dx" as string]: `${(it.d - 0.5) * 120}px`,
              ["--o" as string]: String(0.25 + it.s * 0.45),
            }}
          />
        ))}
      </>,
    );
  }

  if (kind === "sheen") {
    // Un seul reflet diagonal qui traverse l'écran de temps en temps.
    if (still) return null;
    return wrap(
      <span
        className="absolute"
        style={{
          top: "-20%",
          left: 0,
          width: "28%",
          height: "140%",
          background: "linear-gradient(100deg, transparent 0%, color-mix(in oklab, var(--show-glow) 55%, transparent) 50%, transparent 100%)",
          animation: "show-sweep 16s ease-in-out infinite",
        }}
      />,
    );
  }

  if (kind === "stars" || kind === "glints") {
    const glint = kind === "glints";
    return wrap(
      items.slice(0, count).map((it, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${it.x}%`,
            top: `${glint ? it.y : it.y * 0.75}%`,
            width: glint ? 14 + it.s * 18 : 8 + it.s * 14,
            height: glint ? 14 + it.s * 18 : 8 + it.s * 14,
            clipPath: STAR,
            background: i % 4 === 0 ? "var(--show-glow2)" : "var(--show-glow)",
            opacity: still ? 0.35 + it.s * 0.5 : undefined,
            animation: anim(`show-twinkle ${(glint ? 3.4 : 2.6) + it.d * 3.6}s ease-in-out ${-it.t * 6}s infinite`),
          }}
        />
      )),
    );
  }

  // sparkles : paillettes qui scintillent + quelques particules qui montent.
  return wrap(
    <>
      {items.slice(0, 12).map((it, i) => (
        <span
          key={`t${i}`}
          className="absolute rounded-full"
          style={{
            left: `${it.x}%`,
            top: `${it.y}%`,
            width: 5 + it.s * 7,
            height: 5 + it.s * 7,
            background: "radial-gradient(circle, var(--show-glow2) 0%, var(--show-glow) 45%, transparent 72%)",
            opacity: still ? 0.35 + it.s * 0.5 : undefined,
            animation: anim(`show-twinkle ${2.6 + it.d * 3.6}s ease-in-out ${-it.t * 6}s infinite`),
          }}
        />
      ))}
      {!still &&
        items.slice(12, count).map((it, i) => (
          <span
            key={`f${i}`}
            className="absolute rounded-full"
            style={{
              left: `${it.x}%`,
              bottom: `${-4 + it.s * 10}%`,
              width: 6 + it.d * 8,
              height: 6 + it.d * 8,
              background: "radial-gradient(circle, var(--show-glow2) 0%, var(--show-glow) 40%, transparent 70%)",
              animation: `show-float ${10 + it.s * 10}s linear ${-it.t * 18}s infinite`,
              ["--dx" as string]: `${(it.d - 0.5) * 140}px`,
              ["--o" as string]: String(0.35 + it.s * 0.5),
            }}
          />
        ))}
    </>,
  );
});
