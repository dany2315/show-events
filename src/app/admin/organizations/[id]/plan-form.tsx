"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSubscriptionAction } from "@/app/actions/organization";
import { useI18n } from "@/i18n/client";
import { PLAN_TYPES, SUBSCRIPTION_STATUSES, type PlanTypeCode, type SubscriptionStatusCode } from "@/lib/constants";
import { isSubscriptionPlan } from "@/lib/billing";

type Defaults = { plan: PlanTypeCode; status: SubscriptionStatusCode; eventCredits: number; currentPeriodEnd: string; notes: string };

export function PlanForm({ organizationId, defaults }: { organizationId: string; defaults: Defaults }) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-3xl border bg-card p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await updateSubscriptionAction(organizationId, values);
        setPending(false);
        if (res.ok) {
          toast.success(t.admin.planUpdated);
          router.refresh();
        } else toast.error(t.common.errorGeneric);
      }}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CreditCard className="size-5 text-muted-foreground" />
        {t.admin.planSection}
      </h2>
      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <Label>{t.settings.plan}</Label>
          <Select value={values.plan} onValueChange={(v) => setValues({ ...values, plan: v as PlanTypeCode })}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_TYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t.plans[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t.common.status}</Label>
          <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as SubscriptionStatusCode })}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t.subscriptionStatus[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!isSubscriptionPlan(values.plan) ? (
          <div className="grid gap-2">
            <Label htmlFor="credits">{t.admin.credits}</Label>
            <div className="flex gap-2">
              <Input
                id="credits"
                type="number"
                min={0}
                value={values.eventCredits}
                onChange={(e) => setValues({ ...values, eventCredits: Math.max(0, Number(e.target.value) || 0) })}
                className="tabular h-10"
              />
              <Button type="button" variant="outline" onClick={() => setValues({ ...values, eventCredits: values.eventCredits + 1 })}>
                <Plus className="size-4" />1
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="period">{t.admin.periodEnd}</Label>
            <Input id="period" type="date" value={values.currentPeriodEnd} onChange={(e) => setValues({ ...values, currentPeriodEnd: e.target.value })} className="h-10" dir="ltr" />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="notes">{t.admin.notes}</Label>
          <Textarea id="notes" value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} rows={3} maxLength={1000} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="mt-5 w-full rounded-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t.common.save}
      </Button>
    </form>
  );
}
