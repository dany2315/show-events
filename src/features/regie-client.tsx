"use client";

import { Check, Euro, MonitorPlay, Pause, Play, Send, Sparkles, X } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, Field, LinkButton, inputClass, textareaClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { useShowStore } from "@/lib/store";
import type { Donation } from "@/lib/types";

const quickAmounts = [100, 260, 500, 1000, 1800, 2600, 5000, 10000];

export function RegieClient({ eventId }: { eventId: string }) {
  const { events, donations, totalsByEvent, addDonation, updateDonationStatus, updateEvent } = useShowStore();
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const eventDonations = donations.filter((donation) => donation.eventId === event.id);
  const total = totalsByEvent[event.id] ?? 0;

  function submit(formData: FormData) {
    const donorName = String(formData.get("donorName") || "Donateur anonyme");
    const amount = Number(formData.get("amount") || 0);
    const message = String(formData.get("message") || "");

    if (amount <= 0) return;
    addDonation({
      eventId: event.id,
      donorName,
      amount,
      currency: event.currency,
      message,
      source: "manual",
      isPledge: true,
      isTest: false,
      status: "approved",
    });
  }

  function quick(amount: number) {
    addDonation({
      eventId: event.id,
      donorName: "Promesse annoncee au micro",
      amount,
      currency: event.currency,
      source: "quick",
      isPledge: true,
      isTest: false,
      status: "approved",
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Regie live"
          title={event.name}
          description="Saisissez les promesses annoncees, validez les entrees mobiles et pilotez le statut du show sans complexite technique."
          actions={
            <>
              <LinkButton href={`/show/${event.id}`} variant="secondary">
                <MonitorPlay size={17} />
                Ecran show
              </LinkButton>
              <Button
                variant={event.status === "live" ? "secondary" : "primary"}
                onClick={() => updateEvent(event.id, { status: event.status === "live" ? "paused" : "live" })}
              >
                {event.status === "live" ? <Pause size={17} /> : <Play size={17} />}
                {event.status === "live" ? "Mettre en pause" : "Passer live"}
              </Button>
            </>
          }
        />

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-bold text-neutral-500">Total public</p>
            <p className="mt-2 text-4xl font-black">{formatMoney(total, event.currency)}</p>
            <Badge tone={event.status === "live" ? "teal" : "gold"}>{event.status}</Badge>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-bold text-neutral-500">Promesses recues</p>
            <p className="mt-2 text-4xl font-black">{eventDonations.length}</p>
            <p className="text-sm text-neutral-600">Mobile, manuel et montants rapides</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-bold text-neutral-500">Mode validation</p>
            <p className="mt-2 text-2xl font-black">{event.approvalMode === "instant" ? "Affichage immediat" : "Validation admin"}</p>
            <p className="text-sm text-neutral-600">Configurable par evenement</p>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
                <Sparkles size={20} className="text-[#d7a936]" />
                Montants rapides
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                {quickAmounts.map((amount) => (
                  <Button key={amount} variant="secondary" className="h-14 text-base" onClick={() => quick(amount)}>
                    <Euro size={17} />
                    {formatMoney(amount, event.currency)}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-xl font-black">Saisie manuelle</h2>
              <form action={submit} className="grid gap-4">
                <Field label="Nom du donateur">
                  <input className={inputClass} name="donorName" placeholder="Famille Cohen" />
                </Field>
                <Field label="Montant">
                  <input className={inputClass} name="amount" type="number" min="1" placeholder="1800" required />
                </Field>
                <Field label="Message">
                  <textarea className={textareaClass} name="message" placeholder="Message optionnel affiche dans la regie" />
                </Field>
                <Button>
                  <Send size={17} />
                  Envoyer au show
                </Button>
              </form>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-[#e7dfcf] p-5">
              <h2 className="text-xl font-black">Flux des promesses</h2>
              <p className="text-sm text-neutral-600">Les ecrans ouverts se synchronisent automatiquement.</p>
            </div>
            <div className="max-h-[720px] divide-y divide-[#eee5d4] overflow-auto">
              {eventDonations.map((donation) => (
                <DonationRow
                  key={donation.id}
                  donation={donation}
                  onApprove={() => updateDonationStatus(donation.id, "approved")}
                  onReject={() => updateDonationStatus(donation.id, "rejected")}
                />
              ))}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function DonationRow({
  donation,
  onApprove,
  onReject,
}: {
  donation: Donation;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className={`grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center ${donation.status === "rejected" ? "opacity-50" : ""}`}>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={donation.status === "approved" ? "teal" : donation.status === "pending" ? "gold" : "red"}>
            {donation.status}
          </Badge>
          <Badge>{donation.source}</Badge>
          {donation.isTest ? <Badge tone="red">fictif</Badge> : null}
        </div>
        <h3 className="text-lg font-black">{donation.donorName}</h3>
        <p className="text-sm text-neutral-600">{donation.message || "Aucun message"}</p>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <strong className="mr-2 text-2xl font-black">{formatMoney(donation.amount, donation.currency)}</strong>
        <Button variant="secondary" className="size-10 px-0" onClick={onApprove} aria-label="Approuver">
          <Check size={17} />
        </Button>
        <Button variant="danger" className="size-10 px-0" onClick={onReject} aria-label="Rejeter">
          <X size={17} />
        </Button>
      </div>
    </article>
  );
}
