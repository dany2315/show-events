import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * La CLI Prisma (migrations) doit utiliser une connexion DIRECTE à Postgres :
 * derrière le pooler Neon (PgBouncer), le verrou consultatif de `migrate deploy`
 * peut rester accroché à une connexion partagée et bloquer les déploiements suivants.
 * L'application, elle, continue d'utiliser DATABASE_URL (pooler).
 */
function migrationUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const url = process.env.DATABASE_URL;
  // Neon : l'hôte direct est l'hôte du pooler sans le suffixe « -pooler ».
  return url ? url.replace("-pooler.", ".") : env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl(),
  },
});
