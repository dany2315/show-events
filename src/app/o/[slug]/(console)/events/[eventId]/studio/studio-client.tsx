"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Rnd } from "react-rnd";
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronDown,
  ExternalLink,
  Grid3x3,
  LayoutTemplate,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShowStage, type ShowEffect } from "@/components/show/stage";
import { ShowViewport } from "@/components/show/viewport";
import { useLowPower } from "@/components/show/use-low-power";
import { saveLayoutAction, saveTemplateAction } from "@/app/actions/studio";
import { setEventLogoAction } from "@/app/actions/events";
import { useI18n } from "@/i18n/client";
import { dictionaries } from "@/i18n/dictionaries";
import { blockToPixels, clampBlock, DEFAULT_BLOCKS, pixelsToBlock, type BlockType, type ShowBlock, type ShowConfig } from "@/lib/show/config";
import { THEMES } from "@/lib/show/themes";
import { CURRENCY_SYMBOL } from "@/lib/money";
import { QUICK_AMOUNTS } from "@/lib/constants";
import type { LiveSnapshot, PublicDonation } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { useHistory } from "./use-history";
import { findOverlaps } from "@/lib/show/smart-layout";
import { AnimationsPanel, ElementsPanel, PropertiesPanel, StylePanel, TextsPanel } from "./panels";

type Template = { id: string; name: string; config: ShowConfig };

const GRID = 10;

