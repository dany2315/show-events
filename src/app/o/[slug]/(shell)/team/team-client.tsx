"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MoreHorizontal, ShieldCheck, Theater, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CopyButton } from "@/components/app/event-links";
import { addMemberAction, removeMemberAction, resetMemberPasswordAction, updateMemberRoleAction } from "@/app/actions/team";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MemberRoleCode } from "@/lib/constants";

type Member = { id: string; role: MemberRoleCode; createdAt: string; userId: string; name: string; email: string };

export function TeamClient({ organizationId, currentUserId, members }: { organizationId: string; currentUserId: string; members: Member[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [, startTransition] = useTransition();

  const errorText = (code: string) => (code === "LAST_ADMIN" ? t.team.lastAdmin : code === "ACCESS" ? t.common.notAllowed : t.common.errorGeneric);

  return (
    <>
      <div className="mt-8 flex justify-end">
        <Button className="rounded-full" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" />
          {t.team.add}
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border bg-card">
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-gold">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.name}</span>
                  {m.userId === currentUserId && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t.team.you}</span>}
                </div>
                <div className="truncate text-sm text-muted-foreground" dir="ltr">
                  {m.email}
                </div>
              </div>
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  m.role === "ORG_ADMIN" ? "bg-ink text-white" : "bg-gold-soft text-[#8a6420]",
                )}
              >
                {m.role === "ORG_ADMIN" ? <ShieldCheck className="size-3.5" /> : <Theater className="size-3.5" />}
                {t.roles[m.role]}
              </span>
              <span className="hidden text-xs text-muted-foreground md:block">
                {t.team.memberSince} {formatShortDate(m.createdAt, locale)}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t.common.actions}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    onSelect={() =>
                      startTransition(async () => {
                        const next = m.role === "ORG_ADMIN" ? "SHOW_OPERATOR" : "ORG_ADMIN";
                        const res = await updateMemberRoleAction(m.id, next);
                        if (res.ok) {
                          toast.success(t.team.roleUpdated);
                          router.refresh();
                        } else toast.error(errorText(res.error));
                      })
                    }
                  >
                    {m.role === "ORG_ADMIN" ? <Theater className="size-4" /> : <ShieldCheck className="size-4" />}
                    {t.team.changeRole} → {t.roles[m.role === "ORG_ADMIN" ? "SHOW_OPERATOR" : "ORG_ADMIN"]}
                  </DropdownMenuItem>
                  {m.userId !== currentUserId && (
                    <DropdownMenuItem
                      onSelect={() =>
                        startTransition(async () => {
                          const res = await resetMemberPasswordAction(m.id);
                          if (res.ok) {
                            setCredentials({ email: m.email, password: res.tempPassword });
                            toast.success(t.team.passwordReset);
                          } else toast.error(errorText(res.error));
                        })
                      }
                    >
                      <KeyRound className="size-4" />
                      {t.team.resetPassword}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (!window.confirm(fmt(t.team.removeConfirm, { name: m.name }))) return;
                      startTransition(async () => {
                        const res = await removeMemberAction(m.id);
                        if (res.ok) {
                          toast.success(t.team.removed);
                          router.refresh();
                        } else toast.error(errorText(res.error));
                      });
                    }}
                  >
                    <UserMinus className="size-4" />
                    {t.team.remove}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (input) => {
          const res = await addMemberAction(organizationId, input);
          if (!res.ok) {
            toast.error(res.error === "ALREADY_MEMBER" ? t.team.createdExisting : errorText(res.error));
            return false;
          }
          toast.success(res.tempPassword ? t.team.created : t.team.createdExisting);
          if (res.tempPassword) setCredentials({ email: res.email, password: res.tempPassword });
          router.refresh();
          return true;
        }}
      />

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.team.credentialsTitle}</DialogTitle>
            <DialogDescription>{t.team.credentialsText}</DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t.common.email}</div>
                <div className="font-medium" dir="ltr">
                  {credentials.email}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t.team.tempPassword}</div>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-base font-semibold tracking-wider" dir="ltr">
                    {credentials.password}
                  </code>
                  <CopyButton value={`${credentials.email} / ${credentials.password}`} />
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.team.tempPasswordHelp}</p>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>{t.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: { name: string; email: string; role: MemberRoleCode }) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<MemberRoleCode>("SHOW_OPERATOR");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.team.addTitle}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setPending(true);
            const ok = await onSubmit({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), role });
            setPending(false);
            if (ok) onOpenChange(false);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="member-name">{t.common.name}</Label>
            <Input id="member-name" name="name" required minLength={2} className="h-11" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-email">{t.common.email}</Label>
            <Input id="member-email" name="email" type="email" required className="h-11" dir="ltr" />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t.team.role}</legend>
            {(["ORG_ADMIN", "SHOW_OPERATOR"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={cn("flex items-start gap-3 rounded-2xl border p-3 text-start transition-colors", role === r ? "border-gold bg-gold-soft/60" : "hover:bg-muted")}
              >
                {r === "ORG_ADMIN" ? <ShieldCheck className="mt-0.5 size-4" /> : <Theater className="mt-0.5 size-4" />}
                <span>
                  <span className="block text-sm font-medium">{t.roles[r]}</span>
                  <span className="block text-xs text-muted-foreground">{t.roles[`${r}_desc`]}</span>
                </span>
              </button>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {t.team.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
