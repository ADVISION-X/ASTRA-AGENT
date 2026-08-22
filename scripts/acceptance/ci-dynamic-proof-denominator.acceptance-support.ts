import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrowserProofJournal,
  readBrowserProofJournal,
} from "../../src/lib/browser/exact-target/browser-proof-journal.js";
import { acceptanceLawBindings } from "../audit/ci-acceptance-law-bindings.js";
import { buildAcceptancePackageSkeletons } from "../audit/ci-acceptance-leaf-plan.js";
import {
  hashFile,
  validateAppShellRealChromeProofAt,
} from "./app-shell-real-chrome-proof-support.js";
import { validateDomAtomicMutationRealChromeJournal } from "./dom-real-chrome-proof-support.js";

const dynamicLeaves = [
  "scripts/acceptance/app-shell-ui.real-chrome.ts",
  "scripts/acceptance/dom-automation-exact-target.real-chrome.ts",
  "scripts/acceptance/dom-automation.real-chrome.ts",
  "scripts/acceptance/local-browser.real-chrome.ts",
  "scripts/acceptance/xuanxue-ai-production.real-chrome.ts",
  "scripts/acceptance/xuanxue-ai-production.real-provider.ts",
] as const;
const digest = (character: string): `sha256:${string}` =>
  `sha256:${character.repeat(64)}` as `sha256:${string}`;

const packageScripts = (): Record<string, string> => ({
  ...(JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  }).scripts,
});

const scriptForLeaf = (scripts: Readonly<Record<string, string>>, leaf: string): string => {
  const match = Object.entries(scripts).find(([, command]) => command === `node --import tsx ${leaf}`);
  assert.ok(match, `package script for ${leaf} is missing`);
  return match[0];
};

const assertDynamicDenominatorCannotShrink = (): void => {
  for (const leaf of dynamicLeaves) {
    const scripts = packageScripts();
    delete scripts[scriptForLeaf(scripts, leaf)];
    const bindings = new Map(acceptanceLawBindings);
    bindings.delete(leaf);
    assert.throws(
      () => buildAcceptancePackageSkeletons(scripts, bindings),
      /Deferred dynamic proof denominator mismatch/u,
      `deleting ${leaf} and its binding must not shrink the active-law denominator`,
    );
  }
};

const assertDynamicRouteCannotBecomeFixture = (): void => {
  const leaf = "scripts/acceptance/dom-automation-exact-target.real-chrome.ts";
  const fixtureLeaf = "scripts/acceptance/dom-automation-exact-target.acceptance.ts";
  const scripts = packageScripts();
  scripts[scriptForLeaf(scripts, leaf)] = `node --import tsx ${fixtureLeaf}`;
  const bindings = new Map(acceptanceLawBindings);
  const binding = bindings.get(leaf)!;
  bindings.delete(leaf);
  bindings.set(fixtureLeaf, { ...binding, producerFilePath: fixtureLeaf });
  assert.throws(
    () => buildAcceptancePackageSkeletons(scripts, bindings),
    /Deferred dynamic verifier|no independent repository producer/u,
  );
};

const assertBrowserJournalBytesAreAuthoritative = (directory: string): void => {
  const journalPath = path.join(directory, "proof-events.ndjson");
  const journal = new BrowserProofJournal(journalPath, {
    candidateHash: digest("a"),
    extensionId: "proof-extension",
    releaseBuildId: "proof-release",
  });
  journal.recordLifecycle({
    eventType: "LIFECYCLE",
    phase: "AUTHENTICATED",
    authorityRefHash: digest("b"),
  });
  assert.equal(readBrowserProofJournal(journalPath).length, 1);
  writeFileSync(journalPath, readFileSync(journalPath, "utf8").replace("AUTHENTICATED", "AUTHORITY_REVOKED"));
  assert.throws(() => readBrowserProofJournal(journalPath), /BROWSER_PROOF_JOURNAL_INTEGRITY_INVALID/u);
};

