import { cn } from "@/lib/utils";
import type { EventStatusCode } from "@/lib/constants";

export function EventStatusBadge({ status, label, className }: { status: EventStatusCode; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "LIVE" && "bg-live/10 text-live",
        status === "DRAFT" && "bg-muted text-muted-foreground",
        status === "ENDED" && "bg-success/10 text-success",
        className,
      )}
    >
      {status === "LIVE" ? <span className="live-dot !size-1.5" /> : <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {label}
    </span>
  );
}
