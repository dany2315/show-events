import Link from "next/link";
import { ArrowRight, Check, LayoutTemplate, MonitorPlay, QrCode, RadioTower, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HeroDemo } from "@/components/landing/hero-demo";
import { ThemeGallery } from "@/components/landing/theme-gallery";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { getI18n } from "@/i18n/server";
import { PLAN_CATALOG } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export default async function LandingPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const l = t.landing;

  const features = [
    { icon: LayoutTemplate, title: l.featureStudioTitle, text: l.featureStudioText },
    { icon: RadioTower, title: l.featureRegieTitle, text: l.featureRegieText },
    { icon: QrCode, title: l.featureMobileTitle, text: l.featureMobileText },
    { icon: MonitorPlay, title: l.featureScreenTitle, text: l.featureScreenText },
  ];
  const steps = [
    { title: l.how1Title, text: l.how1Text },
    { title: l.how2Title, text: l.how2Text },
    { title: l.how3Title, text: l.how3Text },
  ];
  const faq = [
    [l.faq1Q, l.faq1A],
    [l.faq2Q, l.faq2A],
    [l.faq3Q, l.faq3A],
    [l.faq4Q, l.faq4A],
  ];
  const ctaHref = user ? "/app" : "/login";

  return (
    <div className="min-h-screen bg-ink text-white">
      {/* En-tête */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label={t.common.appName}>
            <Brand tone="light" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/65 md:flex">
            <a href="#fonctionnalites" className="transition-colors hover:text-white">{l.navFeatures}</a>
            <a href="#styles" className="transition-colors hover:text-white">{l.navThemes}</a>
            <a href="#tarifs" className="transition-colors hover:text-white">{l.navPricing}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher tone="dark" className="hidden sm:inline-flex" />
            <Button asChild size="lg" className="rounded-full bg-white px-4 text-ink hover:bg-white/90">
              <Link href={ctaHref}>{user ? l.navDashboard : l.navLogin}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 75% 15%, rgba(228,182,92,0.20), transparent 60%), radial-gradient(40% 40% at 10% 80%, rgba(110,80,220,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:pb-28 lg:pt-24">
          <div className="fl-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-[#f1d593]">
              <Sparkles className="size-3.5" />
              {l.badge}
            </span>
            <h1 className="mt-6 font-display text-[44px] leading-[1.02] tracking-tight sm:text-6xl lg:text-[68px]">
              {l.heroTitle1}
              <br />
              <span className="gold-text italic">{l.heroTitle2}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{l.heroText}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-gold px-6 text-base font-semibold text-ink hover:bg-[#e3b45c]">
                <Link href={ctaHref}>
                  {l.heroCta}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base text-white hover:bg-white/10 hover:text-white">
                <a href="#styles">{l.heroCta2}</a>
              </Button>
            </div>
            <p className="mt-6 text-sm text-white/45">{l.heroNote}</p>
          </div>

          <div className="relative fl-rise [animation-delay:150ms]">
            <div className="absolute -inset-10 rounded-[40px] bg-gold/10 blur-3xl" />
            <div className="relative rounded-[26px] border border-white/10 bg-[#0b0910] p-2.5 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)] [transform:perspective(1800px)_rotateY(-6deg)_rotateX(3deg)] rtl:[transform:perspective(1800px)_rotateY(6deg)_rotateX(3deg)]">
              <div className="overflow-hidden rounded-[18px]">
                <div className="aspect-video">
                  <HeroDemo className="size-full" />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 pb-1 pt-3 text-xs text-white/50">
                <span className="inline-flex items-center gap-2">
                  <span className="live-dot" /> {t.common.live}
                </span>
                <span dir="ltr">1920 × 1080 · 4K</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-7xl grid-cols-3 gap-4 border-t border-white/[0.06] px-5 py-8 sm:px-8">
          {[
            [l.statsLatencyValue, l.statsLatency],
            [l.statsScreensValue, l.statsScreens],
            [l.statsCurrenciesValue, l.statsCurrencies],
          ].map(([value, label]) => (
            <div key={label} className="text-center sm:text-start">
              <div className="font-display text-2xl text-white sm:text-3xl">{value}</div>
              <div className="mt-1 text-xs text-white/50 sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{l.featuresKicker}</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">{l.featuresTitle}</h2>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {features.map(({ icon: Icon, title, text }, i) => (
              <article
                key={title}
                className="group relative overflow-hidden rounded-3xl border bg-card p-8 transition-shadow hover:shadow-[0_30px_80px_-40px_rgba(20,17,31,0.35)]"
              >
                <div className="absolute -end-10 -top-10 size-40 rounded-full bg-gold-soft opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-start gap-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-gold">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">0{i + 1}</div>
                    <h3 className="mt-1 text-xl font-semibold">{title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Étapes */}
          <div className="mt-28 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{l.howKicker}</p>
              <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{l.howTitle}</h2>
            </div>
            <ol className="grid gap-4">
              {steps.map((step, i) => (
                <li key={step.title} className="flex gap-5 rounded-3xl border bg-card p-6">
                  <span className="font-display text-4xl leading-none text-gold">{i + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Styles */}
      <section id="styles" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(228,182,92,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{l.themesKicker}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-4xl leading-tight sm:text-5xl">{l.themesTitle}</h2>
            <p className="max-w-md text-white/60">{l.themesText}</p>
          </div>
          <div className="mt-12">
            <ThemeGallery />
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">{l.pricingKicker}</p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{l.pricingTitle}</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
            {[
              {
                title: l.pricingEventTitle,
                price: formatMoney(PLAN_CATALOG.EVENT_PASS.price, "EUR", locale),
                period: l.pricingEventPeriod,
                features: [l.pricingEventF1, l.pricingEventF2, l.pricingEventF3, l.pricingEventF4],
                featured: false,
              },
              {
                title: l.pricingProTitle,
                price: formatMoney(PLAN_CATALOG.PRO_MONTHLY.price, "EUR", locale),
                period: l.pricingProPeriod,
                features: [l.pricingProF1, l.pricingProF2, l.pricingProF3, l.pricingProF4],
                featured: true,
              },
            ].map((plan) => (
              <div
                key={plan.title}
                className={
                  plan.featured
                    ? "relative rounded-3xl bg-ink p-8 text-white shadow-[0_40px_100px_-40px_rgba(20,17,31,0.7)]"
                    : "rounded-3xl border bg-card p-8"
                }
              >
                {plan.featured && <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />}
                <h3 className="text-lg font-semibold">{plan.title}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="tabular text-5xl font-bold tracking-tight">{plan.price}</span>
                  <span className={plan.featured ? "text-white/60" : "text-muted-foreground"}>{plan.period}</span>
                </div>
                <ul className="mt-8 grid gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3">
                      <Check className="size-4 shrink-0 text-gold" />
                      <span className={plan.featured ? "text-white/85" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  className={
                    plan.featured
                      ? "mt-8 h-11 w-full rounded-full bg-gold text-ink hover:bg-[#e3b45c]"
                      : "mt-8 h-11 w-full rounded-full"
                  }
                  variant={plan.featured ? "default" : "outline"}
                >
                  <a href="mailto:contact@fundraising.live">{l.pricingCta}</a>
                </Button>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">{l.pricingNote}</p>

          {/* FAQ */}
          <div className="mx-auto mt-24 max-w-3xl">
            <h2 className="text-center font-display text-4xl">{l.faqTitle}</h2>
            <div className="mt-10 divide-y rounded-3xl border bg-card">
              {faq.map(([q, a]) => (
                <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium">
                    {q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_100%,rgba(228,182,92,0.22),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
          <h2 className="font-display text-4xl leading-tight sm:text-6xl">{l.finalTitle}</h2>
          <p className="mt-4 text-lg text-white/65">{l.finalText}</p>
          <Button asChild size="lg" className="mt-9 h-12 rounded-full bg-gold px-7 text-base font-semibold text-ink hover:bg-[#e3b45c]">
            <Link href={ctaHref}>
              {l.heroCta}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <footer className="relative border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-white/45 sm:flex-row sm:px-8">
            <Brand tone="light" />
            <p>{l.footer}</p>
            <LocaleSwitcher tone="dark" />
          </div>
        </footer>
      </section>
    </div>
  );
}
