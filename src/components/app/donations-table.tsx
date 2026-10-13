"use client";

import { useMemo, useState } from "react";
import { Download, Smartphone, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/money";
import { formatTime, formatShortDate } from "@/lib/dates";
import type { AdminDonation } from "@/lib/regie";
import type { CurrencyCode } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DonationsTable({ donations, currency, exportUrl }: { donations: AdminDonation[]; currency: CurrencyCode; exportUrl?: string }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<"all" | "real" | "fictitious">("all");
  const rows = useMemo(
    () => donations.filter((d) => (filter === "all" ? true : filter === "real" ? !d.isFictitious : d.isFictitious)),
    [donations, filter],
  );

  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm">
          {(["all", "real", "fictitious"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn("rounded-full px-3 py-1 transition-colors", filter === f ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {f === "all" ? t.eventDetail.filterAll : f === "real" ? t.eventDetail.filterReal : t.eventDetail.filterFictitious}
            </button>
          ))}
        </div>
        {exportUrl && (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <a href={exportUrl}>
              <Download className="size-3.5" />
              {t.eventDetail.exportCsv}
            </a>
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-muted-foreground">{t.eventDetail.noDonations}</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-3 text-start font-medium">{t.common.name}</th>
                <th className="px-3 py-3 text-start font-medium">{t.common.date}</th>
                <th className="px-3 py-3 text-start font-medium">{t.eventDetail.source}</th>
                <th className="px-5 py-3 text-end font-medium">{t.common.amount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.donorName}</span>
                      {d.isFictitious && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{t.eventDetail.fictitious}</span>
                      )}
                    </div>
                    {d.createdByName && <div className="text-xs text-muted-foreground">{d.createdByName}</div>}
                  </td>
                  <td className="tabular px-3 py-3 text-muted-foreground">
                    {formatShortDate(d.createdAt, locale)} · {formatTime(d.createdAt, locale)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {d.source === "MOBILE" ? <Smartphone className="size-3.5" /> : <Keyboard className="size-3.5" />}
                      {d.source === "MOBILE" ? t.eventDetail.source_MOBILE : t.eventDetail.source_MANUAL}
                    </span>
                  </td>
                  <td className="tabular px-5 py-3 text-end font-semibold">{formatMoney(d.amount, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
