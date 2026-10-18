"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/app/actions/events";
import { useI18n } from "@/i18n/client";
import { CURRENCIES, type AppLocale, type CurrencyCode } from "@/lib/constants";
import { CURRENCY_SYMBOL } from "@/lib/money";
import type { ThemeId } from "@/lib/show/config";
import { BACKGROUND_LIST, getBackground } from "@/lib/show/themes";
import { BackdropThumb } from "@/components/show/backdrop";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  mode: "create" | "edit";
  eventId?: string;
  defaults: { name?: string; date?: string; goalAmount?: number; currency: CurrencyCode; locale: AppLocale };
  templates?: { id: string; name: string; theme: string }[];
  currencyLocked?: boolean;
  submitLabel: string;
};

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 3600_000);
  if (!iso) d.setHours(19, 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({ action, mode, eventId, defaults, templates = [], currencyLocked, submitLabel }: Props) {
  const { t, locale } = useI18n();
  const [currency, setCurrency] = useState<CurrencyCode>(defaults.currency);
  const [eventLocale, setEventLocale] = useState<AppLocale>(defaults.locale);
  const [start, setStart] = useState("theme:gala");
  const [localDate, setLocalDate] = useState(() => toLocalInput(defaults.date));
  const isoDate = useMemo(() => (localDate ? new Date(localDate).toISOString() : ""), [localDate]);

  function errorLabel(code: string) {
    const key = `blocked_${code}` as keyof typeof t.events;
    if (key in t.events) return t.events[key] as string;
    if (code === "ACCESS") return t.common.notAllowed;
    return t.common.errorGeneric;
  }

  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) toast.success(t.eventDetail.updated);
    else toast.error(errorLabel(result.error));
    return result;
  }, null);

  const invalidField = state && !state.ok ? state.field : undefined;

  return (
    <form action={formAction} className="grid gap-6">
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      <input type="hidden" name="date" value={isoDate} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="locale" value={eventLocale} />
      <input type="hidden" name="start" value={start} />

      <div className="grid gap-2">
        <Label htmlFor="name">{t.events.fieldName}</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={defaults.name}
          placeholder={t.events.fieldNamePlaceholder}
          className="h-11"
          aria-invalid={invalidField === "name"}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="date-local">{t.events.fieldDate}</Label>
          <Input
            id="date-local"
            type="datetime-local"
            required
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            className="h-11"
            dir="ltr"
            aria-invalid={invalidField === "date"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="goalAmount">{t.events.fieldGoal}</Label>
          <div className="relative">
            <Input
              id="goalAmount"
              name="goalAmount"
              inputMode="numeric"
              required
              defaultValue={defaults.goalAmount ?? ""}
              placeholder="200000"
              className="tabular h-11 pe-10"
              dir="ltr"
              aria-invalid={invalidField === "goalAmount"}
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted-foreground">{CURRENCY_SYMBOL[currency]}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t.events.fieldCurrency}</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)} disabled={currencyLocked}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t.currencies[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currencyLocked && <p className="text-xs text-muted-foreground">{t.eventDetail.currencyLocked}</p>}
        </div>
        <div className="grid gap-2">
          <Label>{t.events.fieldLocale}</Label>
          <Select value={eventLocale} onValueChange={(v) => setEventLocale(v as AppLocale)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">{t.common.french}</SelectItem>
              <SelectItem value="he">{t.common.hebrew}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "create" && (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">{t.events.fieldTemplate}</legend>
          <p className="-mt-1 text-xs text-muted-foreground">{t.events.fieldTemplateHelp}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((tpl) => {
              const value = `template:${tpl.id}`;
              return (
                <BackgroundOption
                  key={value}
                  active={start === value}
                  onClick={() => setStart(value)}
                  theme={getBackground(tpl.theme).id}
                  title={tpl.name}
                  subtitle={t.nav.templates}
                  locale={locale}
                />
              );
            })}
            {BACKGROUND_LIST.map((def) => {
              const value = `theme:${def.id}`;
              return (
                <BackgroundOption
                  key={value}
                  active={start === value}
                  onClick={() => setStart(value)}
                  theme={def.id}
                  title={def.label[locale]}
                  subtitle={def.tagline[locale]}
                  locale={locale}
                />
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function BackgroundOption({
  active,
  onClick,
  theme,
  title,
  subtitle,
  locale,
}: {
  active: boolean;
  onClick: () => void;
  theme: ThemeId;
  title: string;
  subtitle: string;
  locale: AppLocale;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "overflow-hidden rounded-2xl border text-start transition-all",
        active ? "border-gold ring-2 ring-gold/30" : "hover:border-foreground/25",
      )}
    >
      <BackdropThumb theme={theme} locale={locale} />
      <span className="block px-3 py-2">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
