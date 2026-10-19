import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { resolveAccessToken } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/live/server";
import { normalizeShowConfig } from "@/lib/show/config";
import { themeCssVars, THEMES } from "@/lib/show/themes";
import { getI18n } from "@/i18n/server";
import { isSafeWebUrl } from "@/lib/validation";
import { DonateForm } from "./donate-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Formulaire mobile de promesse (lien unique / QR code). */
export default async function DonatePage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const eventId = await resolveAccessToken(token, "DONATION_FORM");
  const event = eventId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          name: true,
          currency: true,
          locale: true,
          goalAmount: true,
          status: true,
          campaignUrl: true,
          logoUrl: true,
          organization: { select: { name: true, logoUrl: true, status: true } },
          layout: { select: { config: true } },
          categories: { orderBy: { position: "asc" }, select: { id: true, name: true, color: true } },
        },
      })
    : null;

  if (!event || event.organization.status === "SUSPENDED") {
    const { t } = await getI18n();
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-white">
        <LinkIcon className="size-10 text-gold" />
        <h1 className="mt-5 font-display text-2xl">{t.donate.errorUnavailable}</h1>
      </div>
    );
  }

  const config = normalizeShowConfig(event.layout?.config);
  const theme = THEMES[config.theme];
  const totals = await computeTotals(prisma, event.id);

  return (
    <DonateForm
      token={token}
      event={{
        name: event.name,
        organizationName: event.organization.name,
        logoUrl: event.logoUrl ?? event.organization.logoUrl,
        currency: event.currency,
        locale: event.locale,
        goalAmount: event.goalAmount,
        status: event.status,
        categories: event.categories,
        // Revalidé à l'affichage : seule une adresse http(s) peut servir de redirection.
        campaignUrl: event.campaignUrl && isSafeWebUrl(event.campaignUrl) ? event.campaignUrl : null,
      }}
      initialTotal={totals.total}
      cssVars={themeCssVars(config)}
      dark={theme.dark}
    />
  );
}
