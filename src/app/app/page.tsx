import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { listUserOrganizations, requireUser } from "@/lib/dal";
import { getI18n } from "@/i18n/server";
import { SignOutButton } from "@/components/app/sign-out-button";

/** Aiguillage après connexion : Super Admin, association unique ou choix d'association. */
export default async function AppEntry() {
  const user = await requireUser();
  const { t } = await getI18n();
  const memberships = await listUserOrganizations(user.id);

  if (user.platformRole === "SUPER_ADMIN" && memberships.length === 0) redirect("/admin");
  if (memberships.length === 1 && user.platformRole !== "SUPER_ADMIN") redirect(`/o/${memberships[0].organization.slug}`);

  return (
    <div className="paper-grain flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <Brand />
      <div className="mt-10 w-full max-w-lg rounded-3xl border bg-card p-8 shadow-[0_30px_80px_-50px_rgba(20,17,31,0.5)]">
        <h1 className="font-display text-3xl">{memberships.length ? t.chooser.title : t.chooser.empty}</h1>
        <p className="mt-2 text-muted-foreground">{memberships.length ? t.chooser.subtitle : t.chooser.emptyHelp}</p>
        <div className="mt-8 grid gap-2">
          {user.platformRole === "SUPER_ADMIN" && (
            <Link href="/admin" className="flex items-center gap-4 rounded-2xl border bg-ink p-4 text-white transition-colors hover:bg-ink/90">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">★</span>
              <span className="flex-1 font-medium">{t.nav.superAdmin}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          )}
          {memberships.map(({ organization, role }) => (
            <Link
              key={organization.id}
              href={`/o/${organization.slug}`}
              className="flex items-center gap-4 rounded-2xl border p-4 transition-colors hover:border-gold/50 hover:bg-accent/40"
            >
              <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {organization.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={organization.logoUrl} alt="" className="size-full object-contain" />
                ) : (
                  <Building2 className="size-5 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{organization.name}</span>
                <span className="block text-xs text-muted-foreground">{t.roles[role]}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
            </Link>
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <SignOutButton variant="ghost" />
        </div>
      </div>
    </div>
  );
}
