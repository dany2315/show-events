"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { ArrowRight, FlaskConical, Heart, Languages, Loader2, Send, ShieldCheck } from "lucide-react";
import { dictionaries } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { CURRENCY_SYMBOL, formatMoney, parseAmountInput } from "@/lib/money";
import {
  MAX_DONATION_AMOUNT,
  MAX_EMAIL_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  MAX_PHONE_INPUT_LENGTH,
  SUGGESTED_AMOUNTS,
  type AppLocale,
  type CurrencyCode,
} from "@/lib/constants";
import { looksLikeEmail, normalizePhone } from "@/lib/donor";
import { contrastText, type CategoryDef } from "@/lib/categories";
import { initials } from "@/components/show/fit";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { TEST_DONATION_LIMIT } from "@/lib/lifecycle";

type EventInfo = {
  name: string;
  organizationName: string;
  logoUrl: string | null;
  currency: CurrencyCode;
  locale: AppLocale;
  goalAmount: number;
  status: "DRAFT" | "TEST" | "LIVE" | "ENDED";
  categories: CategoryDef[];
  /** Page de la campagne de dons (http/https, revalidée côté serveur) : redirection après la promesse. */
  campaignUrl: string | null;
};

/** Délai avant la redirection vers la page de la campagne. */
const REDIRECT_SECONDS = 5;

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Field | null>(null);
  const [success, setSuccess] = useState<{ name: string; amount: number } | null>(null);
  const [total, setTotal] = useState(initialTotal);
  const keyRef = useRef(newKey());
  const hydrated = useHydrated();
  const suggestions = SUGGESTED_AMOUNTS[event.currency];
  const amount = selected ?? parseAmountInput(amountText);

  // Redirection vers la page de la campagne (finalisation du don) : compte à rebours annulable.
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const target = event.campaignUrl;
    if (countdown === null || !target) return;
    if (countdown <= 0) {
      // Même onglet : le donateur finalise son don sur la page de la campagne.
      window.location.assign(target);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, event.campaignUrl]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const first = firstName.trim();
    const last = lastName.trim();
    const fail = (field: Field, message: string) => {
      setInvalid(field);
      setError(message);
      document.getElementById(`donor-${field}`)?.focus();
    };
    if (!first) return fail("firstName", t.errorFirstName);
    if (!last) return fail("lastName", t.errorLastName);
    if (!normalizePhone(phone)) return fail("phone", phone.trim() ? t.errorPhone : t.errorPhoneRequired);
    if (email.trim() && !looksLikeEmail(email)) return fail("email", t.errorEmail);
    if (!amount || amount > MAX_DONATION_AMOUNT) return fail("amount", t.errorAmount);
    setInvalid(null);
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/d/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          phone: phone.trim(),
          email: email.trim(),
          anonymous,
          categoryId,
          amount,
          idempotencyKey: keyRef.current,
          website: String(form.get("website") ?? ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.code === "RATE_LIMITED"
            ? t.errorRate
            : data.code === "TEST_LIMIT_REACHED"
              ? fmt(t.errorTestLimit, { max: TEST_DONATION_LIMIT })
              : data.code === "EVENT_ENDED"
                ? t.errorEnded
                : data.code === "EVENT_NOT_OPEN"
                  ? t.notOpen
                  : data.code === "UNAVAILABLE"
                    ? t.errorUnavailable
                    : dictionaries[locale].common.errorGeneric,
        );
        return;
      }
      if (typeof data.total === "number") setTotal(data.total);
      setSuccess({ name: first, amount });
      if (event.campaignUrl) setCountdown(REDIRECT_SECONDS);
      keyRef.current = newKey();
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--show-accent") || "#e4b65c";
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.65 }, colors: [cssVars["--show-accent"] ?? accent, cssVars["--show-accent2"] ?? "#fff", "#ffffff"], disableForReducedMotion: true });
    } catch {
      setError(dictionaries[locale].common.errorNetwork);
    } finally {
      setPending(false);
    }
  }

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
            {event.campaignUrl && (
              <div className="mt-6 grid gap-3">
                <p className="text-sm">{t.finalizeHelp}</p>
                <a
                  href={event.campaignUrl}
                  rel="noopener noreferrer"
                  data-campaign-link
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-lg transition-transform active:scale-[0.98]"
                  style={{ background: "var(--show-accent)", color: dark ? "#111" : "#fff" }}
                >
                  {t.finalize}
                  <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
                </a>
                {countdown !== null ? (
                  <div className="grid gap-1 text-sm" style={{ color: "var(--show-muted)" }}>
                    <p role="status" aria-live="polite">
                      {fmt(t.redirecting, { seconds: Math.max(0, countdown) })}
                    </p>
                    <button type="button" onClick={() => setCountdown(null)} className="mx-auto underline underline-offset-4" style={{ color: "var(--show-text)" }}>
                      {t.stay}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                // Coordonnées conservées (même donateur) : seul le montant est à ressaisir.
                setSuccess(null);
                setCountdown(null);
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

            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="donor-firstName"
                label={t.firstName}
                value={firstName}
                onChange={setFirstName}
                invalid={invalid === "firstName"}
                maxLength={MAX_PERSON_NAME_LENGTH}
                autoComplete="given-name"
                placeholder={t.firstNamePlaceholder}
              />
              <TextField
                id="donor-lastName"
                label={t.lastName}
                value={lastName}
                onChange={setLastName}
                invalid={invalid === "lastName"}
                maxLength={MAX_PERSON_NAME_LENGTH}
                autoComplete="family-name"
                placeholder={t.lastNamePlaceholder}
              />
            </div>

            <label className="-mt-1 flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-5 shrink-0 rounded accent-[var(--show-accent)]"
              />
              <span>
                {t.anonymous}
                <span className="block text-xs" style={{ color: "var(--show-muted)" }}>
                  {fmt(t.shownAs, { name: anonymous ? dictionaries[event.locale].regie.anonymous : `${firstName.trim()} ${lastName.trim()}`.trim() || "…" })}
                </span>
              </span>
            </label>

            <TextField
              id="donor-phone"
              label={t.phone}
              value={phone}
              onChange={setPhone}
              invalid={invalid === "phone"}
              type="tel"
              inputMode="tel"
              maxLength={MAX_PHONE_INPUT_LENGTH}
              autoComplete="tel"
              placeholder={t.phonePlaceholder}
              dir="ltr"
            />
            <TextField
              id="donor-email"
              label={t.email}
              hint={dictionaries[locale].common.optional}
              value={email}
              onChange={setEmail}
              invalid={invalid === "email"}
              type="email"
              inputMode="email"
              maxLength={MAX_EMAIL_LENGTH}
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              dir="ltr"
            />

            {event.categories.length > 0 && (
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-sm font-medium">
                  {t.category}
                  <span className="ms-1 font-normal" style={{ color: "var(--show-muted)" }}>
                    ({dictionaries[locale].common.optional})
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.category}>
                  {[{ id: null, name: t.categoryNone, color: null } as const, ...event.categories].map((c) => {
                    const active = categoryId === c.id;
                    return (
                      <button
                        key={c.id ?? "none"}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setCategoryId(c.id)}
                        className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all"
                        style={
                          !active
                            ? { borderColor: "var(--show-panel-border)" }
                            : c.color
                              ? { background: c.color, color: contrastText(c.color), borderColor: "transparent" }
                              : { background: "var(--show-accent)", color: dark ? "#111" : "#fff", borderColor: "transparent" }
                        }
                      >
                        {c.color && <span aria-hidden className="size-2.5 rounded-full" style={{ background: active ? "currentColor" : c.color }} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

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
                    id="donor-amount"
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
            <div className="grid gap-1.5 text-center text-xs" style={{ color: "var(--show-muted)" }}>
              <p>{t.promiseNote}</p>
              <p className="text-balance">
                <ShieldCheck className="-mt-0.5 me-1 inline size-3.5" aria-hidden />
                {t.consent}
              </p>
            </div>
          </form>
        )}
        <div className="mt-auto flex justify-center pt-10" style={{ color: "var(--show-muted)" }}>
          {/* Signature discrète : logo une couleur, à la taille minimale du guide (120 px de large). */}
          <Brand mono className="h-[30px]" />
        </div>
      </div>
    </div>
  );
}

type Field = "firstName" | "lastName" | "phone" | "email" | "amount";

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  invalid,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "maxLength" | "autoComplete" | "placeholder" | "dir">) {
  return (
    <label className="grid min-w-0 gap-1.5" htmlFor={id}>
      <span className="text-sm font-medium">
        {label}
        {hint && (
          <span className="ms-1 font-normal" style={{ color: "var(--show-muted)" }}>
            ({hint})
          </span>
        )}
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full min-w-0 rounded-2xl border bg-white/95 px-4 text-base text-ink outline-none placeholder:text-ink/40 focus:ring-4",
          invalid && "ring-4 ring-red-500/40",
        )}
        style={{ borderColor: invalid ? "#ef4444" : "var(--show-panel-border)", ["--tw-ring-color" as string]: invalid ? undefined : "color-mix(in oklab, var(--show-accent) 35%, transparent)" }}
        {...input}
      />
    </label>
  );
}
