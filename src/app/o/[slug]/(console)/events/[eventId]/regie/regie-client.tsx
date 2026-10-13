"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  FlaskConical,
  Keyboard,
  Loader2,
  MessageSquareText,
  Pause,
  PartyPopper,
  Pencil,
  Play,
  Plus,
  Smartphone,
  Target,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShowStage } from "@/components/show/stage";
import { ShowViewport } from "@/components/show/viewport";
import { useLowPower } from "@/components/show/use-low-power";
import { useLiveEvent, type ConnectionStatus } from "@/components/show/use-live-event";
import { EventStatusBadge } from "@/components/app/event-status-badge";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { formatMoney, formatPercent, goalProgress, parseAmountInput, CURRENCY_SYMBOL } from "@/lib/money";
import { MAX_DONATION_AMOUNT, QUICK_AMOUNTS } from "@/lib/constants";
import type { LiveSnapshot } from "@/lib/live/types";
import type { AdminDonation, RegieState } from "@/lib/regie";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { acceptsDonations } from "@/lib/lifecycle";
import type { EventStatusCode } from "@/lib/constants";
import { EventStatusControl } from "@/components/app/event-status-control";

function newKey() {
  return (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

export function RegieClient({
  snapshot,
  initialRegie,
  links,
  backHref,
  isSuperAdmin,
}: {
  isSuperAdmin: boolean;
  snapshot: LiveSnapshot;
  initialRegie: RegieState;
  links: { formUrl: string; displayUrl: string };
  backHref: string;
}) {
  const { t, locale } = useI18n();
  const eventId = snapshot.event.id;
  const { state, status } = useLiveEvent({ kind: "event", eventId }, snapshot);
  const lowPower = useLowPower();
  const [regie, setRegie] = useState<RegieState>(initialRegie);
  const currency = state.event.currency;

  // Vue administrateur (réel / fictif) rafraîchie à chaque changement du direct.
  const refreshTimer = useRef<number | null>(null);
  const refreshRegie = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/donations`, { cache: "no-store" });
        if (res.ok) setRegie(await res.json());
      } catch {
        // la prochaine synchronisation rattrapera
      }
    }, 200);
  }, [eventId]);
  useEffect(() => {
    if (state.seq !== snapshot.seq) refreshRegie();
  }, [state.seq, snapshot.seq, refreshRegie]);

  const total = state.total;
  const pct = goalProgress(total, state.event.goalAmount);

  return (
    <div className="min-h-screen">
      {/* Barre supérieure */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Button asChild variant="ghost" size="icon" aria-label={t.common.back}>
            <Link href={backHref}>
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{state.event.name}</span>
              <EventStatusBadge status={state.event.status} label={t.eventStatus[state.event.status]} className="hidden sm:inline-flex" />
            </div>
            <div className="text-xs text-muted-foreground">{t.regie.title}</div>
          </div>
          <ConnectionPill status={status} />
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <a href={links.formUrl} target="_blank" rel="noreferrer">
              <Smartphone className="size-3.5" />
              {t.regie.openForm}
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={links.displayUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">{t.regie.openScreen}</span>
            </a>
          </Button>
        </div>
      </header>

      <StatusBanner eventId={eventId} status={state.event.status} isSuperAdmin={isSuperAdmin} />

      {/* Mobile : total → saisie → dernières promesses → pilotage. Grand écran : 3 colonnes. */}
      <div className="mx-auto grid max-w-[1600px] gap-5 p-4 [grid-template-areas:'total'_'form'_'latest'_'controls'_'preview'] lg:grid-cols-[380px_minmax(0,1fr)] lg:[grid-template-areas:'total_total'_'form_latest'_'controls_preview'] xl:grid-cols-[400px_minmax(0,1fr)_380px] xl:grid-rows-[auto_1fr] xl:[grid-template-areas:'form_total_controls'_'form_latest_preview']">
        <section className="rounded-3xl border bg-card p-5 [grid-area:total]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{t.regie.totalShow}</div>
              <div className="gold-text tabular mt-1 font-bold tracking-tight text-5xl leading-none sm:text-6xl">{formatMoney(total, currency, locale)}</div>
            </div>
            <div className="text-end">
              <div className="tabular font-bold tracking-tight text-3xl text-gold">{formatPercent((total / Math.max(1, state.event.goalAmount)) * 100, locale)}</div>
              <div className="text-xs text-muted-foreground">
                {t.common.goal} {formatMoney(state.event.goalAmount, currency, locale)}
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-[#b8862f] via-gold to-[#f3d48b] transition-[width] duration-700 rtl:bg-gradient-to-l" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label={t.regie.real} value={formatMoney(regie.realTotal, currency, locale)} />
            <Stat label={t.regie.fictitious} value={formatMoney(regie.fictitiousTotal, currency, locale)} tone="amber" />
            <Stat label={t.regie.count} value={String(state.count)} />
          </div>
        </section>

        <section className="[grid-area:latest] rounded-3xl border bg-card p-5">
          <LatestList donations={regie.donations} currency={currency} eventId={eventId} onChanged={refreshRegie} />
        </section>

        <section className="[grid-area:form]">
          <AddDonationForm eventId={eventId} currency={currency} onAdded={refreshRegie} open={acceptsDonations(state.event.status)} />
        </section>

        <section className="[grid-area:controls]">
          <Controls eventId={eventId} paused={state.control.paused} overlay={state.control.overlay} />
        </section>
        <section className="[grid-area:preview] self-start">
          <div className="overflow-hidden rounded-3xl border bg-card">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Eye className="size-4 text-muted-foreground" />
                {t.studio.preview}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="live-dot !size-1.5" /> {t.common.live}
              </span>
            </div>
            <div className="aspect-video border-t">
              <ShowViewport className="size-full">
                <ShowStage
                  config={state.layout}
                  event={state.event}
                  total={state.total}
                  donations={state.donations}
                  control={state.control}
                  formUrl={state.formUrl}
                  effect={state.effect}
                  lowPower={lowPower}
                />
              </ShowViewport>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const { t } = useI18n();
  const label =
    status === "live" ? t.regie.connection_live : status === "polling" ? t.regie.connection_polling : status === "offline" ? t.regie.connection_offline : t.regie.connection_connecting;
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
        status === "offline" ? "bg-destructive/15 text-destructive" : status === "connecting" ? "bg-muted text-muted-foreground" : "bg-success/15 text-success",
      )}
      role="status"
    >
      {status === "offline" ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
      {label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className={cn("rounded-2xl px-2 py-2.5", tone === "amber" ? "bg-amber-400/10" : "bg-muted")}>
      <div className={cn("tabular truncate text-sm font-semibold", tone === "amber" && "text-amber-300")}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBanner({ eventId, status, isSuperAdmin }: { eventId: string; status: EventStatusCode; isSuperAdmin: boolean }) {
  const { t } = useI18n();
  const text =
    status === "DRAFT" ? t.regie.statusDraft : status === "TEST" ? t.regie.statusTest : status === "ENDED" ? t.regie.statusEnded : t.eventDetail.liveInfo;
  return (
    <div
      className={cn(
        "border-b",
        status === "TEST" && "bg-amber-400/15",
        status === "DRAFT" && "bg-gold-soft",
        status === "LIVE" && "bg-live/[0.07]",
        status === "ENDED" && "bg-muted",
      )}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <span className={cn("flex items-center gap-2", status === "TEST" && "font-medium text-amber-200")}>
          {status === "TEST" && <FlaskConical className="size-4 shrink-0" />}
          {status === "LIVE" && <span className="live-dot shrink-0" />}
          {text}
        </span>
        <EventStatusControl eventId={eventId} status={status} isSuperAdmin={isSuperAdmin} size="sm" />
      </div>
    </div>
  );
}

function AddDonationForm({ eventId, currency, onAdded, open }: { eventId: string; currency: "EUR" | "ILS" | "USD"; onAdded: () => void; open: boolean }) {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [fictitious, setFictitious] = useState(false);
  const [pending, setPending] = useState(false);
  const keyRef = useRef(newKey());
  const hydrated = useHydrated();
  const nameRef = useRef<HTMLInputElement>(null);
  const amount = parseAmountInput(amountText);
  const quick = QUICK_AMOUNTS[currency];

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (pending) return;
    const donorName = name.trim();
    if (!donorName) {
      nameRef.current?.focus();
      toast.error(t.donate.errorName);
      return;
    }
    if (!amount || amount > MAX_DONATION_AMOUNT) {
      toast.error(t.donate.errorAmount);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/donations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ donorName, amount, isFictitious: fictitious, idempotencyKey: keyRef.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(fmt(t.regie.added, { name: donorName, amount: formatMoney(amount, currency, locale) }));
      keyRef.current = newKey();
      setName("");
      setAmountText("");
      setFictitious(false);
      onAdded();
      nameRef.current?.focus();
    } catch {
      // La clé d'idempotence est conservée : un nouvel essai ne créera pas de doublon.
      toast.error(t.common.errorNetwork);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} method="post" className={cn("rounded-3xl border bg-card p-5", !open && "opacity-60")}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Plus className="size-5 text-gold" />
        {t.regie.addTitle}
      </h2>

      <div className="mt-5 grid gap-2">
        <Label htmlFor="donor">{t.regie.donorName}</Label>
        <div className="flex gap-2">
          <Input
            id="donor"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.regie.donorNamePlaceholder}
            maxLength={60}
            autoComplete="off"
            className="h-12 text-base"
          />
          <Button type="button" variant="secondary" className="h-12 shrink-0" onClick={() => setName(t.regie.anonymous)}>
            {t.regie.anonymous}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="amount">{t.regie.amount}</Label>
        <div className="relative">
          <Input
            id="amount"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            autoComplete="off"
            dir="ltr"
            className="tabular h-16 pe-12 text-3xl font-semibold"
          />
          <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-2xl text-muted-foreground">{CURRENCY_SYMBOL[currency]}</span>
        </div>
        <div className="text-xs text-muted-foreground">{t.regie.quickAmounts}</div>
        <div className="grid grid-cols-4 gap-2">
          {quick.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              className="tabular h-11 px-1 text-sm font-semibold"
              onClick={() => setAmountText(String((amount ?? 0) + q))}
            >
              +{formatMoney(q, currency, locale)}
            </Button>
          ))}
        </div>
        {amountText && (
          <button type="button" className="justify-self-end text-xs text-muted-foreground hover:text-foreground" onClick={() => setAmountText("")}>
            <X className="me-1 inline size-3" />
            {t.common.cancel}
          </button>
        )}
      </div>

      <label className={cn("mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors", fictitious ? "border-amber-400/50 bg-amber-400/10" : "")}>
        <Switch checked={fictitious} onCheckedChange={setFictitious} className="mt-0.5" aria-label={t.regie.fictitious_label} />
        <span>
          <span className="block text-sm font-medium">{t.regie.fictitious_label}</span>
          <span className="block text-xs text-muted-foreground">{t.regie.fictitious_help}</span>
        </span>
      </label>

      <Button type="submit" size="lg" disabled={pending || !hydrated || !open} className="mt-5 h-14 w-full rounded-2xl text-base font-semibold">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        {pending ? t.regie.submitting : t.regie.submit}
        {amount ? <span className="tabular opacity-70">· {formatMoney(amount, currency, locale)}</span> : null}
      </Button>
    </form>
  );
}

function timeAgo(iso: string, t: ReturnType<typeof useI18n>["t"]) {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t.regie.justNow;
  return fmt(t.regie.minutesAgo, { count: minutes });
}

function LatestList({ donations, currency, eventId, onChanged }: { donations: AdminDonation[]; currency: "EUR" | "ILS" | "USD"; eventId: string; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<AdminDonation | null>(null);
  const [deleting, setDeleting] = useState<AdminDonation | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function remove(d: AdminDonation) {
    const res = await fetch(`/api/events/${eventId}/donations/${d.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t.regie.deleted);
      onChanged();
    } else toast.error(t.common.errorGeneric);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground">{t.regie.latest}</h3>
      {donations.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{t.regie.empty}</p>
      ) : (
        <ul className="mt-3 grid max-h-[560px] gap-1.5 overflow-y-auto pe-1">
          {donations.map((d) => (
            <li key={d.id} className={cn("group flex items-center gap-3 rounded-2xl px-3 py-2.5", d.isFictitious ? "bg-amber-400/[0.07]" : "bg-muted/60")}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                {d.source === "MOBILE" ? <Smartphone className="size-3.5" /> : <Keyboard className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{d.donorName}</span>
                  {d.isTest && <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase text-black">{t.eventStatus.TEST}</span>}
                  {d.isFictitious && <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">{t.eventDetail.fictitious}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.source === "MOBILE" ? t.regie.source_MOBILE : t.regie.source_MANUAL} · {timeAgo(d.createdAt, t)}
                </div>
              </div>
              <span className="tabular shrink-0 font-semibold text-gold">{formatMoney(d.amount, currency, locale)}</span>
              <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(d)} aria-label={t.common.edit}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(d)} aria-label={t.common.delete}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditDonationDialog donation={editing} currency={currency} eventId={eventId} onClose={() => setEditing(null)} onSaved={onChanged} />}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting?.donorName} · {deleting ? formatMoney(deleting.amount, currency, locale) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.regie.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleting && remove(deleting)}>
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDonationDialog({
  donation,
  currency,
  eventId,
  onClose,
  onSaved,
}: {
  donation: AdminDonation;
  currency: "EUR" | "ILS" | "USD";
  eventId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(donation.donorName);
  const [amountText, setAmountText] = useState(String(donation.amount));
  const [fictitious, setFictitious] = useState(donation.isFictitious);
  const [pending, setPending] = useState(false);

  async function save() {
    const amount = parseAmountInput(amountText);
    if (!name.trim() || !amount) {
      toast.error(!name.trim() ? t.donate.errorName : t.donate.errorAmount);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/events/${eventId}/donations/${donation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ donorName: name.trim(), amount, ...(donation.source === "MANUAL" ? { isFictitious: fictitious } : {}) }),
    });
    setPending(false);
    if (res.ok) {
      toast.success(t.regie.updated);
      onSaved();
      onClose();
    } else toast.error(t.common.errorGeneric);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.regie.editTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">{t.regie.donorName}</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-amount">
              {t.regie.amount} ({CURRENCY_SYMBOL[currency]})
            </Label>
            <Input id="edit-amount" value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="numeric" dir="ltr" className="tabular h-11" />
          </div>
          {donation.source === "MANUAL" && (
            <label className="flex items-center gap-3">
              <Switch checked={fictitious} onCheckedChange={setFictitious} />
              <span className="text-sm">{t.regie.fictitious_label}</span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Controls({ eventId, paused, overlay }: { eventId: string; paused: boolean; overlay: string | null }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const send = useCallback(
    async (action: string, extra: Record<string, string> = {}) => {
      setBusy(action);
      try {
        const res = await fetch(`/api/events/${eventId}/control`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        if (!res.ok) throw new Error();
        toast.success(t.regie.sent);
        return true;
      } catch {
        toast.error(t.common.errorNetwork);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [eventId, t],
  );

  const spinner = (key: string, icon: React.ReactNode) => (busy === key ? <Loader2 className="size-4 animate-spin" /> : icon);

  return (
    <div className="rounded-3xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{t.regie.controls}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-3" onClick={() => send("celebrate")} disabled={!!busy}>
          {spinner("celebrate", <PartyPopper className="size-5 text-gold" />)}
          <span className="text-sm font-medium">{t.regie.celebrate}</span>
        </Button>
        <Button variant="secondary" className="h-auto flex-col gap-1 rounded-2xl py-3" onClick={() => send("goal")} disabled={!!busy}>
          {spinner("goal", <Target className="size-5 text-gold" />)}
          <span className="text-sm font-medium">{t.regie.goalAnim}</span>
        </Button>
        <Button
          variant={paused ? "default" : "secondary"}
          className="col-span-2 h-11 rounded-2xl"
          onClick={() => send(paused ? "resume" : "pause")}
          disabled={!!busy}
        >
          {spinner(paused ? "resume" : "pause", paused ? <Play className="size-4" /> : <Pause className="size-4" />)}
          {paused ? t.regie.resume : t.regie.pause}
        </Button>
        {paused && <p className="col-span-2 text-xs text-muted-foreground">{t.regie.pausedInfo}</p>}
      </div>

      <div className="mt-5 border-t pt-5">
        <Label htmlFor="overlay" className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-muted-foreground" />
          {t.regie.overlay}
        </Label>
        {overlay && (
          <div className="mt-3 rounded-2xl border border-gold/30 bg-gold-soft px-3 py-2 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">{t.regie.overlayActive}</div>
            <div className="mt-0.5">{overlay}</div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Input id="overlay" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={160} placeholder={t.regie.overlayPlaceholder} className="h-11" />
          <Button
            className="h-11 shrink-0"
            disabled={!message.trim() || !!busy}
            onClick={async () => {
              if (await send("overlay", { message })) setMessage("");
            }}
          >
            {spinner("overlay", null)}
            {t.regie.showOverlay}
          </Button>
        </div>
        {overlay && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => send("clearOverlay")} disabled={!!busy}>
            <X className="size-3.5" />
            {t.regie.hideOverlay}
          </Button>
        )}
      </div>
    </div>
  );
}
