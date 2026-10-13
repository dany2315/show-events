import { DonateClient } from "@/features/donate-client";

export const instant = false;

export default async function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DonateClient slug={slug} />;
}
