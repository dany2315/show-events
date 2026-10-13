"use client";

import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  LayoutDashboard,
  MonitorUp,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/events/evt-gala-2026/regie", label: "Regie live", icon: Clapperboard },
  { href: "/events/evt-gala-2026/studio", label: "Studio show", icon: MonitorUp },
  { href: "/show/evt-gala-2026", label: "Ecran show", icon: BarChart3 },
  { href: "/donate/gala-lev-2026", label: "Formulaire mobile", icon: CalendarDays },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen text-neutral-950">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-[#e0d6c3] bg-[#fffdf7]/92 px-4 py-5 backdrop-blur lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid size-11 place-items-center rounded-lg bg-neutral-950 text-sm font-black text-white">
            SE
          </span>
          <span>
            <span className="block text-lg font-black leading-tight">Show Events</span>
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7a55]">
              Fundraising live
            </span>
          </span>
        </Link>

        <nav className="grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition ${
                  active ? "bg-neutral-950 text-white" : "text-neutral-700 hover:bg-black/[0.04]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-[#e7dfcf] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black">
            <ShieldCheck size={17} className="text-[#138a8a]" />
            Mode demo securise
          </div>
          <p className="text-xs leading-5 text-neutral-600">
            Better Auth est branche. Le MVP reste testable sans Neon ni Ably grace au stockage local synchronise.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-[#e0d6c3] bg-[#fffdf7]/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black">
            <span className="grid size-9 place-items-center rounded-md bg-neutral-950 text-xs text-white">SE</span>
            Show Events
          </Link>
          <Users size={20} />
        </div>
      </header>

      <main className="lg:pl-72">{children}</main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#8b6b16]">{eyebrow}</p>
        <h1 className="max-w-3xl text-3xl font-black tracking-tight text-neutral-950 md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
