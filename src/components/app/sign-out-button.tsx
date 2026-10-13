"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/i18n/client";

export function SignOutButton({ variant = "outline", className }: { variant?: "outline" | "ghost"; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant={variant}
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4 rtl:rotate-180" />
      {t.common.logout}
    </Button>
  );
}
