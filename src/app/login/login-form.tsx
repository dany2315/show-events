"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/i18n/client";
import { useHydrated } from "@/lib/use-hydrated";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      rememberMe: true,
    });
    if (signInError) {
      setPending(false);
      setError(signInError.status === 429 ? t.auth.tooMany : t.auth.invalid);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} method="post" className="mt-10 grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">{t.common.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" dir="ltr" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t.auth.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" dir="ltr" />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || !hydrated} className="h-11 text-base">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? t.auth.submitting : t.auth.submit}
      </Button>
    </form>
  );
}
