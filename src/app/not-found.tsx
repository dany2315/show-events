import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="paper-grain flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Brand />
      <div className="mt-12 flex size-16 items-center justify-center rounded-2xl bg-gold-soft text-gold">
        <Compass className="size-7" />
      </div>
      <h1 className="mt-6 font-display text-4xl">{t.errors.notFoundTitle}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t.errors.notFoundText}</p>
      <Button asChild className="mt-8 rounded-full">
        <Link href="/">{t.errors.home}</Link>
      </Button>
    </div>
  );
}
