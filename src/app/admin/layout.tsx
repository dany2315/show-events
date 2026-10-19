import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/app/sign-out-button";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { isDemoMode } from "@/lib/demo-mode";
import { getI18n } from "@/i18n/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Déploiement de démonstration : pas d'espace Super Admin.
  if (isDemoMode()) notFound();
  const user = await requireSuperAdmin();
  const { t } = await getI18n();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Brand tone="light" />
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold sm:inline-flex">
              <ShieldCheck className="size-3.5" />
              {t.admin.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher tone="dark" />
            <Link href="/account" className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex">
              <UserRound className="size-4" />
              {user.name}
            </Link>
            <SignOutButton variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
