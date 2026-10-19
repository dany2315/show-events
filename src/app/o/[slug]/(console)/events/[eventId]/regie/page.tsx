import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildSnapshot } from "@/lib/live/server";
import { getEventLinks } from "@/lib/event-access";
import { getRegieState } from "@/lib/regie";
import { listEventVideos } from "@/lib/videos";
import { getI18n } from "@/i18n/server";
import { RegieClient } from "./regie-client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.regie.title };
}

export default async function RegiePage({ params }: PageProps<"/o/[slug]/events/[eventId]/regie">) {
  const { slug, eventId } = await params;
  const ctx = await requireOrg(slug, "event.regie");
  const event = await prisma.event.findFirst({ where: { id: eventId, organizationId: ctx.org.id }, select: { id: true } });
  if (!event) notFound();
  const links = await getEventLinks(event.id);
  const [snapshot, regie, videos] = await Promise.all([buildSnapshot(event.id, links.formUrl), getRegieState(event.id), listEventVideos(event.id)]);
  if (!snapshot) notFound();

  return (
    <RegieClient
      snapshot={snapshot}
      initialRegie={regie}
      links={{ formUrl: links.formUrl, displayUrl: links.displayUrl }}
      isSuperAdmin={ctx.user.platformRole === "SUPER_ADMIN"}
      organizationId={ctx.org.id}
      blobEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
      initialVideos={videos}
      backHref={ctx.can("org.view") ? `/o/${slug}/events/${event.id}` : `/o/${slug}`}
    />
  );
}
