import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HeroDemo } from "@/components/landing/hero-demo";
import { getCurrentUser } from "@/lib/dal";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.submit };
}

export default async function LoginPage() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getI18n()]);
  if (user) redirect("/app");

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Brand />
          </Link>
          <LocaleSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-4xl leading-tight">{t.auth.loginTitle}</h1>
          <p className="mt-3 text-muted-foreground">{t.auth.loginSubtitle}</p>
          <LoginForm />
          <p className="mt-8 text-sm text-muted-foreground">
            {t.auth.noAccount}{" "}
            <a href="mailto:contact@fundraising.live" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t.auth.contact}
            </a>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(228,182,92,0.22),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-center gap-10 p-14">
          <div className="overflow-hidden rounded-[20px] border border-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
            <div className="aspect-video">
              <HeroDemo theme="gala" className="size-full" interval={4200} />
            </div>
          </div>
          <div className="max-w-md text-white">
            <ShieldCheck className="size-6 text-gold" />
            <h2 className="mt-4 font-display text-3xl">{t.auth.asideTitle}</h2>
            <p className="mt-3 leading-relaxed text-white/65">{t.auth.asideText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
