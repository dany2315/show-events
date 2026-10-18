"use client";

import { useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  ImagePlus,
  Loader2,
  QrCode,
  Tags,
  Text,
  Trash2,
  Trophy,
  Type,
  List,
  Coins,
  RotateCcw,
  Sparkles,
  Wand2,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { dictionaries } from "@/i18n/dictionaries";
import {
  ALIGNMENTS,
  DONATION_ANIMATIONS,
  clampBlock,
  type BlockType,
  type ShowBlock,
  type ShowConfig,
} from "@/lib/show/config";
import { BACKGROUND_LIST, getBackground } from "@/lib/show/themes";
import { BackdropThumb } from "@/components/show/backdrop";
import type { AppLocale } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatBytes, uploadImage, UploadTooLargeError } from "@/lib/upload-client";
import { applyPreset, autoLayout, findOverlaps, fixOverlaps, LAYOUT_PRESETS, type LayoutPreset } from "@/lib/show/smart-layout";
import { fmt as fmtText } from "@/i18n/format";

export type Update = (fn: (c: ShowConfig) => ShowConfig, coalesceKey?: string) => void;

export const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  logo: ImageIcon,
  title: Type,
  total: Coins,
  goal: Trophy,
  donations: List,
  message: Text,
  qrcode: QrCode,
  categories: Tags,
};

function Section({ title, children, help }: { title: string; children: React.ReactNode; help?: string }) {
  return (
    <section className="border-b px-4 py-5 last:border-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      {help && <p className="mt-1 text-xs text-muted-foreground/80">{help}</p>}
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

/* ─── Éléments & calques ─────────────────────────────────────────────── */

export function ElementsPanel({
  config,
  update,
  selected,
  onSelect,
  rtl,
}: {
  config: ShowConfig;
  update: Update;
  selected: BlockType | null;
  onSelect: (b: BlockType) => void;
  rtl: boolean;
}) {
  const { t } = useI18n();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // Affichage : premier plan en haut de la liste.
  const layers = [...config.blocks].reverse();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((c) => {
      const reversed = [...c.blocks].reverse();
      const from = reversed.findIndex((b) => b.type === active.id);
      const to = reversed.findIndex((b) => b.type === over.id);
      return { ...c, blocks: arrayMove(reversed, from, to).reverse() };
    });
  }

  return (
    <>
    <LayoutSection config={config} update={update} rtl={rtl} />
    <Section title={t.studio.donationsQuick}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{t.studio.donationsColumns}</span>
        <div className="inline-flex rounded-xl bg-muted p-1">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => update((c) => ({ ...c, donations: { ...c.donations, columns: n } }))}
              className={cn("rounded-lg px-3 py-1 text-sm", config.donations.columns === n ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
              aria-pressed={config.donations.columns === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>{t.studio.donationsCount}</span>
          <span className="tabular text-muted-foreground">{config.donations.count}</span>
        </div>
        <Slider value={[config.donations.count]} min={1} max={16} step={1} onValueChange={([v]) => update((c) => ({ ...c, donations: { ...c.donations, count: v } }), "dcount")} />
      </div>
    </Section>
    <Section title={t.studio.layers} help={t.studio.layersHelp}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={layers.map((b) => b.type)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-1.5">
            {layers.map((block) => (
              <LayerRow key={block.type} block={block} active={selected === block.type} onSelect={() => onSelect(block.type)} update={update} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </Section>
    </>
  );
}

/* ─── Mise en page intelligente ───────────────────────────────────────── */

function LayoutSection({ config, update, rtl }: { config: ShowConfig; update: Update; rtl: boolean }) {
  const { t } = useI18n();
  const overlaps = findOverlaps(config.blocks);
  const label = (p: LayoutPreset) => t.studio[`preset_${p}`];
  return (
    <Section title={t.studio.layout} help={t.studio.layoutHelp}>
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          let chosen: LayoutPreset = "classic";
          update((c) => {
            const r = autoLayout(c, rtl);
            chosen = r.preset;
            return r.config;
          });
          window.setTimeout(() => toast.success(fmtText(t.studio.autoLayoutDone, { name: label(chosen) })), 0);
        }}
      >
        <Wand2 className="size-4" />
        {t.studio.autoLayout}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {LAYOUT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => update((c) => applyPreset(c, p, rtl))}
            className="overflow-hidden rounded-xl border text-start transition-colors hover:border-gold/60"
          >
            <PresetThumb preset={p} config={config} rtl={rtl} />
            <span className="block truncate px-2 py-1.5 text-xs font-medium">{label(p)}</span>
          </button>
        ))}
      </div>
      {overlaps.length > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5" />
            {fmtText(t.studio.overlapsCount, { count: overlaps.length })}
          </span>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={() => {
              update((c) => fixOverlaps(c));
              toast.success(t.studio.overlapsFixed);
            }}
          >
            <Sparkles className="size-3" />
            {t.studio.fixOverlaps}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          {t.studio.overlapsNone}
        </div>
      )}
    </Section>
  );
}

function PresetThumb({ preset, config, rtl }: { preset: LayoutPreset; config: ShowConfig; rtl: boolean }) {
  const blocks = applyPreset(config, preset, rtl).blocks.filter((b) => b.visible);
  return (
    <span className="relative block aspect-video bg-muted/60">
      {blocks.map((b) => (
        <span
          key={b.type}
          className={cn("absolute rounded-[2px]", b.type === "total" ? "bg-gold/80" : "bg-foreground/25")}
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
        />
      ))}
    </span>
  );
}

function LayerRow({ block, active, onSelect, update }: { block: ShowBlock; active: boolean; onSelect: () => void; update: Update }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.type });
  const Icon = BLOCK_ICONS[block.type];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors",
        active ? "border-gold/60 bg-gold-soft" : "border-transparent bg-muted/60 hover:bg-muted",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button type="button" className="cursor-grab touch-none p-1 text-muted-foreground active:cursor-grabbing" aria-label="Déplacer" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
        <Icon className={cn("size-4 shrink-0", active ? "text-gold" : "text-muted-foreground")} />
        <span className="min-w-0">
          <span className={cn("block truncate text-sm font-medium", !block.visible && "text-muted-foreground line-through")}>{t.studio[`block_${block.type}`]}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{t.studio[`block_${block.type}_desc`]}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === block.type ? { ...b, visible: !b.visible } : b)) }))}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label={block.visible ? t.studio.hidden : t.studio.visible}
      >
        {block.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </li>
  );
}

