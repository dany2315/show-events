import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonitorPlay, Palette, RadioTower, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HeroDemo } from "@/components/landing/hero-demo";
import { DemoStartButton } from "@/components/demo/demo-start-button";
import { getCurrentUser } from "@/lib/dal";
import { findDemoSpaceOf } from "@/lib/demo";
import { isDemoMode } from "@/lib/demo-mode";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  if (!isDemoMode()) return {};
  const { t } = await getI18n();
  return { title: t.demo.pageKicker, description: t.demo.pageText };
}

/** Page d'accueil de la démo (mode démo uniquement) : présentation du parcours et lancement en un clic. */
export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  if (!isDemoMode()) notFound();
  const [{ t }, user, query] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  const existing = user ? await findDemoSpaceOf(user.id, user.email) : null;
  const error = query.erreur === "limite" ? t.demo.rateLimited : query.erreur === "indisponible" ? t.demo.unavailable : null;
  const d = t.demo;
  const steps = [
    { icon: MonitorPlay, title: d.step1Title, text: d.step1Text },
    { icon: Smartphone, title: d.step2Title, text: d.step2Text },
    { icon: RadioTower, title: d.step3Title, text: d.step3Text },
    { icon: Palette, title: d.step4Title, text: d.step4Text },
  ];

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label={t.common.appName}>
            <Brand tone="light" />
          </Link>
          <LocaleSwitcher tone="dark" />
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 80% 10%, rgba(228,182,92,0.20), transparent 60%), radial-gradient(40% 40% at 5% 90%, rgba(110,80,220,0.16), transparent 60%)",
          }}
        />
        <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:pt-20">
          <div className="fl-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-[#f1d593]">
              <Sparkles className="size-3.5" />
              {d.pageKicker}
            </span>
            <h1 className="mt-6 font-display text-[40px] leading-[1.05] tracking-tight sm:text-6xl">{d.pageTitle}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{d.pageText}</p>
            {error && (
              <p role="alert" data-demo-error className="mt-6 max-w-xl rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-[#f1d593]">
                {error}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <DemoStartButton label={existing ? d.resumeDemo : d.tryDemo} />
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-white/50">
              <ShieldCheck className="size-4 shrink-0 text-gold" />
              {d.pageNote}
            </p>
          </div>
          <div className="relative fl-rise [animation-delay:150ms]">
            <div className="absolute -inset-10 rounded-[40px] bg-gold/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0910] p-2 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]">
              <div className="aspect-video overflow-hidden rounded-[16px]">
                <HeroDemo theme="velours" className="size-full" interval={3800} />
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{d.stepsTitle}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-2xl text-white/35">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
