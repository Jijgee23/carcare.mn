// Runs the backend unit suite: `npm test` (all files) or
// `npm test -- tests/foo.test.ts` (selected files).
// Node 20's `--test` doesn't expand globs and npm on Windows uses cmd, so the
// file list is built here. `tsconfig.test.json` maps `server-only` to a stub.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const selected = process.argv.slice(2);
const files = selected.length
  ? selected
  : readdirSync("tests")
      .filter((name) => name.endsWith(".test.ts"))
      .sort()
      .map((name) => `tests/${name}`);

const result = spawnSync(
  "npx",
  ["tsx", "--tsconfig", "tsconfig.test.json", "--import", "./tests/setup.ts", "--test", ...files],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
