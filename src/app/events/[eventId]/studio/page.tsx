import { StudioClient } from "@/features/studio-client";

export const instant = false;

export default async function StudioPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <StudioClient eventId={eventId} />;
}
