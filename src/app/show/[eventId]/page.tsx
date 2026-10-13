import { ShowScreen } from "@/components/show-screen";

export const instant = false;

export default async function ShowPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <ShowScreen eventId={eventId} />;
}
