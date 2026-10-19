import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, ChevronRight, HandCoins, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageContainer, PageHeader } from "@/components/app/page-header";
import { prisma } from "@/lib/prisma";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo-mode";
import { requireSuperAdmin } from "@/lib/dal";
import { isSubscriptionPlan } from "@/lib/billing";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { countLabel } from "@/i18n/format";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 3600_000);
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.title };
}

export default async function AdminHome() {
  await requireSuperAdmin();
  const { t } = await getI18n();
  const since = daysAgo(30);
  const [orgs, activeOrgs, events, liveEvents, donations30, users] = await Promise.all([
    // Les espaces de démonstration (mode démo) n'apparaissent pas dans l'administration.
    prisma.organization.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        status: true,
        country: true,
        subscription: { select: { plan: true, status: true, eventCredits: true } },
        _count: { select: { events: true, memberships: true } },
        events: { where: { status: "LIVE" }, select: { id: true } },
      },
    }),
    prisma.organization.count({ where: { status: "ACTIVE", isDemo: false } }),
    prisma.event.count({ where: { organization: { isDemo: false } } }),
    prisma.event.count({ where: { status: "LIVE", organization: { isDemo: false } } }),
    prisma.donation.count({ where: { createdAt: { gte: since }, deletedAt: null, event: { organization: { isDemo: false } } } }),
    prisma.user.count({ where: { NOT: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } } }),
  ]);

  const stats = [
    { icon: Building2, label: t.admin.statOrgs, value: orgs.length, sub: `${activeOrgs} ${t.admin.statActiveOrgs}` },
    { icon: CalendarDays, label: t.admin.statEvents, value: events, sub: `${liveEvents} ${t.admin.statLive}` },
    { icon: HandCoins, label: t.admin.statDonations, value: donations30 },
    { icon: Users, label: t.admin.statUsers, value: users },
  ];

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title={t.admin.title}
        description={t.admin.subtitle}
        actions={
          <Button asChild size="lg" className="h-10 rounded-full px-4">
            <Link href="/admin/organizations/new">
              <Plus className="size-4" />
              {t.admin.newOrg}
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-3xl border bg-card p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {label}
              <Icon className="size-4" />
            </div>
            <div className="tabular mt-3 font-bold tracking-tight text-4xl">{value}</div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.admin.organizations}</h2>
        {orgs.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={<Building2 className="size-6" />} title={t.admin.noOrgs} />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border bg-card">
            <ul className="divide-y">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link href={`/admin/organizations/${org.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
                      {org.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.logoUrl} alt="" className="size-full object-contain p-1" />
                      ) : (
                        <Building2 className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{org.name}</span>
                        {org.events.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-live/10 px-2 py-0.5 text-[11px] font-medium text-live">
                            <span className="live-dot !size-1.5" /> {t.common.live}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        /{org.slug} · {org.country}
                      </div>
                    </div>
                    <div className="hidden text-sm sm:block">
                      <div className="font-medium">{org.subscription ? t.plans[org.subscription.plan] : t.settings.noPlan}</div>
                      <div className="text-xs text-muted-foreground">
                        {org.subscription && !isSubscriptionPlan(org.subscription.plan) ? countLabel(t.counts, "credits", org.subscription.eventCredits) : org.subscription ? t.subscriptionStatus[org.subscription.status] : ""}
                      </div>
                    </div>
                    <div className="hidden text-end text-xs text-muted-foreground md:block">
                      <div>{countLabel(t.counts, "events", org._count.events)}</div>
                      <div>{countLabel(t.counts, "members", org._count.memberships)}</div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        org.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {t.orgStatus[org.status]}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
