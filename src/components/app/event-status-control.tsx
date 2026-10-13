"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, FlaskConical, Loader2, Radio, RotateCcw, Square, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { clearTestDonationsAction, getGoLiveInfoAction, setEventStatusAction } from "@/app/actions/events";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { EventStatusCode } from "@/lib/constants";
import { cn } from "@/lib/utils";

type GoLiveInfo = Awaited<ReturnType<typeof getGoLiveInfoAction>>;

/**
 * Pilotage du cycle de vie : Préparation → Test (gratuit) → Direct (crédit) → Terminé (définitif).
 */
export function EventStatusControl({
  eventId,
  status,
  isSuperAdmin = false,
  size = "default",
  className,
}: {
  eventId: string;
  status: EventStatusCode;
  isSuperAdmin?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"live" | "end" | "clear" | null>(null);
  const [info, setInfo] = useState<GoLiveInfo | null>(null);

  function errorText(code: string) {
    if (code === "TRANSITION") return t.eventDetail.transitionError;
    const key = `blocked_${code}` as keyof typeof t.events;
    if (key in t.events) return t.events[key] as string;
    return code === "ACCESS" ? t.common.notAllowed : t.common.errorGeneric;
  }

  const go = (next: EventStatusCode) =>
    startTransition(async () => {
      const res = await setEventStatusAction(eventId, next);
      if (res.ok) {
        toast.success(t.eventStatus[next]);
        setDialog(null);
        router.refresh();
      } else toast.error(errorText(res.error));
    });

  const openGoLive = () =>
    startTransition(async () => {
      setInfo(await getGoLiveInfoAction(eventId));
      setDialog("live");
    });

  const clearTest = () =>
    startTransition(async () => {
      const res = await clearTestDonationsAction(eventId);
      if (res.ok) {
        toast.success(t.eventDetail.testCleared);
        setDialog(null);
        router.refresh();
      } else toast.error(errorText(res.error));
    });

  const spin = <Loader2 className="size-4 animate-spin" />;
  const btn = size === "sm" ? "h-8 rounded-full px-3 text-xs" : "rounded-full";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {(status === "DRAFT" || status === "TEST") && (
        <Button onClick={openGoLive} disabled={pending} className={cn(btn, "bg-live text-white hover:bg-live/90")}>
          {pending && dialog === null ? spin : <Radio className="size-4" />}
          {t.eventDetail.goLive}
        </Button>
      )}
      {status === "DRAFT" && (
        <Button variant="outline" onClick={() => go("TEST")} disabled={pending} className={cn(btn, "border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-400/10")}>
          <FlaskConical className="size-4" />
          {t.eventDetail.startTest}
        </Button>
      )}
      {status === "TEST" && (
        <>
          <Button variant="outline" onClick={() => go("DRAFT")} disabled={pending} className={btn}>
            <Square className="size-4" />
            {t.eventDetail.stopTest}
          </Button>
          <Button variant="ghost" onClick={() => setDialog("clear")} disabled={pending} className={btn}>
            <Trash2 className="size-4" />
            {t.eventDetail.clearTest}
          </Button>
        </>
      )}
      {status === "LIVE" && (
        <Button variant="outline" onClick={() => setDialog("end")} disabled={pending} className={btn}>
          <CircleStop className="size-4" />
          {t.eventDetail.endEvent}
        </Button>
      )}
      {status === "ENDED" && isSuperAdmin && (
        <Button variant="outline" onClick={() => go("LIVE")} disabled={pending} className={btn}>
          {pending ? spin : <RotateCcw className="size-4" />}
          {t.eventDetail.reopen}
        </Button>
      )}

      {/* Confirmation du passage en direct */}
      <AlertDialog open={dialog === "live"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{info?.ok && !info.check.allowed ? t.eventDetail.goLiveBlocked : t.eventDetail.goLiveTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2 text-sm">
                {info?.ok ? (
                  info.check.allowed ? (
                    <>
                      <p>
                        {info.check.consumesCredit
                          ? fmt(t.eventDetail.goLiveCredit, { count: info.credits })
                          : status === "DRAFT" || status === "TEST"
                            ? t.eventDetail.goLiveFree
                            : t.eventDetail.goLiveAlreadyPaid}
                      </p>
                      {info.testDonations > 0 && <p className="font-medium text-amber-700 dark:text-amber-300">{fmt(t.eventDetail.goLivePurge, { count: info.testDonations })}</p>}
                    </>
                  ) : (
                    <p>
                      {errorText(info.check.reason)} {t.events.blockedHelp}
                    </p>
                  )
                ) : (
                  <p>{t.common.errorGeneric}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            {info?.ok && (info.check.allowed || isSuperAdmin) && (
              <AlertDialogAction
                className="bg-live text-white hover:bg-live/90"
                onClick={(e) => {
                  e.preventDefault();
                  go("LIVE");
                }}
                disabled={pending}
              >
                {pending ? spin : <Radio className="size-4" />}
                {t.eventDetail.goLive}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fin définitive */}
      <AlertDialog open={dialog === "end"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.eventDetail.endTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.eventDetail.endText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                go("ENDED");
              }}
              disabled={pending}
            >
              {pending ? spin : <CircleStop className="size-4" />}
              {t.eventDetail.endEvent}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Effacement des promesses de test */}
      <AlertDialog open={dialog === "clear"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.eventDetail.clearTest}</AlertDialogTitle>
            <AlertDialogDescription>{t.eventDetail.clearTestConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearTest();
              }}
              disabled={pending}
            >
              {pending ? spin : <Trash2 className="size-4" />}
              {t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
