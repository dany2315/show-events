"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShowStage } from "@/components/show/stage";
import { ShowViewport } from "@/components/show/viewport";
import { deleteTemplateAction, renameTemplateAction } from "@/app/actions/studio";
import { useI18n } from "@/i18n/client";
import { demoDonations, demoEvent } from "@/lib/show/demo";
import { EMPTY_CONTROL } from "@/lib/live/types";
import { THEMES } from "@/lib/show/themes";
import { formatShortDate } from "@/lib/dates";
import type { ShowConfig } from "@/lib/show/config";

type Template = { id: string; name: string; createdAt: string; config: ShowConfig };

export function TemplatesClient({ templates, orgName, logoUrl }: { templates: Template[]; orgName: string; logoUrl: string | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const event = useMemo(() => demoEvent(locale, { organizationName: orgName, logoUrl }), [locale, orgName, logoUrl]);
  const donations = useMemo(() => demoDonations(locale), [locale]);

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((tpl) => {
        const config = { ...tpl.config, animation: { ...tpl.config.animation, ambient: false } };
        return (
          <article key={tpl.id} className="overflow-hidden rounded-3xl border bg-card">
            <div className="pointer-events-none aspect-video">
              <ShowViewport className="size-full">
                <ShowStage config={config} event={event} total={Math.round(event.goalAmount * 0.63)} donations={donations} control={EMPTY_CONTROL} formUrl={null} lowPower />
              </ShowViewport>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{tpl.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {THEMES[tpl.config.theme].label[locale]} · {formatShortDate(tpl.createdAt, locale)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.templates.rename}
                  onClick={() => {
                    const name = window.prompt(t.templates.rename, tpl.name);
                    if (!name || name.trim() === tpl.name) return;
                    startTransition(async () => {
                      const res = await renameTemplateAction(tpl.id, name);
                      if (res.ok) {
                        toast.success(t.templates.renamed);
                        router.refresh();
                      } else toast.error(t.common.errorGeneric);
                    });
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.common.delete}
                  onClick={() => {
                    if (!window.confirm(t.templates.deleteConfirm)) return;
                    startTransition(async () => {
                      const res = await deleteTemplateAction(tpl.id);
                      if (res.ok) {
                        toast.success(t.templates.deleted);
                        router.refresh();
                      } else toast.error(t.common.errorGeneric);
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
