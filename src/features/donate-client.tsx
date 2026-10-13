"use client";

import { Gift, Link2, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Field, inputClass, textareaClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { useShowStore } from "@/lib/store";

export function DonateClient({ slug }: { slug: string }) {
  const { events, organizations, addDonation } = useShowStore();
  const event = events.find((item) => item.publicSlug === slug) ?? events[0];
  const org = organizations.find((item) => item.id === event.organizationId);
  const [sent, setSent] = useState(false);

  function submit(formData: FormData) {
    const amount = Number(formData.get("amount") || 0);
    if (amount <= 0) return;

    addDonation({
      eventId: event.id,
      donorName: String(formData.get("donorName") || "Donateur anonyme"),
      amount,
      currency: event.currency,
      message: String(formData.get("message") || ""),
      source: "mobile",
      isPledge: true,
      isTest: false,
      status: event.approvalMode === "instant" ? "approved" : "pending",
    });
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-[#111525] px-4 py-6 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-md content-center">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-xl bg-white text-2xl font-black text-neutral-950">
            {org?.logoText}
          </div>
          <Badge tone="gold">Lien prive evenement</Badge>
          <h1 className="mt-4 text-3xl font-black">{event.name}</h1>
          <p className="mt-2 text-white/70">Scannez, remplissez, envoyez. Aucun compte et aucun code requis.</p>
        </div>

        <Card className="border-white/12 bg-white p-5 text-neutral-950">
          {sent ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[#e8fbf8] text-[#138a8a]">
                <Sparkles size={28} />
              </div>
              <h2 className="text-2xl font-black">Promesse envoyee</h2>
              <p className="mt-2 text-neutral-600">
                Merci. Elle est maintenant {event.approvalMode === "instant" ? "visible sur le show" : "en attente de validation"}.
              </p>
              <Button className="mt-6" variant="secondary" onClick={() => setSent(false)}>
                Ajouter une autre promesse
              </Button>
            </div>
          ) : (
            <form action={submit} className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-md bg-neutral-950 text-white">
                  <Gift size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Ma promesse</h2>
                  <p className="text-sm text-neutral-600">Devise de l&apos;evenement: {event.currency}</p>
                </div>
              </div>
              <Field label="Votre nom">
                <input className={inputClass} name="donorName" placeholder="Famille Cohen" />
              </Field>
              <Field label="Montant">
                <input className={inputClass} name="amount" type="number" min="1" placeholder="500" required />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1800].map((amount) => (
                  <button key={amount} type="button" className="rounded-md border border-[#ded5c1] px-2 py-3 text-sm font-black" onClick={() => {
                    const input = document.querySelector<HTMLInputElement>("input[name='amount']");
                    if (input) input.value = String(amount);
                  }}>
                    {formatMoney(amount, event.currency)}
                  </button>
                ))}
              </div>
              <Field label="Message optionnel">
                <textarea className={textareaClass} name="message" placeholder="Un mot pour l'association" />
              </Field>
              <Button className="h-12">
                <Send size={17} />
                Envoyer ma promesse
              </Button>
              <p className="flex items-center gap-2 text-xs text-neutral-500">
                <Link2 size={14} />
                Ce formulaire est accessible uniquement aux personnes qui possedent le lien de l&apos;evenement.
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
