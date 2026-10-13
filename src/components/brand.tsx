import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="fl-gold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#b8862f" />
          <stop offset="0.55" stopColor="#f1cf7e" />
          <stop offset="1" stopColor="#fff4d2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#14111f" />
      <rect x="14" y="36" width="8" height="14" rx="3" fill="url(#fl-gold)" opacity="0.55" />
      <rect x="28" y="27" width="8" height="23" rx="3" fill="url(#fl-gold)" opacity="0.8" />
      <rect x="42" y="17" width="8" height="33" rx="3" fill="url(#fl-gold)" />
      <path d="M46 7.5l1.6 3.9 3.9 1.6-3.9 1.6L46 18.5l-1.6-3.9-3.9-1.6 3.9-1.6z" fill="#fff4d2" />
    </svg>
  );
}

export function Brand({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} dir="ltr">
      <BrandMark />
      <span className={cn("text-[15px] font-semibold tracking-tight", tone === "light" ? "text-white" : "text-foreground")}>
        Fundraising<span className="font-display italic text-gold"> Live</span>
      </span>
    </span>
  );
}
