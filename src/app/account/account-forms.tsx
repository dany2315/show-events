"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignOutButton } from "@/components/app/sign-out-button";
import { updateProfileAction } from "@/app/actions/team";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/i18n/client";

export function AccountForms({ name, email, roleLabel, demo = false }: { name: string; email: string; roleLabel: string | null; demo?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [profileName, setProfileName] = useState(name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  return (
    <div className="mt-8 grid gap-6">
      <form
        className="rounded-3xl border bg-card p-6 sm:p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setSavingProfile(true);
          const res = await updateProfileAction(profileName);
          setSavingProfile(false);
          if (res.ok) {
            toast.success(t.account.nameUpdated);
            router.refresh();
          } else toast.error(t.common.errorGeneric);
        }}
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserRound className="size-5 text-muted-foreground" />
          {t.account.profile}
          {roleLabel && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-gold">{roleLabel}</span>}
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{t.common.name}</Label>
            <Input id="profile-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} minLength={2} required className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label>{t.common.email}</Label>
            <Input value={email} disabled className="h-11" dir="ltr" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={savingProfile || profileName.trim() === name} className="rounded-full">
            {savingProfile && <Loader2 className="size-4 animate-spin" />}
            {t.common.save}
          </Button>
        </div>
      </form>

      {demo ? (
        <p className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground sm:p-7" data-demo-account>
          {t.demo.limitPassword}
        </p>
      ) : (
        <form
          className="rounded-3xl border bg-card p-6 sm:p-7"
          onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const form = new FormData(formEl);
            const current = String(form.get("current") ?? "");
            const next = String(form.get("next") ?? "");
            const confirm = String(form.get("confirm") ?? "");
            if (next.length < 8) return toast.error(t.account.passwordTooShort);
            if (next !== confirm) return toast.error(t.account.passwordMismatch);
            setSavingPassword(true);
            const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
            setSavingPassword(false);
            if (error) {
              toast.error(error.status === 400 || error.status === 401 ? t.account.passwordWrong : t.common.errorGeneric);
              return;
            }
            formEl.reset();
            toast.success(t.account.passwordChanged);
          }}
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="size-5 text-muted-foreground" />
            {t.account.changePassword}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="pw-current">{t.account.currentPassword}</Label>
              <Input id="pw-current" name="current" type="password" autoComplete="current-password" required className="h-11" dir="ltr" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-next">{t.account.newPassword}</Label>
              <Input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={8} required className="h-11" dir="ltr" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-confirm">{t.account.confirmPassword}</Label>
              <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="h-11" dir="ltr" />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={savingPassword} className="rounded-full">
              {savingPassword && <Loader2 className="size-4 animate-spin" />}
              {t.account.changePassword}
            </Button>
          </div>
        </form>
      )}

      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </div>
  );
}
