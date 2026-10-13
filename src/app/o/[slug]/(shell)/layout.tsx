import { notFound } from "next/navigation";
import { OrgShell } from "@/components/app/org-shell";
import { getOrgContext, listUserOrganizations, requireUser } from "@/lib/dal";
import { getI18n } from "@/i18n/server";

export default async function OrgShellLayout({ children, params }: LayoutProps<"/o/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const [ctx, { t }, memberships] = await Promise.all([getOrgContext(slug), getI18n(), listUserOrganizations(user.id)]);
  if (!ctx) notFound();
  const roleLabel = ctx.memberRole ? t.roles[ctx.memberRole] : t.roles.SUPER_ADMIN;
  return (
    <OrgShell
      org={{ name: ctx.org.name, slug: ctx.org.slug, logoUrl: ctx.org.logoUrl, status: ctx.org.status }}
      user={{ name: user.name, email: user.email, isSuperAdmin: user.platformRole === "SUPER_ADMIN" }}
      roleLabel={roleLabel}
      isOperator={!ctx.can("org.view")}
      hasManyOrgs={memberships.length > 1}
    >
      {ctx.org.status === "SUSPENDED" && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm text-destructive">{t.dashboard.suspended}</div>
      )}
      {children}
    </OrgShell>
  );
}
