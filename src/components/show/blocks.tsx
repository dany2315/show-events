"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import QRCode from "qrcode";
import { formatMoney } from "@/lib/money";
import type { AppLocale, CurrencyCode } from "@/lib/constants";
import type { DonationAnimation, ShowBlock, ShowConfig } from "@/lib/show/config";
import type { LiveEventInfo, PublicDonation } from "@/lib/live/types";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";
import { AnimatedAmount } from "./animated-amount";
import { fitFontSize, initials, typo } from "./fit";

export type BlockContext = {
  config: ShowConfig;
  event: LiveEventInfo;
  total: number;
  donations: PublicDonation[];
  formUrl: string | null;
  locale: AppLocale;
  t: Dictionary["show"];
  animate: boolean;
  highlightId: string | null;
  /** Mode éditeur : affiche des contenus d'exemple pour les blocs vides. */
  editing: boolean;
};

type BlockProps = { block: ShowBlock; width: number; height: number; ctx: BlockContext };

const justify = { start: "flex-start", center: "center", end: "flex-end" } as const;

export function ShowBlockContent(props: BlockProps) {
  switch (props.block.type) {
    case "logo":
      return <LogoBlock {...props} />;
    case "title":
      return <TitleBlock {...props} />;
    case "total":
      return <TotalBlock {...props} />;
    case "goal":
      return <GoalBlock {...props} />;
    case "donations":
      return <DonationsBlock {...props} />;
    case "message":
      return <MessageBlock {...props} />;
    case "qrcode":
      return <QrBlock {...props} />;
    case "categories":
      return <CategoriesBlock {...props} />;
  }
}

/**
 * Totaux par catégorie de donateurs : une carte par catégorie (pastille de couleur, nom, total).
 * Côte à côte dans un bandeau, l'une sous l'autre dans une colonne. Couleurs du show (--show-*),
 * la couleur de la catégorie ne sert qu'aux accents : lisible sur tous les arrière-plans.
 */
