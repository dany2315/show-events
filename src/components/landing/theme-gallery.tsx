"use client";

import { useState } from "react";
import { THEME_IDS, type ThemeId } from "@/lib/show/config";
import { THEMES } from "@/lib/show/themes";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { HeroDemo } from "./hero-demo";

export function ThemeGallery() {
  const { locale } = useI18n();
  const [theme, setTheme] = useState<ThemeId>("feerie");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
        <div className="aspect-video">
          <HeroDemo key={theme} theme={theme} interval={2800} className="size-full" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {THEME_IDS.map((id) => {
          const def = THEMES[id];
          const active = id === theme;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                "group flex items-center gap-4 rounded-2xl border p-3 text-start transition-all",
                active ? "border-gold/60 bg-white/[0.07]" : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]",
              )}
            >
              <span
                className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-white/10"
                style={{ background: `radial-gradient(circle at 30% 20%, ${def.vars.bg2}, ${def.vars.bg} 70%)` }}
              >
                <span className="absolute inset-x-2 bottom-2 h-1.5 rounded-full" style={{ background: def.vars.accent }} />
              </span>
              <span className="min-w-0">
                <span className={cn("block font-medium", active ? "text-white" : "text-white/80")}>{def.label[locale]}</span>
                <span className="block truncate text-xs text-white/50">{def.tagline[locale]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
