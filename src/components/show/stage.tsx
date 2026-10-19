"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import confetti from "canvas-confetti";
import { blockToPixels, stageSize, type ShowBlock, type ShowConfig } from "@/lib/show/config";
import type { FormatId } from "@/lib/show/formats";
import { formatBlocks } from "@/lib/show/smart-layout";
import { getBackground, themeCssVars } from "@/lib/show/themes";
import { formatMoney, goalProgress } from "@/lib/money";
import type { LiveControl, LiveEventInfo, LiveVideo, PublicDonation } from "@/lib/live/types";
import { interludeRecap } from "@/lib/live/video";
import { placeBadge } from "@/lib/show/badge";
import { cn } from "@/lib/utils";
import { dictionaries } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { Ambient } from "./ambient";
import { Backdrop } from "./backdrop";
import { typo } from "./fit";
import { ShowBlockContent, type BlockContext } from "./blocks";
import { VideoInterlude, type VideoReport } from "./video-interlude";

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
  /** Appareil peu puissant (téléphone) : effets décoratifs coupés pour préserver la mémoire. */
  lowPower?: boolean;
  /**
   * Format d'écran (16:9 par défaut) : dimensions de la surface et mise en page du format
   * (personnalisée, ou dérivée du 16:9). Changer de format ne remonte pas la scène : l'état
   * du direct (compteur, confettis, mise en lumière…) est conservé.
   */
  format?: FormatId;
  /** Nombre de promesses (récapitulatif affiché après un intermède vidéo). */
  count?: number;
  /**
   * Intermède vidéo : « screen » sur l'écran géant (son possible, fin et son bloqué signalés via
   * `onVideoReport`), « preview » ailleurs (aperçu muet).
   */
  videoMode?: "screen" | "preview";
  /** Gestes de l'utilisateur sur l'écran (0 : le navigateur refusera la lecture avec le son). */
  audioArmed?: number;
  onVideoReport?: (runId: string, report: VideoReport) => void;
  /** Badge « MODE TEST » / « APERÇU » : placé automatiquement là où il ne recouvre aucun bloc. */
  badge?: { label: string; tone: "test" | "draft" } | null;
  className?: string;
};

const MILESTONES = [25, 50, 75, 100];

