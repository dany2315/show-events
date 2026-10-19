import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronRight, LayoutTemplate, MonitorPlay, Plus, RadioTower, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageContainer, PageHeader } from "@/components/app/page-header";
import { EventStatusBadge } from "@/components/app/event-status-badge";
import { GoalBar } from "@/components/app/progress-ring";
import { getOrgContext, requireOrg } from "@/lib/dal";
import { getEventLinks } from "@/lib/event-access";
import { listOrgEvents, pickFeaturedEvent, type EventSummary } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPercent, goalProgress } from "@/lib/money";
import { formatDate, formatShortDate } from "@/lib/dates";
import { getI18n } from "@/i18n/server";
import { countLabel, fmt } from "@/i18n/format";
import { isSubscriptionPlan } from "@/lib/billing";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AppLocale } from "@/lib/constants";

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [ctx, { t }] = await Promise.all([getOrgContext(slug), getI18n()]);
  return { title: ctx?.org.name ?? t.nav.dashboard };
}

export default async function OrgDashboard({ params }: PageProps<"/o/[slug]">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "event.screen");
  const { t, locale } = await getI18n();
  const events = await listOrgEvents(ctx.org.id);

  if (!ctx.can("org.view")) return <OperatorHome slug={slug} events={events} />;

  const featured = pickFeaturedEvent(events);
  const [memberCount, subscription, links] = await Promise.all([
    prisma.membership.count({ where: { organizationId: ctx.org.id } }),
    prisma.subscription.findUnique({ where: { organizationId: ctx.org.id } }),
    featured ? getEventLinks(featured.event.id) : Promise.resolve(null),
  ]);
  const others = events.filter((e) => e.id !== featured?.event.id).slice(0, 5);
  const base = `/o/${slug}`;

  return (
    <PageContainer>
      <PageHeader
        title={fmt(t.dashboard.hello, { name: ctx.user.name.split(" ")[0] })}
        description={t.dashboard.subtitle}
        actions={
          <Button asChild size="lg" className="h-10 rounded-full px-4">
            <Link href={`${base}/events/new`}>
              <Plus className="size-4" />
              {t.dashboard.createEvent}
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {featured && links ? (
          <FeaturedEvent
            event={featured.event}
            kindLabel={featured.kind === "current" ? t.dashboard.currentEvent : featured.kind === "next" ? t.dashboard.nextEvent : t.dashboard.lastEvent}
            base={base}
            screenUrl={links.displayUrl}
            t={t}
            locale={locale}
          />
        ) : (
          <EmptyState
            icon={<CalendarPlus className="size-6" />}
            title={t.dashboard.noEvent}
            text={t.dashboard.noEventText}
            action={
              <Button asChild className="rounded-full">
                <Link href={`${base}/events/new`}>{t.dashboard.createEvent}</Link>
              </Button>
            }
          />
        )}

        <div className="grid content-start gap-5">
          <div className="rounded-3xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <Users className="size-5" />
              </span>
              <h3 className="font-semibold">{t.dashboard.teamCard}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{fmt(t.dashboard.teamCardText, { count: memberCount })}</p>
            <Button asChild variant="outline" className="mt-4 w-full rounded-full">
              <Link href={`${base}/team`}>{t.dashboard.manageTeam}</Link>
            </Button>
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gold-soft text-gold">
                <Wallet className="size-5" />
              </span>
              <h3 className="font-semibold">{t.dashboard.planCard}</h3>
            </div>
            {subscription ? (
              <div className="mt-3 text-sm">
                <div className="font-medium">{t.plans[subscription.plan]}</div>
                <div className="mt-1 text-muted-foreground">
                  {isSubscriptionPlan(subscription.plan)
                    ? `${t.dashboard.unlimited}${subscription.currentPeriodEnd ? " · " + fmt(t.dashboard.until, { date: formatShortDate(subscription.currentPeriodEnd, locale) }) : ""}`
                    : countLabel(t.counts, "credits", subscription.eventCredits)}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t.settings.noPlan}</p>
            )}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.dashboard.otherEvents}</h2>
            <Link href={`${base}/events`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              {t.dashboard.allEvents}
            </Link>
          </div>
          <div className="mt-4 divide-y overflow-hidden rounded-3xl border bg-card">
            {others.map((e) => (
              <Link key={e.id} href={`${base}/events/${e.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{e.name}</span>
                    <EventStatusBadge status={e.status} label={t.eventStatus[e.status]} />
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{formatShortDate(e.date, locale)}</div>
                </div>
                <div className="text-end">
                  <div className="tabular font-semibold">{formatMoney(e.total, e.currency, locale)}</div>
                  <div className="text-xs text-muted-foreground">{formatPercent(goalProgress(e.total, e.goalAmount), locale)}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );

}

function FeaturedEvent({
  event,
  kindLabel,
  base,
  screenUrl,
  t,
  locale,
}: {
  event: EventSummary;
  kindLabel: string;
  base: string;
  screenUrl: string;
  t: Dictionary;
  locale: AppLocale;
}) {
  const pct = goalProgress(event.total, event.goalAmount);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white shadow-[0_40px_100px_-50px_rgba(20,17,31,0.8)] sm:p-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_90%_0%,rgba(228,182,92,0.22),transparent_60%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">{kindLabel}</span>
          <EventStatusBadge status={event.status} label={t.eventStatus[event.status]} className="bg-white/10 text-white" />
        </div>
        <Link href={`${base}/events/${event.id}`} className="mt-3 block font-display text-3xl leading-tight hover:underline sm:text-4xl">
          {event.name}
        </Link>
        <p className="mt-1 text-sm text-white/55">{formatDate(event.date, locale)}</p>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="gold-text tabular font-bold tracking-tight text-5xl sm:text-6xl">{formatMoney(event.total, event.currency, locale)}</div>
            <div className="mt-2 text-sm text-white/60">
              {countLabel(t.counts, "promises", event.count)} · {fmt(t.dashboard.ofGoal, { goal: formatMoney(event.goalAmount, event.currency, locale) })}
            </div>
          </div>
          <div className="tabular font-bold tracking-tight text-3xl text-gold">{formatPercent((event.total / Math.max(1, event.goalAmount)) * 100, locale)}</div>
        </div>
        <GoalBar value={pct} className="mt-4 bg-white/10" />

        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          <Button asChild size="lg" className="h-11 rounded-full bg-gold font-semibold text-ink hover:bg-[#e3b45c]">
            <Link href={`${base}/events/${event.id}/regie`}>
              <RadioTower className="size-4" />
              {t.dashboard.addDonation}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <a href={screenUrl} target="_blank" rel="noreferrer">
              <MonitorPlay className="size-4" />
              {t.dashboard.openShow}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href={`${base}/events/${event.id}/studio`}>
              <LayoutTemplate className="size-4" />
              {t.dashboard.customize}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

async function OperatorHome({ slug, events }: { slug: string; events: EventSummary[] }) {
  const { t, locale } = await getI18n();
  const visible = [...events].sort((a, b) => Number(a.status === "ENDED") - Number(b.status === "ENDED"));
  const links = await Promise.all(visible.map((e) => getEventLinks(e.id)));
  const base = `/o/${slug}`;
  return (
    <PageContainer>
      <PageHeader title={t.dashboard.operatorTitle} description={t.dashboard.operatorSubtitle} />
      <div className="mt-8 grid gap-6">
        {visible.length === 0 && <EmptyState icon={<CalendarPlus className="size-6" />} title={t.events.empty} />}
        {visible.map((e, i) => (
          <div key={e.id} className="rounded-3xl border bg-card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl">{e.name}</h2>
                  <EventStatusBadge status={e.status} label={t.eventStatus[e.status]} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatDate(e.date, locale)}</p>
              </div>
              <div className="tabular font-bold tracking-tight text-2xl">{formatMoney(e.total, e.currency, locale)}</div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { href: `${base}/events/${e.id}/studio`, icon: LayoutTemplate, title: t.studio.title, text: t.dashboard.moduleStudio, external: false },
                { href: `${base}/events/${e.id}/regie`, icon: RadioTower, title: t.regie.title, text: t.dashboard.moduleRegie, external: false },
                { href: links[i].displayUrl, icon: MonitorPlay, title: t.events.screen, text: t.dashboard.moduleScreen, external: true },
              ].map(({ href, icon: Icon, title, text, external }) => {
                const inner = (
                  <>
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-ink text-gold transition-transform group-hover:scale-105">
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-4 block font-semibold">{title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
                  </>
                );
                const cls = "group rounded-2xl border p-5 transition-colors hover:border-gold/50 hover:bg-accent/40";
                return external ? (
                  <a key={title} href={href} target="_blank" rel="noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <Link key={title} href={href} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
