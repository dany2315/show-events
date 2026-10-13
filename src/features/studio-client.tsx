"use client";

import { Eye, Languages, LayoutGrid, MonitorPlay, Save, Settings2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button, Card, Field, LinkButton, inputClass } from "@/components/ui";
import { formatMoney, pct } from "@/lib/format";
import { useShowStore } from "@/lib/store";
import type { ShowBlockId, ThemeId } from "@/lib/types";

const themeOptions: { id: ThemeId; label: string; helper: string }[] = [
  { id: "gala", label: "Gala premium", helper: "Noir, or, lumiere scenique" },
  { id: "israel", label: "Israel moderne", helper: "Bleu, blanc, accents teal" },
  { id: "light", label: "Clair institutionnel", helper: "Lisible, sobre, associatif" },
];

export function StudioClient({ eventId }: { eventId: string }) {
  const {
    events,
    organizations,
    layouts,
    totalsByEvent,
    updateEvent,
    updateLayout,
    toggleBlock,
  } = useShowStore();
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const org = organizations.find((item) => item.id === event.organizationId);
  const layout = layouts.find((item) => item.eventId === event.id) ?? layouts[0];
  const total = totalsByEvent[event.id] ?? 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Studio show"
          title="Personnaliser l'ecran geant sans casser la mise en page."
          description="Le MVP propose des themes, des blocs activables, l'objectif et les regles d'affichage. Les positions sauvegardees preparent l'editeur libre a base de blocs."
          actions={
            <>
              <LinkButton href={`/show/${event.id}`} variant="secondary">
                <Eye size={17} />
                Apercu show
              </LinkButton>
              <Button>
                <Save size={17} />
                Sauvegarde locale active
              </Button>
            </>
          }
        />

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
                <Settings2 size={20} />
                Parametres evenement
              </h2>
              <div className="grid gap-4">
                <Field label="Nom public">
                  <input className={inputClass} value={event.name} onChange={(e) => updateEvent(event.id, { name: e.target.value })} />
                </Field>
                <Field label="Objectif">
                  <input
                    className={inputClass}
                    type="number"
                    value={event.goal}
                    onChange={(e) => updateEvent(event.id, { goal: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Devise">
                  <select className={inputClass} value={event.currency} onChange={(e) => updateEvent(event.id, { currency: e.target.value as typeof event.currency })}>
                    <option value="EUR">EUR - Euro</option>
                    <option value="ILS">ILS - Shekel</option>
                    <option value="USD">USD - Dollar</option>
                  </select>
                </Field>
                <Field label="Validation des promesses mobiles">
                  <select className={inputClass} value={event.approvalMode} onChange={(e) => updateEvent(event.id, { approvalMode: e.target.value as typeof event.approvalMode })}>
                    <option value="instant">Affichage immediat</option>
                    <option value="manual">Validation par admin</option>
                  </select>
                </Field>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
                <LayoutGrid size={20} />
                Theme visuel
              </h2>
              <div className="grid gap-3">
                {themeOptions.map((theme) => (
                  <button
                    key={theme.id}
                    className={`rounded-md border p-4 text-left transition ${
                      layout.theme === theme.id
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-[#e7dfcf] bg-[#fffdf7] hover:bg-white"
                    }`}
                    onClick={() => updateLayout(event.id, { theme: theme.id })}
                  >
                    <span className="block font-black">{theme.label}</span>
                    <span className={`mt-1 block text-sm ${layout.theme === theme.id ? "text-white/72" : "text-neutral-600"}`}>
                      {theme.helper}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
                <Languages size={20} />
                Langue et direction
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Button variant={layout.locale === "fr" ? "primary" : "secondary"} onClick={() => updateLayout(event.id, { locale: "fr", direction: "ltr" })}>
                  Francais
                </Button>
                <Button variant={layout.locale === "he" ? "primary" : "secondary"} onClick={() => updateLayout(event.id, { locale: "he", direction: "rtl" })}>
                  עברית
                </Button>
              </div>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="p-5">
              <h2 className="mb-4 text-xl font-black">Blocs visibles</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {layout.blocks.map((block) => (
                  <label key={block.id} className="flex items-center justify-between rounded-md border border-[#e7dfcf] bg-[#fffdf7] p-3">
                    <span>
                      <span className="block font-bold">{block.label}</span>
                      <span className="text-xs text-neutral-500">{block.w} x {block.h}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={block.visible}
                      onChange={() => toggleBlock(event.id, block.id as ShowBlockId)}
                      className="size-5 accent-neutral-950"
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden bg-neutral-950 p-0 text-white">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div>
                  <h2 className="text-xl font-black">Preview show</h2>
                  <p className="text-sm text-white/60">Ratio 16:9 adapte au grand ecran</p>
                </div>
                <LinkButton href={`/show/${event.id}`} variant="secondary">
                  <MonitorPlay size={17} />
                  Plein ecran
                </LinkButton>
              </div>
              <div className={`show-stage spark-grid relative aspect-video overflow-hidden p-6 ${layout.theme === "light" ? "bg-white text-neutral-950" : ""}`} dir={layout.direction}>
                <div className="absolute left-6 top-6 rounded-md border border-white/20 bg-white/10 px-4 py-3 text-xl font-black">
                  {org?.logoText}
                </div>
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.28em] text-[#d7a936]">{layout.subtitle}</p>
                    <h3 className="mt-2 text-4xl font-black">{layout.title}</h3>
                    <p className="mt-5 text-7xl font-black tracking-tight">{formatMoney(total, event.currency)}</p>
                    <p className="mt-3 text-lg font-bold opacity-80">
                      Objectif {formatMoney(event.goal, event.currency)} · {pct(total, event.goal)}%
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-6 left-6 right-6 h-2 rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#d7a936]" style={{ width: `${pct(total, event.goal)}%` }} />
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
