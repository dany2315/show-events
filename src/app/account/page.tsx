import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/dal";
import { getI18n } from "@/i18n/server";
import { isDemoEmail } from "@/lib/demo-mode";
import { AccountForms } from "./account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.title };
}

export default async function AccountPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  return (
    <div className="paper-grain min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            <Brand />
          </Link>
          <LocaleSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <PageHeader title={t.account.title} description={t.account.subtitle} />
        <AccountForms
          name={user.name}
          email={user.email}
          roleLabel={user.platformRole === "SUPER_ADMIN" ? t.roles.SUPER_ADMIN : null}
          demo={isDemoEmail(user.email)}
        />
      </main>
    </div>
  );
}