function CategoriesBlock({ block, width, height, ctx }: BlockProps) {
  const categories = ctx.event.categories ?? [];
  if (categories.length === 0) {
    if (!ctx.editing) return null;
    return (
      <div
        className="flex size-full items-center justify-center rounded-[24px] border-2 border-dashed px-[4%] text-center"
        style={{ borderColor: "var(--show-panel-border)", color: "var(--show-muted)", fontSize: Math.max(14, Math.min(height * 0.18, width * 0.03)) }}
      >
        {dictionaries[ctx.locale].studio.categoriesEmpty}
      </div>
    );
  }
  const row = width / height >= 2.4;
  const n = categories.length;
  const gap = Math.min(width, height) * (row ? 0.12 : 0.05);
  const cardW = row ? (width - gap * (n - 1)) / n : width;
  const cardH = row ? height : (height - gap * (n - 1)) / n;
  const longest = Math.max(...categories.map((c) => formatMoney(c.total, ctx.event.currency, ctx.locale).length), 5);
  const amountFs = Math.min(cardH * (row ? 0.42 : 0.4), (cardW * 0.82) / (longest * 0.6)) * block.fontScale;
  const nameFs = Math.max(12, Math.min(cardH * 0.2, amountFs * 0.42));
  const pad = Math.min(cardW, cardH) * 0.14;
  return (
    <div data-categories className="flex size-full" style={{ flexDirection: row ? "row" : "column", gap }}>
      {categories.map((c) => (
        <div
          key={c.id}
          data-category={c.name}
          className="show-panel relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-[22px]"
          style={{
            paddingInline: pad,
            alignItems: justify[block.align],
            textAlign: block.align,
            backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${c.color} 24%, transparent), transparent 65%)`,
          }}
        >
          <span aria-hidden className="absolute inset-y-0 start-0" style={{ width: Math.max(4, pad * 0.28), background: c.color }} />
          <span className="flex max-w-full items-center font-semibold uppercase" style={{ fontSize: nameFs, gap: nameFs * 0.5, letterSpacing: "0.16em", color: "var(--show-muted)" }}>
            <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: nameFs * 0.62, height: nameFs * 0.62, background: c.color, boxShadow: `0 0 ${nameFs}px ${c.color}` }} />
            <span className="truncate">{c.name}</span>
          </span>
          <span data-category-total className="tabular block font-extrabold leading-none whitespace-nowrap" style={{ fontSize: amountFs, marginTop: nameFs * 0.45 }}>
            <AnimatedAmount
              value={c.total}
              currency={ctx.event.currency}
              locale={ctx.locale}
              animate={ctx.animate && ctx.config.animation.counter === "roll"}
              className="inline-block"
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function LogoBlock({ block, width, height, ctx }: BlockProps) {
  const logo = ctx.event.logoUrl;
  if (logo) {
    return (
      <div className="flex size-full items-center" style={{ justifyContent: justify[block.align] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={ctx.event.organizationName} className="max-h-full max-w-full object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.35)]" draggable={false} />
      </div>
    );
  }
  const size = Math.min(width, height);
  return (
    <div className="flex size-full items-center gap-[4%]" style={{ justifyContent: justify[block.align] }}>
      <div
        className="flex shrink-0 items-center justify-center rounded-full show-display"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          border: `${Math.max(2, size * 0.018)}px solid var(--show-accent)`,
          color: "var(--show-accent)",
          fontSize: size * 0.24 * block.fontScale,
          boxShadow: "0 0 40px color-mix(in oklab, var(--show-accent) 35%, transparent)",
        }}
      >
        {initials(ctx.event.organizationName)}
      </div>
      {width > size * 1.6 && (
        <div className="show-display leading-tight" style={{ fontSize: size * 0.14 * block.fontScale, maxWidth: width - size * 0.7 }}>
          {ctx.event.organizationName}
        </div>
      )}
    </div>
  );
}

function TitleBlock({ block, width, height, ctx }: BlockProps) {
  const title = typo(ctx.event.name, ctx.locale);
  const subtitle = typo(ctx.config.texts.subtitle, ctx.locale);
  const titleBox = subtitle ? height * 0.7 : height;
  const fs = fitFontSize(title, width, titleBox, { max: height * 0.42, charWidth: 0.52, lineHeight: 1.05, maxLines: 4 }) * block.fontScale;
  const subFs = subtitle ? fitFontSize(subtitle, width, height * 0.26, { max: height * 0.11, charWidth: 0.5, maxLines: 2 }) * block.fontScale : 0;
  return (
    <div className="flex size-full flex-col justify-center" style={{ textAlign: block.align, alignItems: justify[block.align] }}>
      <div role="heading" aria-level={2} className="show-display font-semibold text-balance" style={{ fontSize: fs, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      {subtitle && (
        <p className="show-display italic text-balance" style={{ fontSize: subFs, marginTop: subFs * 0.45, color: "var(--show-accent)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function TotalBlock({ block, width, height, ctx }: BlockProps) {
  const label = ctx.config.texts.totalLabel || ctx.t.totalLabel;
  const labelFs = Math.max(14, height * 0.1) * block.fontScale;
  const text = formatMoney(ctx.total, ctx.event.currency, ctx.locale);
  const amountFs = Math.min(height * 0.62, width / (Math.max(text.length, 6) * 0.6)) * block.fontScale;
  return (
    <div className="flex size-full flex-col justify-center" style={{ textAlign: block.align, alignItems: justify[block.align] }}>
      <div className="font-semibold uppercase" style={{ fontSize: labelFs, letterSpacing: "0.24em", color: "var(--show-muted)" }}>
        {label}
      </div>
      <div data-total className="tabular font-extrabold leading-none" style={{ fontSize: amountFs, marginTop: labelFs * 0.35 }}>
        <AnimatedAmount
          value={ctx.total}
          currency={ctx.event.currency}
          locale={ctx.locale}
          animate={ctx.animate && ctx.config.animation.counter === "roll"}
          className="show-accent-text inline-block"
          style={{ paddingBottom: "0.06em" }}
        />
      </div>
    </div>
  );
}

function GoalBlock({ block, width, height, ctx }: BlockProps) {
  return <GoalFigures goal={ctx.event.goalAmount} currency={ctx.event.currency} locale={ctx.locale} t={ctx.t} width={width} height={height} fontScale={block.fontScale} />;
}

/**
 * Objectif du show : uniquement le montant de l'objectif (aucune barre, jauge ni pourcentage).
 * Le montant collecté est celui du bloc « Montant total ».
 * Partagé avec les vignettes d'arrière-plan (éléments `span`, utilisables dans un bouton).
 */
export function GoalFigures({
  goal,
  currency,
  locale,
  t,
  width,
  height,
  fontScale = 1,
}: {
  goal: number;
  currency: CurrencyCode;
  locale: AppLocale;
  t: Pick<Dictionary["show"], "goalLabel">;
  width: number;
  height: number;
  fontScale?: number;
}) {
  const goalText = formatMoney(goal, currency, locale);
  const valueFs = Math.min(height * 0.55, width / (Math.max(goalText.length, 6) * 0.62)) * fontScale;
  const labelFs = Math.max(10, Math.min(valueFs * 0.4, width / (t.goalLabel.length * 0.82)));
  return (
    <span data-goal className="flex size-full flex-col items-center justify-center text-center">
      <span className="block font-semibold uppercase whitespace-nowrap" style={{ fontSize: labelFs, letterSpacing: "0.24em", color: "var(--show-muted)" }}>
        {t.goalLabel}
      </span>
      <span className="tabular block font-bold leading-none whitespace-nowrap" style={{ fontSize: valueFs, marginTop: labelFs * 0.4 }}>
        {goalText}
      </span>
    </span>
  );
}

const DonationsBlock = memo(function DonationsBlock({ block, width, height, ctx }: BlockProps) {
  const { count } = ctx.config.donations;
  const label = ctx.config.texts.donationsLabel || ctx.t.donationsLabel;
  const list = ctx.donations.slice(0, count);
  const pad = Math.min(width, height) * 0.06;
  const labelFs = Math.max(14, Math.min(height * 0.06, 34)) * block.fontScale;
  const innerH = height - pad * 2 - labelFs * 1.9;
  const fontFor = (cols: number) => Math.min((innerH / Math.ceil(count / cols)) * 0.42, ((width - pad * 2 - (cols - 1) * pad) / cols) * 0.06);
  // Deux colonnes demandées dans un bloc étroit (colonne étroite…) : une seule colonne si le texte
  // y est nettement plus grand. Les dispositions 16:9 habituelles gardent leurs deux colonnes.
  const columns = ctx.config.donations.columns === 2 && fontFor(1) > fontFor(2) * 1.15 ? 1 : ctx.config.donations.columns;
  const rowsPerCol = Math.ceil(count / columns);
  const fs = fontFor(columns) * block.fontScale;
  const listRef = useRef<HTMLDivElement>(null);
  const known = useRef<Set<string> | null>(null);
  const style = ctx.config.animation.donation;
  const categoryColor = (id: string | null | undefined) => (id ? (ctx.event.categories?.find((c) => c.id === id)?.color ?? null) : null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ids = new Set(list.map((d) => d.id));
    if (known.current === null) {
      known.current = ids;
      return;
    }
    const fresh = list.filter((d) => !known.current!.has(d.id));
    known.current = ids;
    if (!ctx.animate || fresh.length === 0 || fresh.length > 4) return;
    for (const d of fresh) {
      const row = el.querySelector<HTMLElement>(`[data-donation="${CSS.escape(d.id)}"]`);
      if (row) animateRow(row, style, ctx.locale === "he");
    }
  }, [list, ctx.animate, style, ctx.locale]);

  return (
    <div className="show-panel flex size-full flex-col rounded-[28px]" style={{ padding: pad }}>
      <div
        className="flex items-center gap-3 font-semibold uppercase"
        style={{ fontSize: labelFs, letterSpacing: "0.2em", color: "var(--show-muted)", marginBottom: labelFs * 0.9 }}
      >
        <span className="inline-block rounded-full" style={{ width: labelFs * 0.45, height: labelFs * 0.45, background: "var(--show-accent)" }} />
        {label}
      </div>
      <div
        ref={listRef}
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateRows: `repeat(${rowsPerCol}, minmax(0, 1fr))`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoFlow: "column",
          columnGap: pad,
        }}
      >
        {list.length === 0 && (
          <div className="col-span-full row-span-full flex items-center justify-center italic" style={{ fontSize: fs, color: "var(--show-muted)" }}>
            {ctx.t.waiting}
          </div>
        )}
        {list.map((d, i) => {
          const fresh = d.id === ctx.highlightId;
          return (
            <div
              key={d.id}
              data-donation={d.id}
              className={`flex items-center justify-between gap-4 rounded-xl ${fresh ? "show-row-highlight" : ""}`}
              style={{
                fontSize: fs,
                paddingInline: fs * 0.5,
                borderBottom:
                  (i + 1) % rowsPerCol !== 0 ? "1px solid color-mix(in oklab, var(--show-text) 10%, transparent)" : undefined,
                transition: "background 1.2s ease",
              }}
            >
              <span className="flex min-w-0 items-center font-medium" style={{ gap: fs * 0.4 }}>
                {categoryColor(d.categoryId) && (
                  <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: fs * 0.36, height: fs * 0.36, background: categoryColor(d.categoryId)! }} />
                )}
                <span className="truncate">{d.donorName}</span>
              </span>
              <span className="tabular shrink-0 font-bold" style={{ color: "var(--show-accent)" }}>
                {formatMoney(d.amount, ctx.event.currency, ctx.locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function animateRow(row: HTMLElement, style: DonationAnimation, rtl: boolean) {
  const dir = rtl ? 1 : -1;
  if (style === "pop") {
    gsap.fromTo(row, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: "back.out(2.2)" });
  } else if (style === "fade") {
    gsap.fromTo(row, { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 1.2, ease: "power2.out" });
  } else {
    gsap.fromTo(
      row,
      { x: 90 * dir, opacity: 0 },
      { x: 0, opacity: 1, duration: 1, ease: "expo.out", delay: style === "spotlight" ? 2.6 : 0 },
    );
  }
}

function MessageBlock({ block, width, height, ctx }: BlockProps) {
  const text = typo(ctx.config.texts.message, ctx.locale);
  if (!text && !ctx.editing) return null;
  const content = text || "…";
  const fs = fitFontSize(content, width, height, { max: height * 0.3, charWidth: 0.5, maxLines: 6, lineHeight: 1.25 }) * block.fontScale;
  return (
    <div className="flex size-full items-center" style={{ justifyContent: justify[block.align], textAlign: block.align, opacity: text ? 1 : 0.4 }}>
      <p className="show-display text-balance" style={{ fontSize: fs, lineHeight: 1.25 }}>
        {content}
      </p>
    </div>
  );
}

function QrBlock({ block, width, height, ctx }: BlockProps) {
  const label = ctx.config.texts.qrLabel || ctx.t.qrLabel;
  const captionFs = Math.max(12, Math.min(width * 0.085, height * 0.065)) * block.fontScale;
  const captionH = captionFs * 2.8;
  const size = Math.max(40, Math.min(width, height - captionH));
  const [svg, setSvg] = useState<string | null>(null);
  const url = ctx.formUrl ?? "https://fundraising.live/d/apercu";

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#00000000" } })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);

  const shortUrl = useMemo(() => url.replace(/^https?:\/\//, "").replace(/\/d\/(.{6}).*$/, "/d/$1…"), [url]);

  return (
    <div className="flex size-full flex-col items-center justify-center" style={{ gap: captionFs * 0.5 }}>
      <div
        className="rounded-[18%] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
        style={{ width: size, height: size, padding: size * 0.08, background: "var(--show-qr-card)" }}
      >
        {svg ? (
          <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="size-full rounded-md bg-black/5" />
        )}
      </div>
      <div className="text-center font-semibold leading-tight" style={{ fontSize: captionFs, maxWidth: width }}>
        {label}
        <div className="font-normal" style={{ fontSize: captionFs * 0.7, color: "var(--show-muted)", marginTop: captionFs * 0.15 }}>
          {shortUrl}
        </div>
      </div>
    </div>
  );
}
