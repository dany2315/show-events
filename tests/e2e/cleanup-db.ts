/** Supprime toutes les données créées par les tests de bout en bout. */
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const orgs = await sql`DELETE FROM "organization" WHERE slug LIKE 'e2e-%' RETURNING slug`;
  const users = await sql`DELETE FROM "user" WHERE email LIKE '%@e2e.test' RETURNING email`;
  console.log(`[e2e] nettoyage : ${orgs.length} association(s), ${users.length} utilisateur(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
