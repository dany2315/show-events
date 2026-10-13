"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/app/event-links";
import { createOrganizationAction } from "@/app/actions/organization";
import { useI18n } from "@/i18n/client";
import { CURRENCIES, PLAN_TYPES, type AppLocale, type CurrencyCode, type PlanTypeCode } from "@/lib/constants";
import { slugify } from "@/lib/validation";

export function NewOrgForm() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [country, setCountry] = useState<"FR" | "IL" | "OTHER">("FR");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [locale, setLocale] = useState<AppLocale>("fr");
  const [plan, setPlan] = useState<PlanTypeCode>("EVENT_PASS");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ id: string; slug: string; adminEmail: string; tempPassword: string | null } | null>(null);

  function onCountry(v: "FR" | "IL" | "OTHER") {
    setCountry(v);
    if (v === "IL") {
      setCurrency("ILS");
      setLocale("he");
    } else if (v === "FR") {
      setCurrency("EUR");
      setLocale("fr");
    }
  }

  return (
    <>
      <form
        className="mt-8 grid gap-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          const res = await createOrganizationAction({
            name,
            slug: slug || slugify(name),
            country,
            defaultCurrency: currency,
            defaultLocale: locale,
            plan,
            adminName: String(form.get("adminName") ?? ""),
            adminEmail: String(form.get("adminEmail") ?? ""),
          });
          setPending(false);
          if (!res.ok) {
            toast.error(res.error === "SLUG_TAKEN" ? t.admin.slugTaken : t.common.errorGeneric);
            return;
          }
          toast.success(t.admin.created);
          setCreated(res);
        }}
      >
        <section className="rounded-3xl border bg-card p-6 sm:p-7">
          <h2 className="font-semibold">{t.admin.orgSection}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org-name">{t.settings.orgName}</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                required
                minLength={2}
                className="h-11"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="org-slug">{t.admin.slug}</Label>
              <div className="flex items-center rounded-lg border bg-muted/40 ps-3" dir="ltr">
                <span className="text-sm text-muted-foreground">/o/</span>
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  required
                  className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t.admin.slugHelp}</p>
            </div>
            <div className="grid gap-2">
              <Label>{t.settings.country}</Label>
              <Select value={country} onValueChange={(v) => onCountry(v as "FR" | "IL" | "OTHER")}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FR">{t.settings.countryFR}</SelectItem>
                  <SelectItem value="IL">{t.settings.countryIL}</SelectItem>
                  <SelectItem value="OTHER">{t.settings.countryOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t.settings.defaultCurrency}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
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
            </div>
            <div className="grid gap-2">
              <Label>{t.settings.defaultLocale}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as AppLocale)}>
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
        </section>

        <section className="rounded-3xl border bg-card p-6 sm:p-7">
          <h2 className="font-semibold">{t.admin.planSection}</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PLAN_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                aria-pressed={plan === p}
                className={`rounded-2xl border p-4 text-start transition-colors ${plan === p ? "border-gold bg-gold-soft/60 ring-2 ring-gold/25" : "hover:bg-muted"}`}
              >
                <div className="font-medium">{t.plans[p]}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.plans[`${p}_desc`]}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-6 sm:p-7">
          <h2 className="font-semibold">{t.admin.adminSection}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="admin-name">{t.admin.adminName}</Label>
              <Input id="admin-name" name="adminName" required minLength={2} className="h-11" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-email">{t.admin.adminEmail}</Label>
              <Input id="admin-email" name="adminEmail" type="email" required className="h-11" dir="ltr" />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t.common.create}
          </Button>
        </div>
      </form>

      <Dialog open={!!created}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t.admin.created}</DialogTitle>
            <DialogDescription>{t.admin.orgCreatedCredentials}</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t.common.email}</div>
                <div className="font-medium" dir="ltr">
                  {created.adminEmail}
                </div>
              </div>
              {created.tempPassword ? (
                <div>
                  <div className="text-xs text-muted-foreground">{t.team.tempPassword}</div>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-base font-semibold tracking-wider" dir="ltr">
                      {created.tempPassword}
                    </code>
                    <CopyButton value={`${created.adminEmail} / ${created.tempPassword}`} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">{t.team.createdExisting}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button asChild variant="outline">
              <Link href="/admin">{t.admin.title}</Link>
            </Button>
            {created && (
              <Button asChild>
                <Link href={`/admin/organizations/${created.id}`}>{t.common.open}</Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
