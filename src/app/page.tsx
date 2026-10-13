"use client";

import {
  ArrowUpRight,
  BadgeEuro,
  CalendarPlus,
  CheckCircle2,
  Globe2,
  MonitorPlay,
  QrCode,
  Radio,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { formatDate, formatMoney, pct } from "@/lib/format";
import { useShowStore } from "@/lib/store";

export default function Home() {
  const { organizations, events, donations, team, totalsByEvent, reset } = useShowStore();
  const liveEvent = events[0];
  const total = totalsByEvent[liveEvent.id] ?? 0;
  const approved = donations.filter((donation) => donation.eventId === liveEvent.id && donation.status === "approved");
  const pending = donations.filter((donation) => donation.eventId === liveEvent.id && donation.status === "pending");

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="MVP SaaS multi-associations"
          title="Une regie de gala simple, un show grand ecran premium."
          description="Prototype complet base sur le cahier des charges Fundraising Live: associations, promesses de dons, formulaire mobile, regie, studio visuel et diffusion live."
          actions={
            <>
              <LinkButton href={`/events/${liveEvent.id}/regie`}>
                <Radio size={17} />
                Ouvrir la regie
              </LinkButton>
              <LinkButton href={`/show/${liveEvent.id}`} variant="secondary">
                <MonitorPlay size={17} />
                Lancer le show
              </LinkButton>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Metric icon={<BadgeEuro size={20} />} label="Promesses affichees" value={formatMoney(total, liveEvent.currency)} helper={`${pct(total, liveEvent.goal)}% de l'objectif`} />
          <Metric icon={<CheckCircle2 size={20} />} label="Dons approuves" value={approved.length.toString()} helper="Inclus dans le total public" />
          <Metric icon={<QrCode size={20} />} label="En attente" value={pending.length.toString()} helper="Validation disponible" />
          <Metric icon={<UsersRound size={20} />} label="Equipe" value={team.length.toString()} helper="Super admin, admin, operateur" />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-[#e7dfcf] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">Evenements</h2>
                  <p className="text-sm text-neutral-600">Vue organisateur volontairement courte et actionnable.</p>
                </div>
                <Button variant="secondary">
                  <CalendarPlus size={17} />
                  Nouvel evenement
                </Button>
              </div>
            </div>
            <div className="divide-y divide-[#eee5d4]">
              {events.map((event) => {
                const eventOrg = organizations.find((item) => item.id === event.organizationId);
                const currentTotal = totalsByEvent[event.id] ?? 0;

                return (
                  <article key={event.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={event.status === "live" ? "teal" : "neutral"}>{event.status}</Badge>
                        <Badge tone="gold">{event.currency}</Badge>
                        <span className="text-sm font-semibold text-neutral-500">{eventOrg?.name}</span>
                      </div>
                      <h3 className="text-2xl font-black">{event.name}</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        {event.location} · {formatDate(event.startsAt)}
                      </p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eee5d4]">
                        <div
                          className="h-full rounded-full bg-[#d7a936]"
                          style={{ width: `${pct(currentTotal, event.goal)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-neutral-700">
                        {formatMoney(currentTotal, event.currency)} sur {formatMoney(event.goal, event.currency)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <LinkButton href={`/events/${event.id}/regie`} variant="secondary">Regie</LinkButton>
                      <LinkButton href={`/events/${event.id}/studio`} variant="secondary">Studio</LinkButton>
                      <LinkButton href={`/show/${event.id}`} variant="primary">Show</LinkButton>
                      <LinkButton href={`/donate/${event.publicSlug}`} variant="ghost">Mobile</LinkButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-6">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">Architecture cible</h2>
                <Badge tone="teal">Option B</Badge>
              </div>
              <div className="grid gap-3">
                {["Vercel - Next.js App Router et API", "Neon - PostgreSQL + Prisma", "Ably - diffusion temps reel", "Better Auth - comptes et sessions"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border border-[#eee5d4] bg-[#fffdf7] p-3 text-sm font-bold">
                    <Globe2 size={17} className="text-[#138a8a]" />
                    {item}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-xl font-black">Liens evenement</h2>
              <div className="grid gap-3 text-sm">
                <CopyLine label="Formulaire mobile" value={`/donate/${liveEvent.publicSlug}`} />
                <CopyLine label="Ecran show" value={`/show/${liveEvent.id}`} />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-xl font-black">Equipe demo</h2>
              <div className="grid gap-3">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-md bg-[#fffdf7] p-3">
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-xs text-neutral-500">{member.email}</p>
                    </div>
                    <Badge>{member.role.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full" variant="secondary" onClick={reset}>
                <RotateCcw size={17} />
                Reinitialiser la demo
              </Button>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-neutral-950 text-white">{icon}</div>
      <p className="text-sm font-bold text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-neutral-600">{helper}</p>
    </Card>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#eee5d4] bg-[#fffdf7] p-3">
      <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <a href={value} className="flex items-center gap-2 break-all font-semibold text-neutral-950">
        {value}
        <ArrowUpRight size={15} />
      </a>
    </div>
  );
}
