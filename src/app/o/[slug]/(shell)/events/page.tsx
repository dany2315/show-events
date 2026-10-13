import Link from "next/link";
import { CalendarPlus, LayoutTemplate, Plus, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageContainer, PageHeader } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/event-status-badge";
import { requireOrg } from "@/lib/dal";
import { listOrgEvents, type EventSummary } from "@/lib/queries";
import { formatMoney, formatPercent, goalProgress } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { THEMES } from "@/lib/show/themes";
import { getI18n } from "@/i18n/server";
import { countLabel } from "@/i18n/format";

export default async function EventsPage({ params }: PageProps<"/o/[slug]/events">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "org.view");
  const { t } = await getI18n();
  const events = await listOrgEvents(ctx.org.id);
  const upcoming = events.filter((e) => e.status !== "ENDED").sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = events.filter((e) => e.status === "ENDED");

  return (
    <PageContainer>
      <PageHeader
        title={t.events.title}
        description={t.events.subtitle}
        actions={
          <Button asChild size="lg" className="h-10 rounded-full px-4">
            <Link href={`/o/${slug}/events/new`}>
              <Plus className="size-4" />
              {t.events.new}
            </Link>
          </Button>
        }
      />
      {events.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<CalendarPlus className="size-6" />}
            title={t.events.empty}
            text={t.events.emptyText}
            action={
              <Button asChild className="rounded-full">
                <Link href={`/o/${slug}/events/new`}>{t.events.new}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {upcoming.length > 0 && <EventGrid title={t.events.upcoming} events={upcoming} slug={slug} />}
          {past.length > 0 && <EventGrid title={t.events.past} events={past} slug={slug} />}
        </>
      )}
    </PageContainer>
  );
}

async function EventGrid({ title, events, slug }: { title: string; events: EventSummary[]; slug: string }) {
  const { t, locale } = await getI18n();
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {events.map((e) => {
          const theme = THEMES[(e.theme as keyof typeof THEMES) ?? "gala"] ?? THEMES.gala;
          const pct = goalProgress(e.total, e.goalAmount);
          return (
            <article key={e.id} className="group overflow-hidden rounded-3xl border bg-card transition-shadow hover:shadow-[0_30px_70px_-45px_rgba(20,17,31,0.5)]">
              <Link href={`/o/${slug}/events/${e.id}`} className="block">
                <div
                  className="relative h-28 overflow-hidden"
                  style={{ background: `radial-gradient(120% 140% at 15% 0%, ${theme.vars.bg2}, ${theme.vars.bg} 65%)` }}
                >
                  <div className="absolute inset-x-5 bottom-4 flex items-end justify-between" style={{ color: theme.vars.text }}>
                    <span className="tabular font-bold tracking-tight text-3xl">{formatMoney(e.total, e.currency, locale)}</span>
                    <span className="text-sm opacity-80">{formatPercent((e.total / Math.max(1, e.goalAmount)) * 100, locale)}</span>
                  </div>
                  <div className="absolute inset-x-5 bottom-2 h-1 overflow-hidden rounded-full" style={{ background: theme.vars.track }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.vars.accent }} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{e.name}</h3>
                    <EventStatusBadge status={e.status} label={t.eventStatus[e.status]} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(e.date, locale)}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.events.goalShort} {formatMoney(e.goalAmount, e.currency, locale)} · {countLabel(t.counts, "promises", e.count)}
                  </p>
                </div>
              </Link>
              <div className="flex gap-2 border-t px-5 py-3">
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link href={`/o/${slug}/events/${e.id}/studio`}>
                    <LayoutTemplate className="size-3.5" />
                    {t.events.studio}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link href={`/o/${slug}/events/${e.id}/regie`}>
                    <RadioTower className="size-3.5" />
                    {t.events.regie}
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
