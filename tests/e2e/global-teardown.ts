import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export default function globalTeardown() {
  if (process.env.E2E_KEEP_DATA === "1") return;
  execSync("npx tsx tests/e2e/cleanup-db.ts", { stdio: "inherit" });
  rmSync("tests/e2e/.state.json", { force: true });
}
