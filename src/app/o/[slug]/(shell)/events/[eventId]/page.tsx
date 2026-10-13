import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, LayoutTemplate, MonitorPlay, RadioTower, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/event-status-badge";
import { EventStatusControl } from "@/components/app/event-status-control";
import { EventLinks } from "@/components/app/event-links";
import { DonationsTable } from "@/components/app/donations-table";
import { ConfirmAction } from "@/components/app/confirm-action";
import { EventForm } from "@/components/app/event-form";
import { GoalBar } from "@/components/app/progress-ring";
import { deleteEventAction, updateEventAction } from "@/app/actions/events";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getEventLinks } from "@/lib/event-access";
import { getRegieState } from "@/lib/regie";
import { formatMoney, formatPercent, goalProgress } from "@/lib/money";
import { formatDate, formatShortDate, formatTime } from "@/lib/dates";
import { getI18n } from "@/i18n/server";
import { countLabel, fmt } from "@/i18n/format";

export default async function EventDetailPage({ params }: PageProps<"/o/[slug]/events/[eventId]">) {
  const { slug, eventId } = await params;
  const ctx = await requireOrg(slug, "org.view");
  const { t, locale } = await getI18n();
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: ctx.org.id },
    select: { id: true, name: true, date: true, goalAmount: true, currency: true, locale: true, status: true },
  });
  if (!event) notFound();

  const donationIds = (await prisma.donation.findMany({ where: { eventId: event.id }, select: { id: true } })).map((d) => d.id);
  const [links, regie, eventHistory] = await Promise.all([
    getEventLinks(event.id),
    getRegieState(event.id, 500),
    prisma.auditLog.findMany({
      where: { organizationId: ctx.org.id, entityType: "Donation", entityId: { in: donationIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, action: true, createdAt: true, metadata: true, actor: { select: { name: true } } },
    }),
  ]);
  const pct = goalProgress(regie.total, event.goalAmount);
  const base = `/o/${slug}/events/${event.id}`;
  const canManage = ctx.can("event.manage");

  return (
    <PageContainer>
      <Link href={`/o/${slug}/events`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t.events.title}
      </Link>

      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{event.name}</h1>
            <EventStatusBadge status={event.status} label={t.eventStatus[event.status]} />
          </div>
          <p className="mt-2 text-muted-foreground">{formatDate(event.date, locale)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full bg-ink text-white hover:bg-ink/90">
            <Link href={`${base}/regie`}>
              <RadioTower className="size-4" />
              {t.regie.title}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`${base}/studio`}>
              <LayoutTemplate className="size-4" />
              {t.studio.title}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <a href={links.displayUrl} target="_blank" rel="noreferrer">
              <MonitorPlay className="size-4" />
              {t.dashboard.openShow}
            </a>
          </Button>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgba(228,182,92,0.2),transparent_60%)]" />
          <div className="relative">
            <div className="text-sm text-white/60">{t.eventDetail.totalShow}</div>
            <div className="gold-text tabular mt-2 font-bold tracking-tight text-5xl sm:text-6xl">{formatMoney(regie.total, event.currency, locale)}</div>
            <div className="mt-1 text-xs text-white/45">{t.eventDetail.totalShowHelp}</div>
            <div className="mt-6 flex items-center justify-between text-sm text-white/70">
              <span>
                {t.common.goal} {formatMoney(event.goalAmount, event.currency, locale)}
              </span>
              <span className="tabular font-semibold text-gold">{formatPercent((regie.total / Math.max(1, event.goalAmount)) * 100, locale)}</span>
            </div>
            <GoalBar value={pct} className="mt-2 bg-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Kpi label={t.eventDetail.realTotal} value={formatMoney(regie.realTotal, event.currency, locale)} sub={countLabel(t.counts, "promises", regie.realCount)} />
          <Kpi
            label={t.eventDetail.fictitiousTotal}
            value={formatMoney(regie.fictitiousTotal, event.currency, locale)}
            sub={countLabel(t.counts, "promises", regie.fictitiousCount)}
            tone="amber"
          />
          <Kpi label={t.eventDetail.count} value={String(regie.count)} />
          <div className="rounded-3xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{t.eventDetail.statusTitle}</div>
            <EventStatusControl eventId={event.id} status={event.status} compact className="mt-3" />
          </div>
        </div>
      </div>
      {event.status === "ENDED" && <p className="mt-3 text-sm text-muted-foreground">{t.eventDetail.endedInfo}</p>}

      {/* Liens */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.eventDetail.links}</h2>
        <div className="mt-4">
          <EventLinks eventId={event.id} eventName={event.name} formUrl={links.formUrl} displayUrl={links.displayUrl} canManage={canManage} />
        </div>
      </section>

      {/* Promesses */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.eventDetail.donationsList}</h2>
        <div className="mt-4">
          <DonationsTable donations={regie.donations} currency={event.currency} exportUrl={canManage ? `/api/events/${event.id}/export` : undefined} />
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Informations */}
        {canManage && (
          <section className="rounded-3xl border bg-card p-6 sm:p-7">
            <h2 className="text-lg font-semibold">{t.eventDetail.editDetails}</h2>
            <div className="mt-5">
              <EventForm
                mode="edit"
                eventId={event.id}
                action={updateEventAction}
                defaults={{
                  name: event.name,
                  date: event.date.toISOString(),
                  goalAmount: event.goalAmount,
                  currency: event.currency,
                  locale: event.locale,
                }}
                currencyLocked={regie.count > 0}
                submitLabel={t.common.save}
              />
            </div>
          </section>
        )}

        {/* Historique */}
        <section className="rounded-3xl border bg-card p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5 text-muted-foreground" />
            {t.eventDetail.history}
          </h2>
          {eventHistory.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t.eventDetail.historyEmpty}</p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {eventHistory.map((h) => {
                const meta = (h.metadata ?? {}) as { before?: { donorName: string; amount: number }; after?: { donorName: string; amount: number }; donorName?: string; amount?: number };
                const detail =
                  h.action === "donation.update" && meta.before && meta.after
                    ? `${meta.before.donorName} · ${formatMoney(meta.before.amount, event.currency, locale)} → ${meta.after.donorName} · ${formatMoney(meta.after.amount, event.currency, locale)}`
                    : `${meta.donorName ?? ""} · ${formatMoney(meta.amount ?? 0, event.currency, locale)}`;
                return (
                  <li key={h.id} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{h.action === "donation.update" ? t.eventDetail.audit_donation_update : t.eventDetail.audit_donation_delete}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {formatShortDate(h.createdAt, locale)} {formatTime(h.createdAt, locale)}
                      </span>
                    </div>
                    <div className="mt-1 text-muted-foreground">{detail}</div>
                    {h.actor?.name && <div className="mt-0.5 text-xs text-muted-foreground">{fmt(t.eventDetail.by, { name: h.actor.name })}</div>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {canManage && (
        <div className="mt-10 flex justify-end border-t pt-6">
          <ConfirmAction
            action={deleteEventAction.bind(null, event.id)}
            title={t.eventDetail.deleteEvent}
            description={t.eventDetail.deleteEventConfirm}
            label={t.eventDetail.deleteEvent}
            icon={<Trash2 className="size-4" />}
            variant="destructive"
          />
        </div>
      )}
    </PageContainer>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "amber" }) {
  return (
    <div className={tone === "amber" ? "rounded-3xl border border-amber-200 bg-amber-50/60 p-5" : "rounded-3xl border bg-card p-5"}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="tabular mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
