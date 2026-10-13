import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Building2, CheckCircle2, ExternalLink, LayoutTemplate, MonitorPlay, RadioTower, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-header";
import { ConfirmAction } from "@/components/app/confirm-action";
import { EventStatusBadge } from "@/components/app/event-status-badge";
import { deleteOrganizationAction, setOrgStatusAction } from "@/app/actions/organization";
import { requireSuperAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { listOrgEvents } from "@/lib/queries";
import { getEventLinks } from "@/lib/event-access";
import { formatMoney } from "@/lib/money";
import { formatShortDate, formatTime } from "@/lib/dates";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { PlanForm } from "./plan-form";

export default async function AdminOrganizationPage({ params }: PageProps<"/admin/organizations/[id]">) {
  const { id } = await params;
  await requireSuperAdmin();
  const { t, locale } = await getI18n();
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: true,
      memberships: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } },
    },
  });
  if (!org) notFound();
  const events = await listOrgEvents(org.id);
  const links = await Promise.all(events.map((e) => getEventLinks(e.id)));

  return (
    <PageContainer className="max-w-7xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t.admin.title}
      </Link>

      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border bg-white">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="size-full object-contain p-1.5" />
            ) : (
              <Building2 className="size-7 text-muted-foreground" />
            )}
          </span>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">{org.name}</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">
              /o/{org.slug} · {org.country} · {org.defaultCurrency}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link href={`/o/${org.slug}`}>
              <ExternalLink className="size-4" />
              {t.admin.openSpace}
            </Link>
          </Button>
          {org.status === "ACTIVE" ? (
            <ConfirmAction
              action={setOrgStatusAction.bind(null, org.id, "SUSPENDED")}
              title={t.admin.suspend}
              description={t.admin.suspendConfirm}
              label={t.admin.suspend}
              successMessage={t.admin.suspended}
              icon={<Ban className="size-4" />}
              variant="outline"
              className="rounded-full"
            />
          ) : (
            <ConfirmAction
              action={setOrgStatusAction.bind(null, org.id, "ACTIVE")}
              title={t.admin.activate}
              description={org.name}
              label={t.admin.activate}
              successMessage={t.admin.activated}
              icon={<CheckCircle2 className="size-4" />}
              variant="default"
              className="rounded-full"
            />
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <section className="rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-semibold">{t.admin.events}</h2>
            {events.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t.events.empty}</p>
            ) : (
              <ul className="mt-4 divide-y">
                {events.map((e, i) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{e.name}</span>
                        <EventStatusBadge status={e.status} label={t.eventStatus[e.status]} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatShortDate(e.date, locale)} · {formatMoney(e.total, e.currency, locale)} / {formatMoney(e.goalAmount, e.currency, locale)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/o/${org.slug}/events/${e.id}/studio`}>
                          <LayoutTemplate className="size-3.5" />
                          {t.events.studio}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/o/${org.slug}/events/${e.id}/regie`}>
                          <RadioTower className="size-3.5" />
                          {t.events.regie}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a href={links[i].displayUrl} target="_blank" rel="noreferrer">
                          <MonitorPlay className="size-3.5" />
                          {t.events.screen}
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-semibold">{t.admin.members}</h2>
            <ul className="mt-4 divide-y">
              {org.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.user.name}</div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">
                      {m.user.email}
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{t.roles[m.role]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border bg-card p-6">
            <h2 className="text-lg font-semibold">{t.admin.recentActivity}</h2>
            <ul className="mt-4 grid gap-2 text-sm">
              {org.auditLogs.length === 0 && <li className="text-muted-foreground">{t.common.none}</li>}
              {org.auditLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <span className="font-mono text-xs">{log.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {log.actor?.name ? fmt(t.eventDetail.by, { name: log.actor.name }) + " · " : ""}
                    {formatShortDate(log.createdAt, locale)} {formatTime(log.createdAt, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <PlanForm
            organizationId={org.id}
            defaults={{
              plan: org.subscription?.plan ?? "TRIAL",
              status: org.subscription?.status ?? "ACTIVE",
              eventCredits: org.subscription?.eventCredits ?? 0,
              currentPeriodEnd: org.subscription?.currentPeriodEnd?.toISOString().slice(0, 10) ?? "",
              notes: org.subscription?.notes ?? "",
            }}
          />
          <div className="rounded-3xl border border-destructive/25 p-6">
            <ConfirmAction
              action={deleteOrganizationAction.bind(null, org.id)}
              title={t.admin.deleteOrg}
              description={fmt(t.admin.deleteOrgConfirm, { name: org.name })}
              label={t.admin.deleteOrg}
              icon={<Trash2 className="size-4" />}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