/**
 * Surface du show (Layout Engine : 1920 × 1080 en 16:9, ou la surface du format d'écran)
 * + effets (Animation Engine).
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
  lowPower = false,
  format = "16:9",
  count,
  videoMode = "preview",
  audioArmed = 0,
  onVideoReport,
  badge = null,
  className,
}: ShowStageProps) {
  const locale = event.locale;
  const rtl = locale === "he";
  const stage = stageSize(format);
  const blocks = useMemo(() => formatBlocks(config, format, rtl), [config, format, rtl]);
  // Surimpressions (projecteur, objectif atteint, message) : réduites sur les surfaces étroites.
  const k = Math.min(1, stage.width / 1600);
  const t = dictionaries[locale].show;
  const theme = getBackground(config.theme);
  // ─── Intermède vidéo ───
  // Fin locale (fichier terminé sur cet écran) : on n'attend pas l'aller-retour serveur.
  const [endedRun, setEndedRun] = useState<string | null>(null);
  const liveVideo = control.video ?? null;
  const video = liveVideo && liveVideo.id !== endedRun ? liveVideo : null;
  const videoActive = video !== null;
  const [leavingVideo, setLeavingVideo] = useState<LiveVideo | null>(null);
  const [recap, setRecap] = useState<{ key: string; count: number; amount: number } | null>(null);
  // Pendant la vidéo : pas de confettis, projecteur ni paliers (les promesses continuent d'arriver).
  const animate = !control.paused && !videoActive;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<confetti.CreateTypes | null>(null);
  // ─── Live → état d'affichage (ajusté pendant le rendu, sans effet en cascade) ───
  const [tracked, setTracked] = useState<{ effect: ShowEffect | null; total: number; goal: number; video: LiveVideo | null }>({
    effect: effect ?? null,
    total,
    goal: event.goalAmount,
    video,
  });
  const [highlight, setHighlight] = useState<{ id: string; key: number } | null>(null);
  const [spotQueue, setSpotQueue] = useState<PublicDonation[]>([]);
  const [banner, setBanner] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<{ key: number; big: boolean } | null>(null);

  if (tracked.effect !== (effect ?? null) || tracked.total !== total || tracked.goal !== event.goalAmount || tracked.video?.id !== video?.id) {
    const prev = tracked;
    setTracked({ effect: effect ?? null, total, goal: event.goalAmount, video });
    if (prev.video?.id !== video?.id) {
      if (video) {
        // Début de l'intermède : les surimpressions en cours sont abandonnées.
        setSpotQueue([]);
        setBanner(null);
        setLeavingVideo(null);
        setRecap(null);
      } else if (prev.video) {
        // Retour à la scène : fondu de sortie, puis récapitulatif des promesses arrivées pendant la vidéo.
        setLeavingVideo(prev.video);
        const summary = count === undefined || editing ? null : interludeRecap(prev.video, total, count);
        setRecap(summary ? { key: prev.video.id, ...summary } : null);
      }
    }
    if (effect && effect !== prev.effect && !videoActive) {
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
    if (!effect || videoActive) return;
    if (effect.kind === "donation" && !control.paused) pulseTotal();
    if (effect.kind === "celebrate") {
      burst("big");
      pulseTotal();
    }
    if (effect.kind === "goal") burst("big");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect?.id]);

  useEffect(() => {
    if (milestone && !videoActive) burst(milestone.big ? "big" : "small");
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
    if (!leavingVideo) return;
    const timer = window.setTimeout(() => setLeavingVideo(null), 750);
    return () => window.clearTimeout(timer);
  }, [leavingVideo]);

  useEffect(() => {
    if (!recap) return;
    const timer = window.setTimeout(() => setRecap(null), 6500);
    return () => window.clearTimeout(timer);
  }, [recap]);

  // Confettis en cours effacés au lancement d'une vidéo.
  const videoId = video?.id ?? null;
  useEffect(() => {
    if (videoId) confettiRef.current?.reset();
  }, [videoId]);

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
      dir={rtl ? "rtl" : "ltr"}
      lang={locale}
      data-format={format}
      className={`show-root relative overflow-hidden ${lowPower ? "show-lowpower" : ""} ${className ?? ""}`}
      style={{ width: stage.width, height: stage.height, ...(cssVars as React.CSSProperties) }}
    >
      {/* Arrière-plan de la bibliothèque : décor statique (composé pour le format) + ambiance animée légère. */}
      <Backdrop theme={theme.id} width={stage.width} height={stage.height} />
      <Ambient kind={theme.ambient} enabled={config.animation.ambient && !control.paused && !lowPower && !videoActive} />

      {blocks.map((block) => {
        if (!block.visible && !wrapBlock) return null;
        const px = blockToPixels(block, stage);
        const content = <ShowBlockContent block={block} width={px.width} height={px.height} ctx={ctx} />;
        if (wrapBlock) return <Fragment key={block.type}>{wrapBlock(block, content)}</Fragment>;
        return (
          <div key={block.type} data-block={block.type} className="absolute" style={{ left: px.left, top: px.top, width: px.width, height: px.height }}>
            {content}
          </div>
        );
      })}

      {/* Mise en lumière plein écran d'une promesse */}
      {spotlight && <Spotlight key={spotlight.id} donation={spotlight} event={event} label={t.newPromise} k={k} />}

      {/* Objectif atteint */}
      {goalBanner && (
        <div className="show-spotlight-backdrop pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div
            className="show-card-solid animate-in zoom-in-50 fade-in duration-700 text-center"
            style={{ borderRadius: 48 * k, padding: `${64 * k}px ${112 * k}px`, maxWidth: stage.width * 0.92 }}
          >
            <div className="show-display show-accent-text font-bold text-balance" style={{ fontSize: 150 * k, lineHeight: 1.05 }}>
              {t.goalReached}
            </div>
            <div className="tabular font-extrabold" style={{ fontSize: 80 * k, marginTop: 24 * k }}>
              {formatMoney(total, event.currency, locale)}
            </div>
          </div>
        </div>
      )}

      {/* Message de la régie */}
      {control.overlay && (
        <div key={control.overlayAt ?? "overlay"} className="pointer-events-none absolute inset-x-0 bottom-[6%] z-40 flex justify-center px-[8%]">
          <div
            className="show-card-solid animate-in slide-in-from-bottom-10 fade-in duration-700 text-center"
            style={{ borderRadius: 32 * k, padding: `${32 * k}px ${64 * k}px` }}
          >
            <p className="show-display text-balance font-semibold" style={{ fontSize: 64 * k, lineHeight: 1.15 }}>
              {typo(control.overlay, locale)}
            </p>
          </div>
        </div>
      )}

      {/* Récapitulatif au retour d'un intermède vidéo */}
      {recap && !video && (
        <div key={`recap:${recap.key}`} data-video-recap className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="show-recap-backdrop absolute inset-0" aria-hidden />
          <div className="show-card-solid show-recap relative text-center" style={{ borderRadius: 40 * k, padding: `${44 * k}px ${88 * k}px`, maxWidth: stage.width * 0.9 }}>
            <div className="font-bold uppercase" style={{ fontSize: 28 * k, letterSpacing: "0.3em", color: "var(--show-accent)" }}>
              {t.videoRecapTitle}
            </div>
            <div className="show-display font-semibold text-balance" style={{ fontSize: 72 * k, lineHeight: 1.1, marginTop: 18 * k }}>
              {recap.count === 1 ? t.videoRecapOne : fmt(t.videoRecapMany, { count: recap.count })}
              <span className="opacity-50"> · </span>
              <span className="tabular show-accent-text font-extrabold">{formatMoney(recap.amount, event.currency, locale)}</span>
            </div>
          </div>
        </div>
      )}

      {badge && <StageBadge badge={badge} blocks={blocks} stage={stage} />}

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30 size-full" />

      {/* Intermède vidéo plein écran : au-dessus de tout (surimpressions, confettis, badge). */}
      {(video ?? leavingVideo) && (
        <VideoInterlude
          key={`video:${(video ?? leavingVideo)!.id}`}
          video={(video ?? leavingVideo)!}
          leaving={!video}
          stage={stage}
          mode={editing ? "preview" : videoMode}
          audioArmed={audioArmed}
          lowPower={lowPower}
          label={t.videoPlaying}
          onEnded={setEndedRun}
          onReport={onVideoReport}
        />
      )}
    </div>
  );
}

