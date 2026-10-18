"use client";

import { useState } from "react";
import type { ThemeId } from "@/lib/show/config";
import { BACKGROUND_LIST, getBackground } from "@/lib/show/themes";
import { BackdropThumb } from "@/components/show/backdrop";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { HeroDemo } from "./hero-demo";

/** Galerie de la bibliothèque d'arrière-plans : aperçu vivant + vignettes de chaque décor. */
export function ThemeGallery() {
  const { locale } = useI18n();
  const [theme, setTheme] = useState<ThemeId>("velours");
  const active = getBackground(theme);

  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
        <div className="aspect-video">
          <HeroDemo key={theme} theme={theme} interval={2800} className="size-full" />
        </div>
      </div>
      <div className="-mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-xl text-white sm:text-2xl">{active.label[locale]}</span>
        <span className="text-sm text-white/60">{active.tagline[locale]}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {BACKGROUND_LIST.map((def) => {
          const selected = def.id === theme;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setTheme(def.id)}
              aria-pressed={selected}
              title={def.tagline[locale]}
              className={cn(
                "group overflow-hidden rounded-2xl border text-start transition-all",
                selected ? "border-gold/70 ring-2 ring-gold/30" : "border-white/10 hover:border-white/30",
              )}
            >
              <BackdropThumb theme={def.id} locale={locale} className="transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className={cn("block truncate px-3 py-2 text-sm font-medium", selected ? "bg-white/[0.08] text-white" : "text-white/75")}>
                {def.label[locale]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
