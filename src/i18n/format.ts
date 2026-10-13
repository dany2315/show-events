/** Remplace les variables {nom} d'un texte traduit. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

type Counts = Record<"events_one" | "events_other" | "members_one" | "members_other" | "credits_one" | "credits_other" | "promises_one" | "promises_other", string>;

/** Libellé singulier / pluriel (« 1 membre », « 3 membres »). */
export function countLabel(counts: Counts, kind: "events" | "members" | "credits" | "promises", count: number) {
  return fmt(counts[`${kind}_${count === 1 ? "one" : "other"}`], { count });
}
