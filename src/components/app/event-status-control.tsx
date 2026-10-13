"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePlay, CircleStop, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setEventStatusAction } from "@/app/actions/events";
import { useI18n } from "@/i18n/client";
import type { EventStatusCode } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function EventStatusControl({ eventId, status, compact, className }: { eventId: string; status: EventStatusCode; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: EventStatusCode) =>
    startTransition(async () => {
      const res = await setEventStatusAction(eventId, next);
      if (res.ok) {
        toast.success(t.eventStatus[next]);
        router.refresh();
      } else toast.error(t.common.errorGeneric);
    });

  const icon = pending ? <Loader2 className="size-4 animate-spin" /> : null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {status === "DRAFT" && (
        <Button onClick={() => go("LIVE")} disabled={pending} className="rounded-full bg-live text-white hover:bg-live/90">
          {icon ?? <CirclePlay className="size-4" />}
          {t.eventDetail.goLive}
        </Button>
      )}
      {status === "LIVE" && (
        <>
          <Button onClick={() => go("ENDED")} disabled={pending} variant="outline" className="rounded-full">
            {icon ?? <CircleStop className="size-4" />}
            {t.eventDetail.endEvent}
          </Button>
          {!compact && (
            <Button onClick={() => go("DRAFT")} disabled={pending} variant="ghost" className="rounded-full">
              {t.eventDetail.backToDraft}
            </Button>
          )}
        </>
      )}
      {status === "ENDED" && (
        <Button onClick={() => go("LIVE")} disabled={pending} variant="outline" className="rounded-full">
          {icon ?? <RotateCcw className="size-4" />}
          {t.eventDetail.reopen}
        </Button>
      )}
    </div>
  );
}
