import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const AppShellObservationSchema = z.object({
  schema_version: z.literal("grasseye-app-shell-browser-observation.v1"),
  captured_at: z.string().datetime(),
  url: z.literal("http://127.0.0.1:4173/"),
  title: z.literal("GrassEye AGENT Workbench"),
  health_source_fingerprint: HashSchema,
  checks: z.object({
    shell_root_count: z.literal(1),
    left_sidebar_count: z.literal(1),
    main_workspace_count: z.literal(1),
    right_inspector_count: z.literal(1),
    runtime_console_count: z.literal(1),
    legacy_data_surface_count: z.literal(0),
    legacy_title_count: z.literal(0),
  }).strict(),
}).strict();
const AppShellProofSchema = z.object({
  schema_version: z.literal("grasseye-app-shell-real-chrome-proof.v1"),
  candidate_hash: HashSchema,
  proof_contract_hash: HashSchema,
  captured_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  browser_name: z.literal("chromium"),
  browser_version: z.string().trim().min(1),
  observation_ref: z.string().trim().min(1),
  observation_hash: HashSchema,
  screenshot_ref: z.string().trim().min(1),
  screenshot_hash: HashSchema,
}).strict();

export const appShellProofPaths = Object.freeze({
  root,
  proof: path.join(root, ".grasseye-local", "dynamic-proof", "app-shell-ui-physical-cleanup.v1.json"),
  observation: path.join(root, ".grasseye-local", "dynamic-proof", "artifacts", "app-shell-ui-observation.v1.json"),
  screenshot: path.join(root, ".grasseye-local", "dynamic-proof", "artifacts", "app-shell-ui-screenshot.v1.png"),
});

const contractFiles = [
  "scripts/acceptance/app-shell-real-chrome-proof-support.ts",
  "scripts/acceptance/capture-app-shell-ui.real-chrome.ts",
  "scripts/acceptance/app-shell-ui.real-chrome.ts",
] as const;

export const hashFile = (filePath: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;

export const currentAppShellProofContractHash = (): `sha256:${string}` => {
  const hash = createHash("sha256");
  for (const relativePath of contractFiles) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(path.join(root, relativePath)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
};

type AppShellProofValidationAuthority = Readonly<{
  candidateHash: `sha256:${string}`;
  contractHash: `sha256:${string}`;
  observationPath: string;
  screenshotPath: string;
}>;

export const validateAppShellRealChromeProofAt = (
  raw: unknown,
  authority: AppShellProofValidationAuthority,
  nowMs = Date.now(),
): Readonly<{
  candidateHash: string;
  browserVersion: string;
}> => {
  const proof = AppShellProofSchema.parse(raw);
  assert.equal(proof.candidate_hash, authority.candidateHash);
  assert.equal(proof.proof_contract_hash, authority.contractHash);
  assert.equal(path.resolve(proof.observation_ref), path.resolve(authority.observationPath));
  assert.equal(path.resolve(proof.screenshot_ref), path.resolve(authority.screenshotPath));
  assert.equal(hashFile(proof.observation_ref), proof.observation_hash);
  assert.equal(hashFile(proof.screenshot_ref), proof.screenshot_hash);
  const observation = AppShellObservationSchema.parse(JSON.parse(
    readFileSync(proof.observation_ref, "utf8"),
  ));
  assert.equal(observation.captured_at, proof.captured_at);
  assert.equal(observation.health_source_fingerprint, proof.candidate_hash);
  const capturedAt = Date.parse(proof.captured_at);
  const expiresAt = Date.parse(proof.expires_at);
  assert.ok(nowMs >= capturedAt && nowMs <= expiresAt, "App Shell real Chrome proof is stale");
  assert.ok(expiresAt - capturedAt > 0 && expiresAt - capturedAt <= 30 * 60 * 1_000);
  return Object.freeze({
    candidateHash: proof.candidate_hash,
    browserVersion: proof.browser_version,
  });
};

export const validateAppShellRealChromeProof = (raw: unknown, nowMs = Date.now()): Readonly<{
  candidateHash: string;
  browserVersion: string;
}> => validateAppShellRealChromeProofAt(raw, {
  candidateHash: buildStartupSourceFingerprint(root),
  contractHash: currentAppShellProofContractHash(),
  observationPath: appShellProofPaths.observation,
  screenshotPath: appShellProofPaths.screenshot,
}, nowMs);
