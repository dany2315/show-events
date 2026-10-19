import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isSubscriptionPlan } from "@/lib/billing";
import { formatShortDate } from "@/lib/dates";
import { getI18n } from "@/i18n/server";
import { SettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.settings.title };
}

export default async function SettingsPage({ params }: PageProps<"/o/[slug]/settings">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "org.settings");
  const { t, locale } = await getI18n();
  const subscription = await prisma.subscription.findUnique({ where: { organizationId: ctx.org.id } });

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title={t.settings.title} description={t.settings.subtitle} />
      <div className="mt-8 grid gap-6">
        <SettingsForm
          organizationId={ctx.org.id}
          defaults={{
            name: ctx.org.name,
            country: (["FR", "IL"].includes(ctx.org.country) ? ctx.org.country : "OTHER") as "FR" | "IL" | "OTHER",
            defaultCurrency: ctx.org.defaultCurrency,
            defaultLocale: ctx.org.defaultLocale,
            logoUrl: ctx.org.logoUrl,
          }}
        />

        <section className="rounded-3xl border bg-card p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="size-5 text-muted-foreground" />
            {t.settings.billingTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.settings.billingText}</p>
          {subscription ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/60 p-4">
                <dt className="text-xs text-muted-foreground">{t.settings.plan}</dt>
                <dd className="mt-1 font-semibold">{t.plans[subscription.plan]}</dd>
                <dd className="text-xs text-muted-foreground">{t.subscriptionStatus[subscription.status]}</dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <dt className="text-xs text-muted-foreground">{t.settings.eventCredits}</dt>
                <dd className="mt-1 font-semibold">{isSubscriptionPlan(subscription.plan) ? t.dashboard.unlimited : subscription.eventCredits}</dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <dt className="text-xs text-muted-foreground">{t.settings.periodEnd}</dt>
                <dd className="mt-1 font-semibold">{subscription.currentPeriodEnd ? formatShortDate(subscription.currentPeriodEnd, locale) : t.common.unknown}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 text-sm">{t.settings.noPlan}</p>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
