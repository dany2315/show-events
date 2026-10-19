import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { requireSuperAdmin } from "@/lib/dal";
import { getI18n } from "@/i18n/server";
import { NewOrgForm } from "./new-org-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.newOrg };
}

export default async function NewOrganizationPage() {
  await requireSuperAdmin();
  const { t } = await getI18n();
  return (
    <PageContainer className="max-w-3xl">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t.admin.title}
      </Link>
      <PageHeader className="mt-4" title={t.admin.newOrgTitle} description={t.admin.newOrgSubtitle} />
      <NewOrgForm />
    </PageContainer>
  );
}
