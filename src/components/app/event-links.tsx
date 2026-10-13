"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, MonitorPlay, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { rotateAccessAction } from "@/app/actions/events";
import { useI18n } from "@/i18n/client";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(t.common.copied);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {t.common.copy}
    </Button>
  );
}

export function EventLinks({ eventId, eventName, formUrl, displayUrl, canManage }: { eventId: string; eventName: string; formUrl: string; displayUrl: string; canManage: boolean }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(formUrl, { width: 1024, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(null));
  }, [formUrl]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex gap-5 rounded-3xl border bg-card p-6">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="QR code" className="size-full" /> : <QrCode className="size-8 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t.eventDetail.formLink}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.eventDetail.formLinkHelp}</p>
          <code className="mt-3 block truncate rounded-lg bg-muted px-2.5 py-1.5 text-xs" dir="ltr">
            {formUrl}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={formUrl} />
            {qr && (
              <Button asChild variant="outline" size="sm">
                <a href={qr} download={`qr-${eventName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`}>
                  <Download className="size-3.5" />
                  {t.eventDetail.downloadQr}
                </a>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <a href={formUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                {t.common.open}
              </a>
            </Button>
            {canManage && <RegenerateButton eventId={eventId} type="DONATION_FORM" />}
          </div>
        </div>
      </div>

      <div className="flex gap-5 rounded-3xl border bg-card p-6">
        <div className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-ink text-gold">
          <MonitorPlay className="size-10" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t.eventDetail.screenLink}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.eventDetail.screenLinkHelp}</p>
          <code className="mt-3 block truncate rounded-lg bg-muted px-2.5 py-1.5 text-xs" dir="ltr">
            {displayUrl}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={displayUrl} />
            <Button asChild size="sm">
              <a href={displayUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                {t.common.open}
              </a>
            </Button>
            {canManage && <RegenerateButton eventId={eventId} type="DISPLAY" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegenerateButton({ eventId, type }: { eventId: string; type: "DONATION_FORM" | "DISPLAY" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
          <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
          {t.eventDetail.regenerate}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.eventDetail.regenerate}</AlertDialogTitle>
          <AlertDialogDescription>{t.eventDetail.regenerateConfirm}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const res = await rotateAccessAction(eventId, type);
                if (res.ok) {
                  toast.success(t.eventDetail.regenerated);
                  router.refresh();
                } else toast.error(t.common.errorGeneric);
              })
            }
          >
            {t.common.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