/* ─── Style ───────────────────────────────────────────────────────────── */

export function StylePanel({
  config,
  update,
  organizationId,
  logoUrl,
  onLogoChange,
  blobEnabled,
}: {
  config: ShowConfig;
  update: Update;
  organizationId: string;
  logoUrl: string | null;
  onLogoChange: (url: string | null) => Promise<void>;
  blobEnabled: boolean;
}) {
  const { t, locale } = useI18n();
  const background = getBackground(config.theme);

  return (
    <>
      <Section title={t.studio.background} help={t.studio.backgroundHelp}>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUND_LIST.map((def) => {
            const active = def.id === config.theme;
            return (
              <button
                key={def.id}
                type="button"
                aria-pressed={active}
                title={def.tagline[locale]}
                onClick={() => update((c) => ({ ...c, theme: def.id, colors: { accent: null, text: null } }))}
                className={cn("min-w-0 overflow-hidden rounded-xl border text-start transition-all", active ? "border-gold ring-2 ring-gold/30" : "hover:border-foreground/30")}
              >
                <BackdropThumb theme={def.id} locale={locale} />
                {/* w-0 min-w-full : le libellé ne doit pas élargir le panneau défilant (largeur intrinsèque nulle). */}
                <span className="block w-0 min-w-full truncate px-2 py-1.5 text-xs font-medium">{def.label[locale]}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {!background.lockedColors && (
        <Section title={t.studio.colors} help={t.studio.colorsHelp}>
          {(
            [
              ["accent", t.studio.accentColor, background.vars.accent],
              ["text", t.studio.textColor, background.vars.text],
            ] as const
          ).map(([key, label, fallback]) => {
            const value = config.colors[key];
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label className="text-sm font-normal">{label}</Label>
                <div className="flex items-center gap-1.5">
                  {value && (
                    <button
                      type="button"
                      onClick={() => update((c) => ({ ...c, colors: { ...c.colors, [key]: null } }))}
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                      title={t.studio.resetColor}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                  <label className="relative size-8 cursor-pointer overflow-hidden rounded-lg border" style={{ background: value ?? fallback }}>
                    <input
                      type="color"
                      value={toHex(value ?? fallback)}
                      onChange={(e) => update((c) => ({ ...c, colors: { ...c.colors, [key]: e.target.value } }), `color-${key}`)}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      aria-label={label}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      <Section title={t.studio.logo} help={t.studio.logoHelp}>
        <ImagePicker
          organizationId={organizationId}
          value={logoUrl}
          onChange={onLogoChange}
          label={t.studio.changeLogo}
          contain
          blobEnabled={blobEnabled}
        />
      </Section>
    </>
  );
}

function toHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
}

function ImagePicker({
  organizationId,
  value,
  onChange,
  label,
  contain,
  blobEnabled = false,
}: {
  organizationId: string;
  value: string | null;
  onChange: (url: string | null) => Promise<void> | void;
  label: string;
  contain?: boolean;
  blobEnabled?: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={cn("size-full", contain ? "object-contain p-1" : "object-cover")} />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              await onChange(await uploadImage(organizationId, file, { blobEnabled }));
            } catch (error) {
              toast.error(
                error instanceof UploadTooLargeError
                  ? fmtText(t.studio.fileTooBig, { max: formatBytes(error.maxBytes) })
                  : error instanceof Error && error.message !== "upload"
                    ? error.message
                    : t.common.errorGeneric,
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        {/* Libellé sur plusieurs lignes si besoin : le panneau défilant ne doit pas s'élargir. */}
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy} className="h-auto min-h-8 whitespace-normal py-1.5 text-start">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          {busy ? t.studio.uploading : label}
        </Button>
        {value && (
          <Button type="button" size="xs" variant="ghost" onClick={() => onChange(null)} disabled={busy}>
            <Trash2 className="size-3" />
            {t.studio.removeImage}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Animations ──────────────────────────────────────────────────────── */

export function AnimationsPanel({ config, update, currencySymbol }: { config: ShowConfig; update: Update; currencySymbol: string }) {
  const { t } = useI18n();
  const a = config.animation;
  const setAnim = (patch: Partial<ShowConfig["animation"]>, key?: string) => update((c) => ({ ...c, animation: { ...c.animation, ...patch } }), key);
  return (
    <>
      <Section title={t.studio.donationAnimation}>
        <div className="grid gap-2">
          {DONATION_ANIMATIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAnim({ donation: id })}
              className={cn("rounded-xl border px-3 py-2.5 text-start transition-colors", a.donation === id ? "border-gold bg-gold-soft" : "hover:bg-muted")}
            >
              <span className="block text-sm font-medium">{t.studio[`anim_${id}`]}</span>
              <span className="block text-xs text-muted-foreground">{t.studio[`anim_${id}_desc`]}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title={t.studio.counterAnimation}>
        <div className="inline-flex rounded-xl bg-muted p-1">
          {(["roll", "instant"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAnim({ counter: id })}
              className={cn("rounded-lg px-3 py-1.5 text-sm", a.counter === id ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              {t.studio[`counter_${id}`]}
            </button>
          ))}
        </div>
      </Section>
      <Section title={t.studio.spotlightThreshold} help={t.studio.spotlightThresholdHelp}>
        <div className="relative">
          <Input
            type="number"
            min={0}
            step={100}
            value={a.spotlightThreshold}
            onChange={(e) => setAnim({ spotlightThreshold: Math.max(0, Math.round(Number(e.target.value) || 0)) }, "spotlight")}
            className="tabular pe-8"
            dir="ltr"
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">{currencySymbol}</span>
        </div>
      </Section>
      <Section title={t.studio.animations}>
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm">{t.studio.milestones}</span>
            <span className="block text-xs text-muted-foreground">{t.studio.milestonesHelp}</span>
          </span>
          <Switch checked={a.milestones} onCheckedChange={(v) => setAnim({ milestones: v })} />
        </label>
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm">{t.studio.ambient}</span>
            <span className="block text-xs text-muted-foreground">{t.studio.ambientHelp}</span>
          </span>
          <Switch checked={a.ambient} onCheckedChange={(v) => setAnim({ ambient: v })} />
        </label>
      </Section>
    </>
  );
}

/* ─── Textes ──────────────────────────────────────────────────────────── */

export function TextsPanel({ config, update, eventLocale }: { config: ShowConfig; update: Update; eventLocale: AppLocale }) {
  const { t } = useI18n();
  const show = dictionaries[eventLocale].show;
  const setText = (key: keyof ShowConfig["texts"], value: string) => update((c) => ({ ...c, texts: { ...c.texts, [key]: value } }), `text-${key}`);
  const field = (key: keyof ShowConfig["texts"], label: string, placeholder: string, max: number) => (
    <div className="grid gap-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      <Input value={config.texts[key]} maxLength={max} placeholder={placeholder} onChange={(e) => setText(key, e.target.value)} dir={eventLocale === "he" ? "rtl" : "ltr"} />
    </div>
  );
  return (
    <Section title={t.studio.texts}>
      {field("subtitle", t.studio.subtitle, t.studio.subtitlePlaceholder, 160)}
      <div className="grid gap-1.5">
        <Label className="text-sm font-normal">{t.studio.message}</Label>
        <Textarea
          value={config.texts.message}
          maxLength={400}
          rows={3}
          placeholder={t.studio.messagePlaceholder}
          onChange={(e) => setText("message", e.target.value)}
          dir={eventLocale === "he" ? "rtl" : "ltr"}
        />
      </div>
      {field("totalLabel", t.studio.totalLabel, fmt(t.studio.defaultPlaceholder, { value: show.totalLabel }), 60)}
      {field("donationsLabel", t.studio.donationsLabel, fmt(t.studio.defaultPlaceholder, { value: show.donationsLabel }), 60)}
      {field("qrLabel", t.studio.qrLabel, fmt(t.studio.defaultPlaceholder, { value: show.qrLabel }), 80)}
    </Section>
  );
}

/* ─── Propriétés du bloc sélectionné ─────────────────────────────────── */

export function PropertiesPanel({
  config,
  update,
  selected,
}: {
  config: ShowConfig;
  update: Update;
  selected: BlockType | null;
}) {
  const { t } = useI18n();
  const block = config.blocks.find((b) => b.type === selected);
  if (!block) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t.studio.selectBlock}</p>;
  }
  const Icon = BLOCK_ICONS[block.type];
  const patch = (p: Partial<ShowBlock>, key?: string) =>
    update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === block.type ? clampBlock({ ...b, ...p }) : b)) }), key);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gold-soft text-gold">
            <Icon className="size-4" />
          </span>
          <div>
            <div className="font-semibold">{t.studio[`block_${block.type}`]}</div>
            <div className="text-xs text-muted-foreground">{t.studio[`block_${block.type}_desc`]}</div>
          </div>
        </div>
        <Switch checked={block.visible} onCheckedChange={(v) => patch({ visible: v })} aria-label={t.studio.visible} />
      </div>

      <Section title={t.studio.position}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["x", t.studio.posX],
              ["y", t.studio.posY],
              ["w", t.studio.width],
              ["h", t.studio.height],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1">
              <span className="text-[11px] text-muted-foreground">{label} (%)</span>
              <Input
                type="number"
                step={0.5}
                value={block[key]}
                onChange={(e) => patch({ [key]: Number(e.target.value) || 0 }, `pos-${key}`)}
                className="tabular h-8"
                dir="ltr"
              />
            </label>
          ))}
        </div>
      </Section>

      {block.type !== "logo" && (
        <Section title={t.studio.textSize}>
          <div className="flex items-center gap-3">
            <Slider value={[Math.round(block.fontScale * 100)]} min={50} max={200} step={5} onValueChange={([v]) => patch({ fontScale: v / 100 }, "font")} className="flex-1" />
            <span className="tabular w-12 text-end text-sm text-muted-foreground">{Math.round(block.fontScale * 100)}%</span>
          </div>
        </Section>
      )}

      {block.type !== "goal" && block.type !== "qrcode" && (
        <Section title={t.studio.alignment}>
          <div className="inline-flex rounded-xl bg-muted p-1">
            {ALIGNMENTS.map((al) => {
              const AlignIcon = al === "start" ? AlignLeft : al === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={al}
                  type="button"
                  onClick={() => patch({ align: al })}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs", block.align === al ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                  title={al === "start" ? t.studio.alignStart : al === "center" ? t.studio.alignCenter : t.studio.alignEnd}
                >
                  <AlignIcon className="size-3.5 rtl:-scale-x-100" />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {block.type === "donations" && (
        <Section title={t.studio.block_donations}>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t.studio.donationsCount}</span>
              <span className="tabular text-muted-foreground">{config.donations.count}</span>
            </div>
            <Slider value={[config.donations.count]} min={1} max={16} step={1} onValueChange={([v]) => update((c) => ({ ...c, donations: { ...c.donations, count: v } }), "dcount")} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{t.studio.donationsColumns}</span>
            <div className="inline-flex rounded-xl bg-muted p-1">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update((c) => ({ ...c, donations: { ...c.donations, columns: n } }))}
                  className={cn("rounded-lg px-3 py-1 text-sm", config.donations.columns === n ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {block.type === "message" && (
        <Section title={t.studio.message}>
          <Textarea
            value={config.texts.message}
            maxLength={400}
            rows={4}
            placeholder={t.studio.messagePlaceholder}
            onChange={(e) => update((c) => ({ ...c, texts: { ...c.texts, message: e.target.value } }), "text-message")}
          />
        </Section>
      )}

      {block.type === "title" && (
        <Section title={t.studio.subtitle}>
          <Input
            value={config.texts.subtitle}
            maxLength={160}
            placeholder={t.studio.subtitlePlaceholder}
            onChange={(e) => update((c) => ({ ...c, texts: { ...c.texts, subtitle: e.target.value } }), "text-subtitle")}
          />
        </Section>
      )}
    </>
  );
}
