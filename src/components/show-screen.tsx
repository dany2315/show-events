"use client";

import QRCode from "qrcode";
import { Maximize2, QrCode, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { formatMoney, pct } from "@/lib/format";
import { getPublicEventUrl, useShowStore } from "@/lib/store";

export function ShowScreen({ eventId }: { eventId: string }) {
  const { events, organizations, donations, layouts, totalsByEvent } = useShowStore();
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const org = organizations.find((item) => item.id === event.organizationId);
  const layout = layouts.find((item) => item.eventId === event.id) ?? layouts[0];
  const total = totalsByEvent[event.id] ?? 0;
  const progress = pct(total, event.goal);
  const [qr, setQr] = useState("");
  const eventDonations = useMemo(
    () =>
      donations
        .filter((donation) => donation.eventId === event.id)
        .filter((donation) => donation.status !== "rejected" && donation.status !== "cancelled")
        .slice(0, 8),
    [donations, event.id],
  );

  useEffect(() => {
    QRCode.toDataURL(getPublicEventUrl(event.publicSlug), {
      margin: 1,
      width: 280,
      color: { dark: "#111525", light: "#ffffff" },
    }).then(setQr);
  }, [event.publicSlug]);

  const visible = (id: string) => layout.blocks.find((block) => block.id === id)?.visible ?? true;
  const light = layout.theme === "light";

  return (
    <main
      className={`show-stage spark-grid relative min-h-screen overflow-hidden ${light ? "bg-[#f8f5ec] text-neutral-950" : "text-white"}`}
      dir={layout.direction}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_36%,rgba(255,255,255,0.05))]" />
      <div className="relative z-10 grid min-h-screen grid-rows-[auto_1fr_auto] p-6 md:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          {visible("logo") ? (
            <div className={`flex items-center gap-4 rounded-lg border p-4 ${light ? "border-neutral-200 bg-white" : "border-white/15 bg-white/10"}`}>
              <div className="grid size-16 place-items-center rounded-md bg-white text-2xl font-black text-neutral-950">
                {org?.logoText}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-[#d7a936]">{org?.name}</p>
                <h1 className="text-2xl font-black md:text-4xl">{event.name}</h1>
              </div>
            </div>
          ) : <div />}

          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/90" onClick={() => document.documentElement.requestFullscreen?.()}>
              <Maximize2 size={17} />
              Plein ecran
            </Button>
          </div>
        </header>

        <section className="grid gap-8 py-8 xl:grid-cols-[1fr_380px] xl:items-center">
          <div className="animate-rise">
            <p className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.32em] text-[#d7a936]">
              <Sparkles size={18} />
              {layout.subtitle}
            </p>
            {visible("total") ? (
              <div className="animate-pulse-soft">
                <p className="text-lg font-black uppercase tracking-[0.2em] opacity-70">Total des promesses</p>
                <div className="mt-3 text-[clamp(4rem,11vw,12rem)] font-black leading-none tracking-tight">
                  {formatMoney(total, event.currency)}
                </div>
              </div>
            ) : null}

            {visible("goal") ? (
              <div className="mt-8 max-w-4xl">
                <div className="mb-3 flex items-center justify-between text-lg font-black">
                  <span>Objectif {formatMoney(event.goal, event.currency)}</span>
                  <span>{progress}%</span>
                </div>
                <div className={`h-5 overflow-hidden rounded-full ${light ? "bg-neutral-200" : "bg-white/16"}`}>
                  <div className="h-full rounded-full bg-[#d7a936] shadow-[0_0_34px_rgba(215,169,54,0.62)] transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}
          </div>

          <aside className="grid gap-5">
            {visible("qr") ? (
              <div className={`rounded-lg border p-5 ${light ? "border-neutral-200 bg-white" : "border-white/15 bg-white/10"}`}>
                <div className="mb-4 flex items-center gap-2 text-lg font-black">
                  <QrCode size={22} className="text-[#d7a936]" />
                  Scanner pour donner
                </div>
                {qr ? (
                  <Image
                    src={qr}
                    alt="QR code donateur"
                    width={280}
                    height={280}
                    unoptimized
                    className="mx-auto rounded-md bg-white p-3"
                  />
                ) : null}
                <p className="mt-3 text-center text-sm font-bold opacity-70">Scan direct, sans compte</p>
              </div>
            ) : null}

            {visible("donations") ? (
              <div className={`rounded-lg border p-5 ${light ? "border-neutral-200 bg-white" : "border-white/15 bg-white/10"}`}>
                <h2 className="mb-4 text-xl font-black">Dernieres promesses</h2>
                <div className="grid gap-3">
                  {eventDonations.slice(0, 5).map((donation) => (
                    <div key={donation.id} className={`rounded-md p-3 ${light ? "bg-[#f7f5ef]" : "bg-white/10"}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <strong className="text-lg">{donation.donorName}</strong>
                        <span className="text-xl font-black text-[#d7a936]">{formatMoney(donation.amount, donation.currency)}</span>
                      </div>
                      {donation.message ? <p className="mt-1 text-sm opacity-70">{donation.message}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </section>

        {visible("ticker") ? (
          <footer className={`overflow-hidden rounded-lg border py-4 ${light ? "border-neutral-200 bg-white" : "border-white/15 bg-white/10"}`}>
            <div className="ticker-track flex w-max gap-8 whitespace-nowrap px-6 text-2xl font-black">
              {[...eventDonations, ...eventDonations].map((donation, index) => (
                <span key={`${donation.id}-${index}`}>
                  {donation.donorName} · <span className="text-[#d7a936]">{formatMoney(donation.amount, donation.currency)}</span>
                </span>
              ))}
            </div>
          </footer>
        ) : null}
      </div>
    </main>
  );
}
