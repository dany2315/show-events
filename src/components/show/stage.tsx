"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import confetti from "canvas-confetti";
import { blockToPixels, STAGE_HEIGHT, STAGE_WIDTH, type ShowBlock, type ShowConfig } from "@/lib/show/config";
import { THEMES, themeCssVars } from "@/lib/show/themes";
import { formatMoney, goalProgress } from "@/lib/money";
import type { LiveControl, LiveEventInfo, PublicDonation } from "@/lib/live/types";
import { dictionaries } from "@/i18n/dictionaries";
import { Ambient } from "./ambient";
import { typo } from "./fit";
import { ShowBlockContent, type BlockContext } from "./blocks";

export type ShowEffect =
  | { id: number; kind: "donation"; donation: PublicDonation }
  | { id: number; kind: "celebrate" }
  | { id: number; kind: "goal" };

export type ShowStageProps = {
  config: ShowConfig;
  event: LiveEventInfo;
  total: number;
  donations: PublicDonation[];
  control: LiveControl;
  formUrl: string | null;
  effect?: ShowEffect | null;
  editing?: boolean;
  /** Dans l'éditeur, chaque bloc est enveloppé (déplacement / redimensionnement). */
  wrapBlock?: (block: ShowBlock, content: React.ReactNode) => React.ReactNode;
  className?: string;
};

const MILESTONES = [25, 50, 75, 100];

/**
 * Surface du show en 1920 × 1080 (Layout Engine) + effets (Animation Engine).
 * L'état vivant (total, dons, pilotage) est fourni par le Live State Engine (useLiveEvent).
 */
export function ShowStage({
  config,
  event,
  total,
  donations,
  control,
  formUrl,
  effect,
  editing = false,
  wrapBlock,
  className,
}: ShowStageProps) {
  const locale = event.locale;
  const t = dictionaries[locale].show;
  const theme = THEMES[config.theme] ?? THEMES.gala;
  const animate = !control.paused;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<confetti.CreateTypes | null>(null);
  // ─── Live → état d'affichage (ajusté pendant le rendu, sans effet en cascade) ───
  const [tracked, setTracked] = useState<{ effect: ShowEffect | null; total: number; goal: number }>({
    effect: effect ?? null,
    total,
    goal: event.goalAmount,
  });
  const [highlight, setHighlight] = useState<{ id: string; key: number } | null>(null);
  const [spotQueue, setSpotQueue] = useState<PublicDonation[]>([]);
  const [banner, setBanner] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<{ key: number; big: boolean } | null>(null);

  if (tracked.effect !== (effect ?? null) || tracked.total !== total || tracked.goal !== event.goalAmount) {
    const prev = tracked;
    setTracked({ effect: effect ?? null, total, goal: event.goalAmount });
    if (effect && effect !== prev.effect) {
      if (effect.kind === "donation") {
        setHighlight({ id: effect.donation.id, key: effect.id });
        const threshold = config.animation.spotlightThreshold;
        const spot = config.animation.donation === "spotlight" || (threshold > 0 && effect.donation.amount >= threshold);
        if (animate && spot) setSpotQueue((q) => (q.length < 6 ? [...q, effect.donation] : q));
      }
      if (effect.kind === "goal") setBanner(effect.id);
    }
    // Paliers de l'objectif (25 / 50 / 75 / 100 %).
    if (prev.total !== total && prev.goal === event.goalAmount && !editing && animate && config.animation.milestones) {
      const before = goalProgress(prev.total, event.goalAmount);
      const after = goalProgress(total, event.goalAmount);
      const crossed = MILESTONES.filter((m) => before < m && after >= m);
      if (crossed.length > 0) {
        const big = crossed.includes(100);
        setMilestone({ key: total, big });
        if (big) setBanner(-total);
      }
    }
  }
  const highlightId = highlight?.id ?? null;
  const spotlight = spotQueue[0] ?? null;
  const goalBanner = banner !== null;

  useEffect(() => {
    if (!canvasRef.current) return;
    confettiRef.current = confetti.create(canvasRef.current, { resize: true, useWorker: true });
    return () => {
      confettiRef.current?.reset();
      confettiRef.current = null;
    };
  }, []);

  const colors = useCallback(() => {
    const style = stageRef.current ? getComputedStyle(stageRef.current) : null;
    const accent = style?.getPropertyValue("--show-accent").trim() || "#e4b65c";
    const accent2 = style?.getPropertyValue("--show-accent2").trim() || "#fff0c2";
    return [accent, accent2, "#ffffff"];
  }, []);

  const burst = useCallback(
    (power: "small" | "big") => {
      const fire = confettiRef.current;
      if (!fire) return;
      const palette = colors();
      if (power === "small") {
        fire({ particleCount: 90, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.55 }, colors: palette, scalar: 1.3 });
        return;
      }
      const end = Date.now() + 1800;
      const frame = () => {
        fire({ particleCount: 7, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: palette, scalar: 1.5, startVelocity: 70 });
        fire({ particleCount: 7, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: palette, scalar: 1.5, startVelocity: 70 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      fire({ particleCount: 220, spread: 160, startVelocity: 60, origin: { x: 0.5, y: 0.4 }, colors: palette, scalar: 1.4 });
    },
    [colors],
  );

  const pulseTotal = useCallback(() => {
    const el = stageRef.current?.querySelector<HTMLElement>("[data-total]");
    if (!el) return;
    gsap.fromTo(el, { scale: 1.06, filter: "brightness(1.5)" }, { scale: 1, filter: "brightness(1)", duration: 1.1, ease: "elastic.out(1, 0.5)" });
  }, []);

  // ─── Effets visuels (moteur d'animation) ───
  useEffect(() => {
    if (!effect) return;
    if (effect.kind === "donation" && !control.paused) pulseTotal();
    if (effect.kind === "celebrate") {
      burst("big");
      pulseTotal();
    }
    if (effect.kind === "goal") burst("big");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect?.id]);

  useEffect(() => {
    if (milestone) burst(milestone.big ? "big" : "small");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone?.key]);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight((h) => (h?.key === highlight.key ? null : h)), 6000);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  useEffect(() => {
    if (banner === null) return;
    const timer = window.setTimeout(() => setBanner(null), 5200);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (!spotlight) return;
    const timer = window.setTimeout(() => setSpotQueue((q) => q.slice(1)), 3850);
    return () => window.clearTimeout(timer);
  }, [spotlight]);

  const ctx: BlockContext = {
    config,
    event,
    total,
    donations,
    formUrl,
    locale,
    t,
    animate,
    highlightId,
    editing,
  };

  const cssVars = themeCssVars(config);

  return (
    <div
      ref={stageRef}
      dir={locale === "he" ? "rtl" : "ltr"}
      lang={locale}
      className={`show-root relative overflow-hidden ${className ?? ""}`}
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, ...(cssVars as React.CSSProperties) }}
    >
      {config.backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.backgroundImage} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          <div className="absolute inset-0" style={{ background: "var(--show-bg)", opacity: config.backgroundDim }} />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 40%, color-mix(in oklab, var(--show-bg) 70%, transparent))" }}
          />
        </>
      )}
      <Ambient kind={theme.ambient} enabled={config.animation.ambient && !control.paused} />

      {config.blocks.map((block) => {
        if (!block.visible && !wrapBlock) return null;
        const px = blockToPixels(block);
        const content = <ShowBlockContent block={block} width={px.width} height={px.height} ctx={ctx} />;
        if (wrapBlock) return <Fragment key={block.type}>{wrapBlock(block, content)}</Fragment>;
        return (
          <div key={block.type} className="absolute" style={{ left: px.left, top: px.top, width: px.width, height: px.height }}>
            {content}
          </div>
        );
      })}

      {/* Mise en lumière plein écran d'une promesse */}
      {spotlight && <Spotlight key={spotlight.id} donation={spotlight} event={event} label={t.newPromise} />}

      {/* Objectif atteint */}
      {goalBanner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--show-bg) 55%, transparent)" }}>
          <div className="animate-in zoom-in-50 fade-in duration-700 text-center">
            <div className="show-display show-accent-text font-bold" style={{ fontSize: 150, lineHeight: 1.05 }}>
              {t.goalReached}
            </div>
            <div className="tabular mt-6 font-extrabold" style={{ fontSize: 80 }}>
              {formatMoney(total, event.currency, locale)}
            </div>
          </div>
        </div>
      )}

      {/* Message de la régie */}
      {control.overlay && (
        <div key={control.overlayAt ?? "overlay"} className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center px-[8%]">
          <div
            className="show-panel animate-in slide-in-from-bottom-10 fade-in duration-700 rounded-[32px] px-16 py-8 text-center"
            style={{ borderColor: "var(--show-accent)" }}
          >
            <p className="show-display text-balance font-semibold" style={{ fontSize: 64, lineHeight: 1.15 }}>
              {typo(control.overlay, locale)}
            </p>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
    </div>
  );
}

