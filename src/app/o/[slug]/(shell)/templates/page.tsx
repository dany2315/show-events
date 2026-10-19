import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { EmptyState, PageContainer, PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { normalizeShowConfig } from "@/lib/show/config";
import { getI18n } from "@/i18n/server";
import { TemplatesClient } from "./templates-client";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.templates.title };
}

export default async function TemplatesPage({ params }: PageProps<"/o/[slug]/templates">) {
  const { slug } = await params;
  const ctx = await requireOrg(slug, "org.view");
  const { t } = await getI18n();
  const templates = await prisma.showTemplate.findMany({
    where: { organizationId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, config: true, createdAt: true },
  });

  return (
    <PageContainer>
      <PageHeader title={t.templates.title} description={t.templates.subtitle} />
      <div className="mt-8">
        {templates.length === 0 ? (
          <EmptyState icon={<LayoutTemplate className="size-6" />} title={t.templates.empty} text={t.templates.emptyText} />
        ) : (
          <TemplatesClient
            orgName={ctx.org.name}
            logoUrl={ctx.org.logoUrl}
            templates={templates.map((tpl) => ({ id: tpl.id, name: tpl.name, createdAt: tpl.createdAt.toISOString(), config: normalizeShowConfig(tpl.config) }))}
          />
        )}
      </div>
    </PageContainer>
  );
}
