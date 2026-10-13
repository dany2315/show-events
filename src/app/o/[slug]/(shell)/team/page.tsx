import { PageContainer, PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { TeamClient } from "./team-client";

export default async function TeamPage({ params }: PageProps<"/o/[slug]/team">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "org.team");
  const { t } = await getI18n();
  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.org.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
  });

  return (
    <PageContainer>
      <PageHeader title={t.team.title} description={t.team.subtitle} />
      <TeamClient
        organizationId={ctx.org.id}
        currentUserId={ctx.user.id}
        members={members.map((m) => ({ id: m.id, role: m.role, createdAt: m.createdAt.toISOString(), userId: m.user.id, name: m.user.name, email: m.user.email }))}
      />
    </PageContainer>
  );
}
