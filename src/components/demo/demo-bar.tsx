"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import QRCode from "qrcode";
import { ExternalLink, Loader2, MonitorPlay, QrCode, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { restartDemoAction } from "@/app/actions/demo";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type DemoLinks = { formUrl: string; displayUrl: string } | null;

/** QR code du formulaire de promesse (généré dans le navigateur). */
export function DemoQr({ url, className }: { url: string; className?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M" })
      .then((value) => alive && setQr(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-2xl bg-white p-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt="QR code" className="size-full" data-demo-qr /> : <QrCode className="size-8 text-ink/30" />}
    </div>
  );
}

/** Bandeau discret « Démo » de la console : écran, formulaire par QR code, nouvel espace. */
export function DemoBar({ links }: { links: DemoLinks }) {
  const { t } = useI18n();
  return (
    <div className="relative z-40 border-b border-gold/20 bg-ink text-white" data-demo-bar>
      <div className="mx-auto flex min-h-10 max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2 py-0.5 font-semibold text-ink">
          <Sparkles className="size-3" />
          {t.demo.badge}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-white/60 md:inline">{t.demo.bar}</span>
        <span className="flex-1 md:hidden" />
        {links && (
          <>
            <Button asChild size="xs" variant="ghost" className="h-7 text-white/80 hover:bg-white/10 hover:text-white">
              <a href={links.displayUrl} target="_blank" rel="noreferrer" data-demo-open-screen>
                <MonitorPlay className="size-3.5" />
                {t.demo.openScreen}
              </a>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="xs" variant="ghost" className="h-7 text-white/80 hover:bg-white/10 hover:text-white" data-demo-open-form>
                  <Smartphone className="size-3.5" />
                  <span className="hidden sm:inline">{t.demo.openForm}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="font-semibold">{t.demo.qrTitle}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t.demo.qrText}</p>
                <DemoQr url={links.formUrl} className="mx-auto mt-4 size-48 border" />
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <a href={links.formUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    {t.demo.openFormHere}
                  </a>
                </Button>
              </PopoverContent>
            </Popover>
          </>
        )}
        <RestartDemoButton />
      </div>
    </div>
  );
}

export function RestartDemoButton({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="xs" variant="ghost" className={cn("h-7 text-gold hover:bg-white/10 hover:text-gold", className)} data-demo-restart>
          <RotateCcw className="size-3.5" />
          {t.demo.restart}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.demo.restartTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.demo.restartText}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={restartDemoAction}>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t.common.cancel}</AlertDialogCancel>
            <RestartSubmit />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RestartSubmit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} data-demo-restart-confirm>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      {pending ? t.demo.restarting : t.demo.restartConfirm}
    </Button>
  );
}
