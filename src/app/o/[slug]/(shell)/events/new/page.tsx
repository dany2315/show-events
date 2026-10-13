import Link from "next/link";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { EventForm } from "@/components/app/event-form";
import { createEventAction } from "@/app/actions/events";
import { requireOrg } from "@/lib/dal";
import { getEventCreationCheck } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";

export default async function NewEventPage({ params }: PageProps<"/o/[slug]/events/new">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "event.manage");
  const { t } = await getI18n();
  const [check, templates] = await Promise.all([
    getEventCreationCheck(ctx.org.id),
    prisma.showTemplate.findMany({ where: { organizationId: ctx.org.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, config: true } }),
  ]);
  const isSuper = ctx.user.platformRole === "SUPER_ADMIN";
  const blocked = !check.allowed && !isSuper;

  return (
    <PageContainer className="max-w-3xl">
      <Link href={`/o/${slug}/events`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t.events.title}
      </Link>
      <PageHeader className="mt-4" title={t.events.createTitle} description={t.events.createSubtitle} />

      {blocked ? (
        <div className="mt-8 rounded-3xl border border-destructive/25 bg-destructive/5 p-6">
          <div className="flex items-center gap-3 font-semibold text-destructive">
            <AlertTriangle className="size-5" />
            {t.events.blockedTitle}
          </div>
          <p className="mt-2">{t.events[`blocked_${check.allowed ? "INACTIVE" : check.reason}`]}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.events.blockedHelp}</p>
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border bg-card p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-2 rounded-2xl bg-gold-soft/60 px-4 py-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-gold" />
            {check.subscriptionPlan ? t.events.unlimitedOnLive : fmt(t.events.creditOnLive, { count: check.credits })}
          </div>
          <EventForm
            mode="create"
            action={createEventAction.bind(null, ctx.org.id)}
            defaults={{ currency: ctx.org.defaultCurrency, locale: ctx.org.defaultLocale }}
            templates={templates.map((tpl) => ({ id: tpl.id, name: tpl.name, theme: (tpl.config as { theme?: string })?.theme ?? "gala" }))}
            submitLabel={t.events.submit}
          />
        </div>
      )}
    </PageContainer>
  );
}
