"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setOrgLogoAction, updateOrgSettingsAction } from "@/app/actions/organization";
import { uploadImage } from "@/lib/upload-client";
import { useI18n } from "@/i18n/client";
import { CURRENCIES, type AppLocale, type CurrencyCode } from "@/lib/constants";

type Defaults = { name: string; country: "FR" | "IL" | "OTHER"; defaultCurrency: CurrencyCode; defaultLocale: AppLocale; logoUrl: string | null };

export function SettingsForm({ organizationId, defaults }: { organizationId: string; defaults: Defaults }) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [pending, setPending] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await updateOrgSettingsAction(organizationId, {
      name: values.name,
      country: values.country,
      defaultCurrency: values.defaultCurrency,
      defaultLocale: values.defaultLocale,
    });
    setPending(false);
    if (res.ok) {
      toast.success(t.settings.saved);
      router.refresh();
    } else toast.error(t.common.errorGeneric);
  }

  async function changeLogo(url: string | null) {
    const res = await setOrgLogoAction(organizationId, url);
    if (res.ok) {
      setValues((v) => ({ ...v, logoUrl: url }));
      toast.success(t.settings.saved);
      router.refresh();
    } else toast.error(t.common.errorGeneric);
  }

  return (
    <form onSubmit={save} className="rounded-3xl border bg-card p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
          {values.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={values.logoUrl} alt="" className="size-full object-contain p-2" />
          ) : (
            <Building2 className="size-8 text-muted-foreground" />
          )}
        </div>
        <div>
          <div className="font-medium">{t.settings.logo}</div>
          <p className="text-sm text-muted-foreground">{t.settings.logoHelp}</p>
          <div className="mt-3 flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setLogoBusy(true);
                try {
                  await changeLogo(await uploadImage(organizationId, file));
                } catch (error) {
                  toast.error(error instanceof Error && error.message !== "upload" ? error.message : t.common.errorGeneric);
                } finally {
                  setLogoBusy(false);
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logoBusy}>
              {logoBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              {t.studio.upload}
            </Button>
            {values.logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => changeLogo(null)} disabled={logoBusy}>
                <Trash2 className="size-3.5" />
                {t.settings.removeLogo}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="org-name">{t.settings.orgName}</Label>
          <Input id="org-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required minLength={2} className="h-11" />
        </div>
        <div className="grid gap-2">
          <Label>{t.settings.country}</Label>
          <Select value={values.country} onValueChange={(v) => setValues({ ...values, country: v as Defaults["country"] })}>
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
          <Select value={values.defaultCurrency} onValueChange={(v) => setValues({ ...values, defaultCurrency: v as CurrencyCode })}>
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
          <Select value={values.defaultLocale} onValueChange={(v) => setValues({ ...values, defaultLocale: v as AppLocale })}>
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
      <div className="mt-8 flex justify-end">
        <Button type="submit" disabled={pending} className="rounded-full px-6">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}
