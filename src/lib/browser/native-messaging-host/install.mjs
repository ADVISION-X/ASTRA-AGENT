#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sourceDir, "../../../..");
const platformArch = `${process.platform}-${process.arch}`;
const configured = process.env.GRASSEYE_BROWSERCTL_BINARY?.trim();
const browserctl = configured
  ? path.resolve(configured)
  : path.join(repoRoot, "artifacts", "browser-runtime", platformArch, "bin", "grasseye-browserctl");

if (!existsSync(browserctl)) {
  throw new Error(
    `BROWSERCTL_PREBUILT_BINARY_REQUIRED:${browserctl}. Production browser infrastructure is build-once; installation must never compile or transpile the Native Host on the target machine.`,
  );
}

const forwarded = process.argv.slice(2);
const result = spawnSync(browserctl, forwarded, {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`BROWSERCTL_FAILED:${result.status ?? "signal"}`);
}
