import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildSnapshot } from "@/lib/live/server";
import { getEventLinks } from "@/lib/event-access";
import { normalizeShowConfig } from "@/lib/show/config";
import { getI18n } from "@/i18n/server";
import { StudioClient } from "./studio-client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.studio.title };
}

export default async function StudioPage({ params }: PageProps<"/o/[slug]/events/[eventId]/studio">) {
  const { slug, eventId } = await params;
  const ctx = await requireOrg(slug, "event.studio");
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: ctx.org.id },
    select: { id: true, logoUrl: true },
  });
  if (!event) notFound();
  const links = await getEventLinks(event.id);
  const [snapshot, templates] = await Promise.all([
    buildSnapshot(event.id, links.formUrl),
    prisma.showTemplate.findMany({ where: { organizationId: ctx.org.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, config: true } }),
  ]);
  if (!snapshot) notFound();

  return (
    <StudioClient
      organizationId={ctx.org.id}
      snapshot={snapshot}
      eventLogoUrl={event.logoUrl}
      orgLogoUrl={ctx.org.logoUrl}
      displayUrl={links.displayUrl}
      templates={templates.map((tpl) => ({ id: tpl.id, name: tpl.name, config: normalizeShowConfig(tpl.config) }))}
      blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
      backHref={ctx.can("org.view") ? `/o/${slug}/events/${event.id}` : `/o/${slug}`}
    />
  );
}