export function StudioClient({
  organizationId,
  snapshot,
  eventLogoUrl,
  orgLogoUrl,
  displayUrl,
  templates: initialTemplates,
  backHref,
  blobEnabled,
}: {
  blobEnabled: boolean;
  organizationId: string;
  snapshot: LiveSnapshot;
  eventLogoUrl: string | null;
  orgLogoUrl: string | null;
  displayUrl: string;
  templates: Template[];
  backHref: string;
}) {
  const { t } = useI18n();
  const lowPower = useLowPower();
  const history = useHistory<ShowConfig>(snapshot.layout);
  const config = history.value;
  const [savedConfig, setSavedConfig] = useState<ShowConfig>(snapshot.layout);
  const [selected, setSelected] = useState<BlockType | null>("total");
  const [snap, setSnap] = useState(true);
  // Échelle réelle de l'aperçu : les blocs éditables ne sont montés qu'une fois connue
  // (react-rnd calcule ses décalages internes au montage).
  const [scale, setScale] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [logo, setLogo] = useState<string | null>(eventLogoUrl);
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);
  const overlapping = useMemo(() => new Set(findOverlaps(config.blocks).flat()), [config.blocks]);

  // Aperçu : données réelles + dons simulés localement.
  const [previewTotal, setPreviewTotal] = useState(snapshot.total);
  const [previewDonations, setPreviewDonations] = useState<PublicDonation[]>(snapshot.donations);
  const [effect, setEffect] = useState<ShowEffect | null>(null);
  const simCount = useRef(0);
  const event = useMemo(() => ({ ...snapshot.event, logoUrl: logo ?? orgLogoUrl }), [snapshot.event, logo, orgLogoUrl]);
  const demoNames = dictionaries[snapshot.event.locale].landing.demoDonors;

  const simulate = useCallback(() => {
    const n = ++simCount.current;
    const amounts = QUICK_AMOUNTS[snapshot.event.currency];
    const donation: PublicDonation = {
      id: `sim-${n}`,
      donorName: demoNames[n % demoNames.length],
      amount: amounts[n % amounts.length],
      createdAt: new Date().toISOString(),
    };
    setPreviewDonations((list) => [donation, ...list].slice(0, 30));
    setPreviewTotal((v) => v + donation.amount);
    setEffect({ id: n, kind: "donation", donation });
  }, [demoNames, snapshot.event.currency]);

  const update = history.set;

  const save = useCallback(() => {
    startSaving(async () => {
      const res = await saveLayoutAction(snapshot.event.id, config);
      if (res.ok) {
        setSavedConfig(config);
        toast.success(t.studio.savedLayout);
      } else toast.error(res.error === "ACCESS" ? t.common.notAllowed : t.common.errorGeneric);
    });
  }, [config, snapshot.event.id, t]);

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
        return;
      }
      if (!selected) return;
      if (e.key === "Escape") setSelected(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === selected ? { ...b, visible: false } : b)) }));
      }
      const step = e.shiftKey ? 1 : 0.25;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = delta[e.key];
      if (d) {
        e.preventDefault();
        update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === selected ? clampBlock({ ...b, x: b.x + d[0], y: b.y + d[1] }) : b)) }), "nudge");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, update, history, save]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const setBlockRect = useCallback(
    (type: BlockType, rect: { left: number; top: number; width: number; height: number }) => {
      update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === type ? clampBlock({ ...b, ...pixelsToBlock(rect) }) : b)) }));
    },
    [update],
  );

  const wrapBlock = useCallback(
    (block: ShowBlock, content: React.ReactNode) => {
      if (!block.visible || !scale) return null;
      const px = blockToPixels(block);
      const active = selected === block.type;
      return (
        <Rnd
          key={`${block.type}-${Math.round(scale * 1000)}`}
          size={{ width: px.width, height: px.height }}
          position={{ x: px.left, y: px.top }}
          scale={scale}
          bounds="parent"
          dragGrid={snap ? [GRID, GRID] : undefined}
          resizeGrid={snap ? [GRID, GRID] : undefined}
          minWidth={60}
          minHeight={40}
          onMouseDown={() => setSelected(block.type)}
          onTouchStart={() => setSelected(block.type)}
          onDragStop={(_e, d) => setBlockRect(block.type, { left: d.x, top: d.y, width: px.width, height: px.height })}
          onResizeStop={(_e, _dir, ref, _delta, pos) =>
            setBlockRect(block.type, { left: pos.x, top: pos.y, width: ref.offsetWidth, height: ref.offsetHeight })
          }
          className={cn("group/block", active ? "z-20" : "z-10")}
          resizeHandleClasses={
            active
              ? Object.fromEntries(
                  ["topLeft", "topRight", "bottomLeft", "bottomRight"].map((k) => [k, "!size-5 rounded-full border-[3px] border-white bg-[#e4b65c] shadow-lg"]),
                )
              : undefined
          }
          enableResizing={active}
        >
          <div
            className={cn(
              "relative size-full cursor-move rounded-md outline-offset-4 transition-[outline-color]",
              active
                ? "outline outline-[3px] outline-[#e4b65c]"
                : overlapping.has(block.type)
                  ? "outline-dashed outline-[3px] outline-amber-400/80"
                  : "outline outline-2 outline-transparent hover:outline-white/40",
            )}
          >
            {content}
            {active && (
              <span className="pointer-events-none absolute -top-11 start-0 rounded-md bg-[#e4b65c] px-3 py-1 text-[22px] font-semibold text-black">
                {t.studio[`block_${block.type}`]}
              </span>
            )}
          </div>
        </Rnd>
      );
    },
    [scale, snap, selected, setBlockRect, t, overlapping],
  );

  async function changeLogo(url: string | null) {
    const res = await setEventLogoAction(snapshot.event.id, url);
    if (res.ok) setLogo(url);
    else toast.error(t.common.errorGeneric);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Barre d'outils */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button asChild variant="ghost" size="icon" aria-label={t.common.back}>
          <Link href={backHref}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{snapshot.event.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t.studio.title}
            <span className={cn("size-1.5 rounded-full", dirty ? "bg-amber-400" : "bg-success")} />
            {dirty ? t.studio.unsaved : t.studio.upToDate}
          </div>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={history.undo} disabled={!history.canUndo} aria-label={t.studio.undo}>
                <Undo2 className="size-4 rtl:-scale-x-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.studio.undo} · Ctrl+Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={history.redo} disabled={!history.canRedo} aria-label={t.studio.redo}>
                <Redo2 className="size-4 rtl:-scale-x-100" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.studio.redo} · Ctrl+Y</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={snap ? "secondary" : "ghost"} size="sm" onClick={() => setSnap((v) => !v)} aria-pressed={snap} aria-label={t.studio.snap}>
                <Grid3x3 className={cn("size-4", snap && "text-gold")} />
                <span className="hidden xl:inline">{t.studio.snap}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">{t.studio.snapHelp}</TooltipContent>
          </Tooltip>
          <span className="mx-1 h-6 w-px bg-border" />
        </div>

        <Button variant="secondary" size="sm" onClick={simulate} className="hidden sm:inline-flex">
          <Sparkles className="size-3.5 text-gold" />
          {t.studio.simulate}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <LayoutTemplate className="size-3.5" />
              <span className="hidden lg:inline">{t.nav.templates}</span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => setTemplateDialog(true)}>
              <BookmarkPlus className="size-4" />
              {t.studio.saveAsTemplate}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                if (window.confirm(t.studio.resetLayoutConfirm)) update((c) => ({ ...c, blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })) }));
              }}
            >
              <RotateCcw className="size-4" />
              {t.studio.resetLayout}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t.studio.applyTemplate}</DropdownMenuLabel>
            {templates.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t.studio.noTemplates}</div>}
            {templates.map((tpl) => (
              <DropdownMenuItem
                key={tpl.id}
                onSelect={() => {
                  if (window.confirm(t.studio.applyTemplateConfirm)) history.reset(tpl.config);
                }}
              >
                <span className="size-3 rounded-full" style={{ background: THEMES[tpl.config.theme].vars.accent }} />
                <span className="truncate">{tpl.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
          <a href={displayUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {t.studio.openScreen}
          </a>
        </Button>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          <span className="hidden sm:inline">{t.studio.saveLayout}</span>
        </Button>
      </header>

      {lowPower && <div className="shrink-0 border-b bg-gold-soft px-4 py-2 text-xs text-muted-foreground lg:hidden">{t.studio.mobileHint}</div>}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Panneau gauche */}
        <aside className="order-2 min-h-0 border-t lg:order-1 lg:w-[300px] lg:shrink-0 lg:border-e lg:border-t-0">
          <Tabs defaultValue="blocks" className="flex h-full min-h-0 flex-col gap-0">
            <TabsList className="m-3 grid shrink-0 grid-cols-4">
              <TabsTrigger value="blocks" className="text-xs">{t.studio.blocks}</TabsTrigger>
              <TabsTrigger value="style" className="text-xs">{t.studio.style}</TabsTrigger>
              <TabsTrigger value="anim" className="text-xs">{t.studio.animations}</TabsTrigger>
              <TabsTrigger value="texts" className="text-xs">{t.studio.texts}</TabsTrigger>
            </TabsList>
            <ScrollArea className="min-h-0 flex-1">
              <TabsContent value="blocks" className="mt-0">
                <ElementsPanel config={config} update={update} selected={selected} onSelect={setSelected} rtl={snapshot.event.locale === "he"} />
              </TabsContent>
              <TabsContent value="style" className="mt-0">
                <StylePanel config={config} update={update} organizationId={organizationId} logoUrl={logo} onLogoChange={changeLogo} blobEnabled={blobEnabled} />
              </TabsContent>
              <TabsContent value="anim" className="mt-0">
                <AnimationsPanel config={config} update={update} currencySymbol={CURRENCY_SYMBOL[snapshot.event.currency]} />
              </TabsContent>
              <TabsContent value="texts" className="mt-0">
                <TextsPanel config={config} update={update} eventLocale={snapshot.event.locale} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </aside>

        {/* Canevas */}
        <main
          className="order-1 flex min-h-[260px] min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:18px_18px] p-4 lg:order-2 lg:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <ShowViewport className="flex-1 rounded-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10" background="#050407" onScale={setScale}>
            <>
            <ShowStage
              config={config}
              event={event}
              total={previewTotal}
              donations={previewDonations}
              control={snapshot.control}
              formUrl={snapshot.formUrl}
              effect={effect}
              editing
              lowPower={lowPower}
              wrapBlock={wrapBlock}
            />
            {/* Grille du magnétisme (repères tous les 4 pas de 10 px) */}
            {snap && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
                  backgroundSize: `${GRID * 4}px ${GRID * 4}px`,
                }}
              />
            )}
            </>
          </ShowViewport>
          <p className="mt-3 hidden text-center text-xs text-muted-foreground lg:block">{t.studio.keyboardHelp}</p>
        </main>

        {/* Panneau droit */}
        <aside className="order-3 hidden min-h-0 border-s lg:block lg:w-[300px] lg:shrink-0">
          <ScrollArea className="h-full">
            <PropertiesPanel config={config} update={update} selected={selected} organizationId={organizationId} blobEnabled={blobEnabled} />
          </ScrollArea>
        </aside>
      </div>

      <SaveTemplateDialog
        open={templateDialog}
        onOpenChange={setTemplateDialog}
        onSave={async (name) => {
          const res = await saveTemplateAction(snapshot.event.id, name, config);
          if (res.ok) {
            setTemplates((list) => [{ id: res.id, name: res.name, config }, ...list]);
            toast.success(t.studio.templateSaved);
            return true;
          }
          toast.error(t.common.errorGeneric);
          return false;
        }}
      />
    </div>
  );
}

function SaveTemplateDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (name: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.studio.saveAsTemplate}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            const ok = await onSave(name.trim());
            setPending(false);
            if (ok) {
              setName("");
              onOpenChange(false);
            }
          }}
          className="grid gap-4"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.studio.templateName} maxLength={60} autoFocus className="h-11" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
