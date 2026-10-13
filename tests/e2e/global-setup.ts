import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("npx tsx tests/e2e/cleanup-db.ts", { stdio: "inherit" });
  execSync("npx tsx tests/e2e/setup-db.ts", { stdio: "inherit" });
}
