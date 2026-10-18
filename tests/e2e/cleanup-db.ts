/**
 * Supprime les données créées par les tests de bout en bout.
 * Plusieurs exécutions peuvent tourner en parallèle sur la même base (une par copie de travail) :
 * on ne supprime donc que les données de l'exécution courante (`--own`, lues dans .state.json)
 * et celles d'anciennes exécutions abandonnées (horodatage de plus de 3 h).
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const STALE_MS = 3 * 60 * 60 * 1000;

/** Horodatage base 36 en fin d'identifiant (`e2e-ui-<stamp>`, `admin-<stamp>@e2e.test`). */
function stampTime(id: string) {
  const match = /-([0-9a-z]{6,})(?:@e2e\.test)?$/.exec(id);
  const time = match ? parseInt(match[1], 36) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function ownStamp() {
  try {
    return (JSON.parse(readFileSync("tests/e2e/.state.json", "utf8")) as { stamp?: string }).stamp ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const own = process.argv.includes("--own") ? ownStamp() : null;
  const limit = Date.now() - STALE_MS;
  const doomed = (id: string) => stampTime(id) < limit || (own !== null && id.includes(own));

  const orgs = (await sql`SELECT slug FROM "organization" WHERE slug LIKE 'e2e-%'`).map((r) => r.slug as string).filter(doomed);
  const users = (await sql`SELECT email FROM "user" WHERE email LIKE '%@e2e.test'`).map((r) => r.email as string).filter(doomed);
  if (orgs.length) await sql`DELETE FROM "organization" WHERE slug = ANY(${orgs})`;
  if (users.length) await sql`DELETE FROM "user" WHERE email = ANY(${users})`;
  console.log(`[e2e] nettoyage : ${orgs.length} association(s), ${users.length} utilisateur(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
