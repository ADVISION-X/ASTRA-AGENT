import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const identity = (
  commandId: string,
  jobId = "job-1",
  ownerPluginId = "fixture-product-plugin",
) => ({
  commandId,
  ownerPluginId,
  jobId,
  attemptId: "attempt-1",
  leaseVersion: 1,
  executionFenceHash: hash,
  targetRef: "target-1",
  documentRef: "document-1",
  actionId: "browser.dom.click.v1",
  requestHash: hash,
  payloadHash: hash,
});

const root = await mkdtemp(join(tmpdir(), "browser-mutation-state-"));
try {
  const first = new BrowserMutationStore(root);
  first.prepare(identity("sent-command"));
  first.markSent("sent-command");
  first.prepare(identity("prepared-command"));
  first.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(
    restarted
      .reconciliationStates()
      .map((entry) => [entry.mutation.commandId, entry.current]),
    [
      ["prepared-command", "FAILED"],
      ["sent-command", "UNKNOWN"],
    ],
  );
  assert.deepEqual(
    restarted.unknownForBinding({
      jobId: "job-1",
      attemptId: "attempt-1",
      leaseVersion: 1,
      executionFenceHash: hash,
    }),
    ["sent-command"],
  );
  assert.equal(
    restarted.reconciliationScope({
      jobId: "job-2",
      ownerPluginId: "fixture-product-plugin",
    }),
    null,
    "UNKNOWN reconciliation must be scoped to the owning job",
  );
  assert.deepEqual(
    restarted.reconciliationScope({
      jobId: "job-1",
      ownerPluginId: "fixture-product-plugin",
    }),
    {
      commandId: "sent-command",
      ownerPluginId: "fixture-product-plugin",
      jobId: "job-1",
      targetRef: "target-1",
      documentRef: "document-1",
      payloadHash: hash,
    },
  );
  restarted.prepare(identity("second-sent-command"));
  restarted.markSent("second-sent-command");
  restarted.markUnknown("second-sent-command", "BROWSER_OUTCOME_UNKNOWN");
  assert.throws(
    () =>
      restarted.reconciliationScope({
        jobId: "job-1",
        ownerPluginId: "fixture-product-plugin",
      }),
    /BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS/u,
    "multiple UNKNOWN mutations in one job must fail closed without affecting other jobs",
  );
  restarted.resolve({
    commandId: "second-sent-command",
    ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1",
    state: "FAILED",
    proofHash: hash,
  });
  assert.equal(restarted.readUnknown("prepared-command"), null);
  restarted.resolve({
    commandId: "sent-command",
    ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1",
    state: "CONFIRMED",
    proofHash: hash,
  });
  assert.deepEqual(
    restarted.unknownForBinding({
      jobId: "job-1",
      attemptId: "attempt-1",
      leaseVersion: 1,
      executionFenceHash: hash,
    }),
    [],
  );
  restarted.close();

  const terminalRestart = new BrowserMutationStore(root);
  assert.deepEqual(
    terminalRestart
      .reconciliationStates()
      .map((entry) => [entry.mutation.commandId, entry.current]),
    [
      ["prepared-command", "FAILED"],
      ["second-sent-command", "FAILED"],
      ["sent-command", "CONFIRMED"],
    ],
  );
  terminalRestart.close();

  const supervisor = readFileSync(
    "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
    "utf8",
  );
  const actor = readFileSync(
    "src/lib/browser/exact-target/browser-command-actor.ts",
    "utf8",
  );
  assert.match(
    supervisor,
    /new BrowserMutationStore\(this\.options\.dataDir\)/u,
  );
  assert.match(actor, /markSent[\s\S]*markUnknown/u);
  assert.doesNotMatch(
    `${supervisor}\n${actor}`,
    /BrowserProofJournal|proof-events\.ndjson/u,
  );
  await verifyBrowserArtifactAndLockContracts();
  process.stdout.write("LOCAL_BROWSER_TERMINAL_CONTRACT_PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}

emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V9",
  evidenceMode: "exam.golden",
  clauses: [
    "forbidden:0",
    "forbidden:1",
    "forbidden:10",
    "forbidden:11",
    "forbidden:3",
    "forbidden:9",
    "summary",
  ],
  locator: "acceptance:local-browser-terminal:mutation-golden",
  observedValue:
    "restart recovery preserves SENT as UNKNOWN without replay, rejects mismatched resolution identity, retains one compact SQLite mutation store, and excludes the retired lifecycle journal",
});