function Spotlight({ donation, event, label }: { donation: PublicDonation; event: LiveEventInfo; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = event.locale;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.35 })
      .fromTo(card, { scale: 0.55, y: 60, rotateX: 25 }, { scale: 1, y: 0, rotateX: 0, duration: 0.9, ease: "back.out(1.6)" }, 0)
      .fromTo(el.querySelectorAll("[data-line]"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.6, ease: "power3.out" }, 0.25)
      .to(el, { opacity: 0, duration: 0.45, ease: "power2.in" }, 2.95);
    return () => {
      tl.kill();
    };
  }, [donation.id]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ background: "color-mix(in oklab, var(--show-bg) 72%, transparent)", perspective: 1200 }}>
      <div data-card className="show-panel rounded-[48px] px-28 py-20 text-center" style={{ borderColor: "var(--show-accent)", minWidth: 900 }}>
        <div data-line className="font-semibold uppercase" style={{ fontSize: 30, letterSpacing: "0.3em", color: "var(--show-muted)" }}>
          {label}
        </div>
        <div data-line className="show-display mt-6 font-semibold" style={{ fontSize: 110, lineHeight: 1.05 }}>
          {donation.donorName}
        </div>
        <div data-line className="tabular show-accent-text mt-6 font-extrabold" style={{ fontSize: 150, lineHeight: 1 }}>
          {formatMoney(donation.amount, event.currency, locale)}
        </div>
        <div data-line className="mt-8 show-display italic" style={{ fontSize: 40, color: "var(--show-accent)" }}>
          {event.name}
        </div>
      </div>
    </div>
  );
}
