import type { Metadata } from "next";
import { MonitorX } from "lucide-react";
import { resolveAccessToken, getEventLinks } from "@/lib/event-access";
import { buildSnapshot } from "@/lib/live/server";
import { getI18n } from "@/i18n/server";
import { ScreenClient } from "./screen-client";

export const metadata: Metadata = {
  title: "Show",
  robots: { index: false, follow: false },
};

/** Écran géant : lien de diffusion public, non devinable, à ouvrir en plein écran. */
export default async function ScreenPage({ params }: PageProps<"/screen/[token]">) {
  const { token } = await params;
  const eventId = await resolveAccessToken(token, "DISPLAY");
  const snapshot = eventId ? await buildSnapshot(eventId, (await getEventLinks(eventId)).formUrl) : null;

  if (!snapshot) {
    const { t } = await getI18n();
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center text-white">
        <MonitorX className="size-12 text-gold" />
        <h1 className="mt-6 font-display text-3xl">{t.show.unavailable}</h1>
        <p className="mt-2 text-white/60">{t.show.unavailableHelp}</p>
      </div>
    );
  }

  return <ScreenClient token={token} snapshot={snapshot} />;
}
