import assert from "node:assert/strict";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";
import {
  appShellProofPaths,
  currentAppShellProofContractHash,
  hashFile,
} from "./app-shell-real-chrome-proof-support.js";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  const candidateHash = buildStartupSourceFingerprint(appShellProofPaths.root);
  const healthResponse = await page.request.get("http://127.0.0.1:4173/api/health");
  assert.equal(healthResponse.ok(), true);
  const health = await healthResponse.json() as { status?: unknown; sourceFingerprint?: unknown };
  assert.equal(health.status, "healthy");
  assert.equal(health.sourceFingerprint, candidateHash, "Workbench is not running the current source candidate");
  const capturedAt = new Date().toISOString();
  const checks = {
    shell_root_count: await page.locator("[data-app-shell]").count(),
    left_sidebar_count: await page.locator("[data-app-shell-sidebar]").count(),
    main_workspace_count: await page.locator("main[data-app-shell-workspace]").count(),
    right_inspector_count: await page.locator("[data-app-shell-inspector]").count(),
    runtime_console_count: await page.locator("[data-runtime-console]").count(),
    legacy_data_surface_count: await page.locator("[data-user-demand-startup], [data-legacy-app]").count(),
    legacy_title_count: await page.getByText("用户需求启动", { exact: true }).count(),
  };
  assert.deepEqual(checks, {
    shell_root_count: 1,
    left_sidebar_count: 1,
    main_workspace_count: 1,
    right_inspector_count: 1,
    runtime_console_count: 1,
    legacy_data_surface_count: 0,
    legacy_title_count: 0,
  });
  const observation = {
    schema_version: "grasseye-app-shell-browser-observation.v1",
    captured_at: capturedAt,
    url: page.url(),
    title: await page.title(),
    health_source_fingerprint: candidateHash,
    checks,
  };
  await mkdir(path.dirname(appShellProofPaths.observation), { recursive: true });
  const observationTemp = `${appShellProofPaths.observation}.tmp`;
  const screenshotTemp = `${appShellProofPaths.screenshot}.tmp`;
  await writeFile(observationTemp, `${JSON.stringify(observation, null, 2)}\n`, { mode: 0o600 });
  await page.screenshot({ path: screenshotTemp, fullPage: true, type: "png" });
  await rename(observationTemp, appShellProofPaths.observation);
  await rename(screenshotTemp, appShellProofPaths.screenshot);
  const proof = {
    schema_version: "grasseye-app-shell-real-chrome-proof.v1",
    candidate_hash: candidateHash,
    proof_contract_hash: currentAppShellProofContractHash(),
    captured_at: capturedAt,
    expires_at: new Date(Date.parse(capturedAt) + 30 * 60 * 1_000).toISOString(),
    browser_name: "chromium",
    browser_version: browser.version(),
    observation_ref: appShellProofPaths.observation,
    observation_hash: hashFile(appShellProofPaths.observation),
    screenshot_ref: appShellProofPaths.screenshot,
    screenshot_hash: hashFile(appShellProofPaths.screenshot),
  };
  await writeFile(appShellProofPaths.proof, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: "CHROME_CAPTURED", ...proof })}\n`);
} finally {
  await browser.close();
}