const recordMutationChain = (
  journal: BrowserProofJournal,
  candidateHash: `sha256:${string}`,
  commandId: string,
  domIntentKind: "click" | "fill",
  retainedValueVerified: boolean,
): void => {
  const base = {
    eventType: "COMMAND" as const,
    commandId,
    actionId: `browser.dom.${domIntentKind}.v1`,
    commandKind: "dom-intent",
    domIntentKind,
    workspaceRef: "workspace",
    authorityRef: "authority",
    authorityCertificateHash: digest("1"),
    executionBindingHash: digest("2"),
    executionFenceHash: digest("3"),
    candidateHash,
    contractManifestHash: digest("4"),
    ownerPluginId: "xuanxue-ai-production",
    jobId: "job",
    attemptId: "attempt",
    deviceId: "device",
    leaseVersion: 1,
    localOrderId: "order",
    targetRef: "target",
    documentRef: "document",
    commandTtlMs: 30_000,
    commandClass: "mutation" as const,
    payloadHash: digest(domIntentKind === "click" ? "5" : "6"),
  };
  for (const phase of ["PREPARED", "SEND", "UNKNOWN", "CONFIRMED"] as const) {
    journal.recordCommand({
      ...base,
      phase,
      recordedAt: "2026-08-22T12:00:00.000Z",
      artifactRefs: phase === "CONFIRMED" ? ["positive", "negative"] : [],
      ...(phase === "UNKNOWN" ? {
        resultHash: digest("7"),
        transportSequence: 1,
        permitSequence: 1,
        resultSummary: {
          candidateCount: 1,
          identityRevalidated: true,
          mutationCount: 1,
          ...(domIntentKind === "fill" ? { retainedValueVerified } : {}),
        },
      } : {}),
      ...(phase === "CONFIRMED" ? {
        reason: "owning-plugin:xuanxue-ai-production",
        resultHash: digest("8"),
      } : {}),
    });
  }
};

const assertDomSummaryMutantFails = (directory: string): void => {
  const journalPath = path.join(directory, "dom-mutant.ndjson");
  const candidateHash = digest("9");
  const journal = new BrowserProofJournal(journalPath, {
    candidateHash,
    extensionId: "proof-extension",
    releaseBuildId: "proof-release",
  });
  recordMutationChain(journal, candidateHash, "click", "click", true);
  recordMutationChain(journal, candidateHash, "fill", "fill", false);
  assert.throws(() => validateDomAtomicMutationRealChromeJournal({
    envelopes: readBrowserProofJournal(journalPath),
    candidateHash,
    nowMs: Date.parse("2026-08-22T12:01:00.000Z"),
  }), /BROWSER_REAL_CHROME_FILL_PROOF_MISSING/u);
};

const assertAppProofReadsArtifactBytes = (directory: string): void => {
  const observationPath = path.join(directory, "observation.json");
  const screenshotPath = path.join(directory, "screenshot.png");
  const capturedAt = "2026-08-22T12:00:00.000Z";
  writeFileSync(observationPath, `${JSON.stringify({
    schema_version: "grasseye-app-shell-browser-observation.v1",
    captured_at: capturedAt,
    url: "http://127.0.0.1:4173/",
    title: "GrassEye AGENT Workbench",
    health_source_fingerprint: digest("c"),
    checks: {
      shell_root_count: 1,
      left_sidebar_count: 1,
      main_workspace_count: 1,
      right_inspector_count: 1,
      runtime_console_count: 1,
      legacy_data_surface_count: 0,
      legacy_title_count: 0,
    },
  })}\n`);
  writeFileSync(screenshotPath, "real-browser-png-bytes");
  const authority = {
    candidateHash: digest("c"),
    contractHash: digest("d"),
    observationPath,
    screenshotPath,
  } as const;
  const proof = {
    schema_version: "grasseye-app-shell-real-chrome-proof.v1",
    candidate_hash: authority.candidateHash,
    proof_contract_hash: authority.contractHash,
    captured_at: capturedAt,
    expires_at: "2026-08-22T12:30:00.000Z",
    browser_name: "chromium",
    browser_version: "test-version",
    observation_ref: observationPath,
    observation_hash: hashFile(observationPath),
    screenshot_ref: screenshotPath,
    screenshot_hash: hashFile(screenshotPath),
  };
  assert.doesNotThrow(() => validateAppShellRealChromeProofAt(
    proof,
    authority,
    Date.parse("2026-08-22T12:01:00.000Z"),
  ));
  writeFileSync(screenshotPath, "tampered-browser-bytes");
  assert.throws(() => validateAppShellRealChromeProofAt(
    proof,
    authority,
    Date.parse("2026-08-22T12:01:00.000Z"),
  ));
};

export const runDynamicProofDenominatorAttacks = (): void => {
  assertDynamicDenominatorCannotShrink();
  assertDynamicRouteCannotBecomeFixture();
  const directory = mkdtempSync(path.join(tmpdir(), "grasseye-dynamic-proof-attacks-"));
  try {
    assertBrowserJournalBytesAreAuthoritative(directory);
    assertDomSummaryMutantFails(directory);
    assertAppProofReadsArtifactBytes(directory);
  } finally {
    rmSync(directory, { recursive: true });
  }
};
