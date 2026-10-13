import { RegieClient } from "@/features/regie-client";

export const instant = false;

export default async function RegiePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <RegieClient eventId={eventId} />;
}
