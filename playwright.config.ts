import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
// E2E_DEMO=1 : le serveur de test démarre en mode démo (tests/e2e/demo.spec.ts) ; sinon le mode démo est forcé à off.
const DEMO_ENV: Record<string, string> = process.env.E2E_DEMO === "1" ? { DEMO_MODE: "1", DEMO_SPACES_PER_HOUR: "4", CRON_SECRET: "e2e-cron-secret" } : { DEMO_MODE: "" };

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Les tests enchaînent de nombreuses connexions depuis la même IP : limite anti-force-brute relevée.
    env: { BETTER_AUTH_URL: `http://localhost:${PORT}`, NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`, AUTH_SIGNIN_RATE_LIMIT: "500", ...DEMO_ENV },
  },
});
