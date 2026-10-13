"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </div>
      <h1 className="mt-6 font-display text-3xl">{t.errors.errorTitle}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t.errors.errorText}</p>
      <Button onClick={reset} className="mt-8 rounded-full">
        {t.errors.retry}
      </Button>
    </div>
  );
}
