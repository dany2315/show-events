"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className, tone = "default" }: { className?: string; tone?: "default" | "dark" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "fr" ? "he" : "fr";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60",
        tone === "dark"
          ? "border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={t.common.language}
    >
      <Languages className="size-3.5" />
      {next === "he" ? t.common.hebrew : t.common.french}
    </button>
  );
}
