"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, MonitorPlay, Palette, RadioTower, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { DemoQr } from "./demo-bar";

/** Guide en 4 étapes du tableau de bord d'un espace de démo. */
export function DemoGuide({ formUrl, displayUrl, regieHref, studioHref }: { formUrl: string; displayUrl: string; regieHref: string; studioHref: string }) {
  const { t } = useI18n();
  const d = t.demo;
  const cardClass = "relative flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5";
  const actionClass = "mt-auto h-9 w-full rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white";
  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8" data-demo-guide>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(228,182,92,0.20),transparent_60%)]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-ink">
          <Sparkles className="size-3" />
          {d.badge}
        </span>
        <h2 className="mt-3 font-display text-3xl">{d.guideTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/60">{d.guideText}</p>

        <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <li className={cardClass}>
            <Step n={1} icon={<MonitorPlay className="size-4" />} title={d.step1Title} text={d.step1Text} />
            <Button asChild variant="outline" className={actionClass}>
              <a href={displayUrl} target="_blank" rel="noreferrer" data-demo-step-screen>
                <ExternalLink className="size-3.5" />
                {d.step1Action}
              </a>
            </Button>
          </li>
          <li className={cardClass}>
            <Step n={2} icon={<Smartphone className="size-4" />} title={d.step2Title} text={d.step2Text} />
            <div className="mb-4 flex items-center gap-3">
              <DemoQr url={formUrl} className="size-24 shrink-0" />
              <a href={formUrl} target="_blank" rel="noreferrer" className="text-xs text-gold underline-offset-4 hover:underline" data-demo-step-form>
                {d.openFormHere}
              </a>
            </div>
          </li>
          <li className={cardClass}>
            <Step n={3} icon={<RadioTower className="size-4" />} title={d.step3Title} text={d.step3Text} />
            <Button asChild className="mt-auto h-9 w-full rounded-full bg-gold font-semibold text-ink hover:bg-[#e3b45c]">
              <Link href={regieHref} data-demo-step-regie>
                {d.step3Action}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </Button>
          </li>
          <li className={cardClass}>
            <Step n={4} icon={<Palette className="size-4" />} title={d.step4Title} text={d.step4Text} />
            <Button asChild variant="outline" className={actionClass}>
              <Link href={studioHref}>
                {d.step4Action}
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </Link>
            </Button>
          </li>
        </ol>
      </div>
    </section>
  );
}

function Step({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-gold/15 text-gold">{icon}</span>
        <span className="font-display text-xl text-white/35">0{n}</span>
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/60">{text}</p>
    </div>
  );
}
