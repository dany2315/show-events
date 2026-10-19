"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDemoAction } from "@/app/actions/demo";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Bouton « Essayer la démo » : prépare (ou reprend) l'espace de démo du visiteur en un clic. */
export function DemoStartButton({ label, size = "lg", className }: { label?: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <form action={startDemoAction} className="contents">
      <SubmitButton label={label} size={size} className={className} />
    </form>
  );
}

function SubmitButton({ label, size, className }: { label?: string; size: "sm" | "lg"; className?: string }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      data-demo-start
      className={cn(
        "rounded-full bg-gold font-semibold text-ink hover:bg-[#e3b45c] disabled:opacity-90",
        size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4",
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? t.demo.starting : (label ?? t.demo.tryDemo)}
      {!pending && size === "lg" ? <ArrowRight className="size-4 rtl:rotate-180" /> : null}
    </Button>
  );
}
