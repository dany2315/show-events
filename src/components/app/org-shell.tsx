"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, CalendarDays, LayoutDashboard, LayoutTemplate, Menu, Settings, ShieldCheck, Users, UserRound, ArrowLeftRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

export type ShellProps = {
  org: { name: string; slug: string; logoUrl: string | null; status: "ACTIVE" | "SUSPENDED" };
  user: { name: string; email: string; isSuperAdmin: boolean };
  roleLabel: string;
  isOperator: boolean;
  hasManyOrgs: boolean;
  children: React.ReactNode;
};

export function OrgShell({ org, user, roleLabel, isOperator, hasManyOrgs, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const sidebar = (
    <SidebarContent org={org} user={user} roleLabel={roleLabel} isOperator={isOperator} hasManyOrgs={hasManyOrgs} onNavigate={() => setOpen(false)} />
  );
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen bg-sidebar text-sidebar-foreground lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="flex size-9 items-center justify-center rounded-lg border" aria-label="Menu">
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] border-none bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <span className="truncate px-3 text-sm font-semibold">{org.name}</span>
          <LocaleSwitcher />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  org,
  user,
  roleLabel,
  isOperator,
  hasManyOrgs,
  onNavigate,
}: Omit<ShellProps, "children"> & { onNavigate: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const base = `/o/${org.slug}`;
  const items = isOperator
    ? [{ href: base, label: t.nav.myEvents, icon: CalendarDays, exact: true }]
    : [
        { href: base, label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
        { href: `${base}/events`, label: t.nav.events, icon: CalendarDays },
        { href: `${base}/templates`, label: t.nav.templates, icon: LayoutTemplate },
        { href: `${base}/team`, label: t.nav.team, icon: Users },
        { href: `${base}/settings`, label: t.nav.settings, icon: Settings },
      ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Link href="/" onClick={onNavigate}>
          <Brand tone="light" />
        </Link>
      </div>
      <div className="mx-3 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="size-full object-contain p-1" />
          ) : (
            <Building2 className="size-5 text-ink/60" />
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{org.name}</div>
          <div className="truncate text-xs text-white/50">{roleLabel}</div>
        </div>
      </div>

      <nav className="mt-5 grid gap-0.5 px-3">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-white/[0.08] font-medium text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {active && <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-gold" />}
              <Icon className={cn("size-[18px]", active && "text-gold")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-1 px-3 pb-5">
        {user.isSuperAdmin && (
          <Link href="/admin" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gold hover:bg-white/[0.04]">
            <ShieldCheck className="size-[18px]" />
            {t.nav.backToAdmin}
          </Link>
        )}
        {hasManyOrgs && (
          <Link href="/app" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white">
            <ArrowLeftRight className="size-[18px]" />
            {t.nav.switchOrg}
          </Link>
        )}
        <Link href="/account" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white">
          <UserRound className="size-[18px]" />
          <span className="min-w-0 flex-1 truncate">{user.name}</span>
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
          <LocaleSwitcher tone="dark" />
          <SignOutButton variant="ghost" className="text-white/60 hover:bg-white/[0.06] hover:text-white" />
        </div>
      </div>
    </div>
  );
}