function StageBadge({ badge, blocks, stage }: { badge: { label: string; tone: "test" | "draft" }; blocks: ShowBlock[]; stage: { width: number; height: number } }) {
  const rects = blocks.filter((b) => b.visible).map((b) => blockToPixels(b, stage));
  const slot = placeBadge(badge.label, rects, stage, Math.round(Math.max(18, Math.min(26, stage.height / 46))));
  return (
    <div
      data-screen-badge
      className={cn(
        "pointer-events-none absolute z-[45] flex items-center justify-center whitespace-nowrap rounded-full font-bold shadow-lg",
        badge.tone === "test" ? "bg-amber-400 text-black" : "bg-white/85 text-black",
      )}
      style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height, fontSize: slot.fontSize, letterSpacing: "0.2em" }}
    >
      {badge.label}
    </div>
  );
}

function Spotlight({ donation, event, label, k }: { donation: PublicDonation; event: LiveEventInfo; label: string; k: number }) {
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
    <div ref={ref} className="show-spotlight-backdrop pointer-events-none absolute inset-0 z-40 flex items-center justify-center" style={{ perspective: 1200 }}>
      <div
        data-card
        className="show-card-solid text-center"
        style={{ minWidth: 900 * k, maxWidth: 1500 * k, borderRadius: 48 * k, padding: `${80 * k}px ${112 * k}px` }}
      >
        <div data-line className="font-bold uppercase" style={{ fontSize: 32 * k, letterSpacing: "0.3em", color: "var(--show-accent)" }}>
          {label}
        </div>
        <div
          data-line
          className="show-display font-semibold text-balance break-words"
          style={{ fontSize: (donation.donorName.length > 28 ? 80 : 110) * k, lineHeight: 1.05, marginTop: 24 * k }}
        >
          {donation.donorName}
        </div>
        <div data-line className="tabular show-accent-text font-extrabold" style={{ fontSize: 150 * k, lineHeight: 1, marginTop: 24 * k }}>
          {formatMoney(donation.amount, event.currency, locale)}
        </div>
        <div data-line className="show-display italic" style={{ fontSize: 40 * k, color: "var(--show-accent)", marginTop: 32 * k }}>
          {event.name}
        </div>
      </div>
    </div>
  );
}
