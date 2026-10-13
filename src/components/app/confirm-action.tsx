"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/client";

type Result = { ok: boolean; error?: string } | void;

/** Bouton avec confirmation qui exécute une Server Action. */
export function ConfirmAction({
  action,
  title,
  description,
  label,
  confirmLabel,
  successMessage,
  variant = "destructive",
  size = "default",
  icon,
  className,
}: {
  action: () => Promise<Result>;
  title: string;
  description: string;
  label: string;
  confirmLabel?: string;
  successMessage?: string;
  variant?: "destructive" | "outline" | "ghost" | "default";
  size?: "default" | "sm";
  icon?: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={pending} className={className}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={variant === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={() =>
              startTransition(async () => {
                const res = await action();
                if (res && !res.ok) {
                  toast.error(res.error === "LAST_ADMIN" ? t.team.lastAdmin : t.common.errorGeneric);
                  return;
                }
                if (successMessage) toast.success(successMessage);
                router.refresh();
              })
            }
          >
            {confirmLabel ?? t.common.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
