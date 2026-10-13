"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { FlaskConical, Heart, Languages, Loader2, Send } from "lucide-react";
import { dictionaries } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { CURRENCY_SYMBOL, formatMoney, goalProgress, parseAmountInput } from "@/lib/money";
import { MAX_DONATION_AMOUNT, SUGGESTED_AMOUNTS, type AppLocale, type CurrencyCode } from "@/lib/constants";
import { initials } from "@/components/show/fit";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

type EventInfo = {
  name: string;
  organizationName: string;
  logoUrl: string | null;
  currency: CurrencyCode;
  locale: AppLocale;
  goalAmount: number;
  status: "DRAFT" | "TEST" | "LIVE" | "ENDED";
};

function newKey() {
  return (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
}

export function DonateForm({
  token,
  event,
  initialTotal,
  cssVars,
  dark,
}: {
  token: string;
  event: EventInfo;
  initialTotal: number;
  cssVars: Record<string, string>;
  dark: boolean;
}) {
  const [locale, setLocale] = useState<AppLocale>(event.locale);
  const t = dictionaries[locale].donate;
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ name: string; amount: number } | null>(null);
  const [total, setTotal] = useState(initialTotal);
  const keyRef = useRef(newKey());
  const hydrated = useHydrated();
  const suggestions = SUGGESTED_AMOUNTS[event.currency];
  const amount = selected ?? parseAmountInput(amountText);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const donorName = name.trim();
    if (!donorName) return setError(t.errorName);
    if (!amount || amount > MAX_DONATION_AMOUNT) return setError(t.errorAmount);
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/d/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ donorName, amount, idempotencyKey: keyRef.current, website: String(form.get("website") ?? "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.code === "RATE_LIMITED" ? t.errorRate : data.code === "EVENT_ENDED" ? t.errorEnded : data.code === "EVENT_NOT_OPEN" ? t.notOpen : data.code === "UNAVAILABLE" ? t.errorUnavailable : dictionaries[locale].common.errorGeneric);
        return;
      }
      if (typeof data.total === "number") setTotal(data.total);
      setSuccess({ name: donorName, amount });
      keyRef.current = newKey();
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--show-accent") || "#e4b65c";
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.65 }, colors: [cssVars["--show-accent"] ?? accent, cssVars["--show-accent2"] ?? "#fff", "#ffffff"], disableForReducedMotion: true });
    } catch {
      setError(dictionaries[locale].common.errorNetwork);
    } finally {
      setPending(false);
    }
  }

  const progress = goalProgress(total, event.goalAmount);

  return (
    <div
      className="show-root relative min-h-dvh overflow-hidden"
      style={cssVars as React.CSSProperties}
      dir={locale === "he" ? "rtl" : "ltr"}
      lang={locale}
    >
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-6">
        <header className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 shadow-lg">
              {event.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.logoUrl} alt="" className="size-full object-contain p-1" />
              ) : (
                <span className="font-display text-lg font-semibold text-ink">{initials(event.organizationName)}</span>
              )}
            </span>
            <span className="truncate text-sm font-medium" style={{ color: "var(--show-muted)" }}>
              {event.organizationName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLocale(locale === "fr" ? "he" : "fr")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs"
            style={{ borderColor: "var(--show-panel-border)", color: "var(--show-text)" }}
          >
            <Languages className="size-3.5" />
            {locale === "fr" ? "עברית" : "Français"}
          </button>
        </header>

        <div className="mt-8">
          <h1 className="show-display text-[34px] font-semibold leading-tight">{event.name}</h1>
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="tabular text-xl font-bold" style={{ color: "var(--show-accent)" }}>
                {formatMoney(total, event.currency, locale)} <span className="text-sm font-normal" style={{ color: "var(--show-muted)" }}>{t.raised}</span>
              </span>
              <span style={{ color: "var(--show-muted)" }}>{fmt(t.goalLine, { goal: formatMoney(event.goalAmount, event.currency, locale) })}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--show-track)" }}>
              <div className="show-bar-fill h-full rounded-full transition-[width] duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {event.status === "TEST" && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-medium text-black">
            <FlaskConical className="size-4 shrink-0" />
            {t.testBanner}
          </div>
        )}
        {event.status === "ENDED" || event.status === "DRAFT" ? (
          <div className="show-panel mt-8 rounded-3xl p-6 text-center">
            <Heart className="mx-auto size-8" style={{ color: "var(--show-accent)" }} />
            <p className="mt-3 text-lg">{event.status === "ENDED" ? t.errorEnded : t.notOpen}</p>
          </div>
        ) : success ? (
          <div className="show-panel mt-8 rounded-3xl p-7 text-center animate-in zoom-in-95 fade-in duration-500">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full" style={{ background: "var(--show-accent)", color: dark ? "#111" : "#fff" }}>
              <Heart className="size-8 fill-current" />
            </div>
            <h2 className="show-display mt-5 text-3xl font-semibold">{fmt(t.successTitle, { name: success.name })}</h2>
            <p className="mt-3" style={{ color: "var(--show-muted)" }}>
              {fmt(t.successText, { amount: formatMoney(success.amount, event.currency, locale) })}
            </p>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setName("");
                setAmountText("");
                setSelected(null);
              }}
              className="mt-7 h-12 w-full rounded-2xl border text-sm font-medium"
              style={{ borderColor: "var(--show-panel-border)" }}
            >
              {t.another}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} method="post" className="show-panel mt-8 grid gap-5 rounded-3xl p-5" noValidate>
            <div>
              <h2 className="text-lg font-semibold">{t.title}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--show-muted)" }}>
                {t.subtitle}
              </p>
            </div>

            {/* Champ piège anti-robots (invisible pour les humains) */}
            <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t.yourName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="name"
                placeholder={t.yourNamePlaceholder}
                className="h-13 rounded-2xl border bg-white/95 px-4 text-base text-ink outline-none placeholder:text-ink/40 focus:ring-4"
                style={{ borderColor: "var(--show-panel-border)", ["--tw-ring-color" as string]: "color-mix(in oklab, var(--show-accent) 35%, transparent)" }}
              />
              <span className="text-xs" style={{ color: "var(--show-muted)" }}>
                {t.yourNameHelp}
              </span>
            </label>

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">{t.amount}</legend>
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelected(s);
                      setAmountText("");
                    }}
                    className={cn("tabular h-12 rounded-2xl border text-sm font-semibold transition-all", selected === s && "scale-[1.03]")}
                    style={
                      selected === s
                        ? { background: "var(--show-accent)", color: dark ? "#111" : "#fff", borderColor: "transparent" }
                        : { borderColor: "var(--show-panel-border)" }
                    }
                    aria-pressed={selected === s}
                  >
                    {formatMoney(s, event.currency, locale)}
                  </button>
                ))}
                <div className="relative col-span-3">
                  <input
                    value={amountText}
                    onChange={(e) => {
                      setAmountText(e.target.value);
                      setSelected(null);
                    }}
                    inputMode="numeric"
                    placeholder={t.otherAmount}
                    aria-label={t.otherAmount}
                    dir="ltr"
                    className="tabular h-12 w-full rounded-2xl border bg-white/95 pe-9 ps-4 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink/40"
                    style={{ borderColor: "var(--show-panel-border)" }}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-ink/50">{CURRENCY_SYMBOL[event.currency]}</span>
                </div>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200" style={dark ? undefined : { color: "#b42318" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !hydrated}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
              style={{ background: "var(--show-accent)", color: dark ? "#111" : "#fff" }}
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 rtl:-scale-x-100" />}
              {pending ? t.submitting : t.submit}
              {amount && !pending ? <span className="tabular opacity-80">· {formatMoney(amount, event.currency, locale)}</span> : null}
            </button>
            <p className="text-center text-xs" style={{ color: "var(--show-muted)" }}>
              {t.promiseNote}
            </p>
          </form>
        )}
        <div className="mt-auto pt-10 text-center text-xs" style={{ color: "var(--show-muted)" }} dir="ltr">
          Fundraising Live
        </div>
      </div>
    </div>
  );
}
