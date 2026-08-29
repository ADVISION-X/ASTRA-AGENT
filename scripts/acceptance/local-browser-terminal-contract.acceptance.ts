import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const negativeHash = `sha256:${"b".repeat(64)}` as const;
const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const identity = (
  commandId: string,
  jobId = "job-1",
  ownerPluginId = "fixture-product-plugin",
) => ({
  commandId,
  exactCallIdentityHash: exactHash(commandId),
  ownerPluginId,
  pluginVersion: 1,
  jobId,
  attemptId: "attempt-1",
  leaseVersion: 1,
  executionFenceHash: hash,
  productStepId: "report_translation:candidate_a",
  childCapabilityId: "open_gpt_model_selector_v2",
  callId: "gpt-turn-flow.v3",
  effectScope: "target_local" as const,
  actionOrdinal: 1,
  targetRef: "target-1",
  documentRef: "document-1",
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash,
  negativePostconditionHash: negativeHash,
  requestHash: hash,
  payloadHash: hash,
});

const permit = (commandId: string): BrowserCommandPermit => ({
  permitRef: `permit:${commandId}`,
  authorityRef: "authority-1",
  authorityEpoch: 1,
  certificateHash: hash,
  channelSessionHash: hash,
  executionBindingHash: hash,
  writerFenceHash: hash,
  candidateHash: hash,
  contractManifestHash: hash,
  ownerPluginId: "fixture-product-plugin",
  pluginVersion: 1,
  jobId: `job:${commandId}`,
  attemptId: "attempt-actor",
  deviceId: "device-1",
  leaseVersion: 1,
  localOrderId: `order:${commandId}`,
  targetLeaseRef: "lease-1",
  targetRef: "target-1",
  documentRef: "document-1",
  productStepId: "report_translation:candidate_a",
  childCapabilityId: "open_gpt_model_selector_v2",
  callId: "gpt-turn-flow.v3",
  inputHash: hash,
  replayPolicy: "target-local-per-generation",
  actionOrdinal: 1,
  capabilityId: "browser.dom.click.v1",
  commandId,
  sequence: 1,
  mutationClass: "mutation",
  workspaceRef: "workspace-1",
  commandTtlMs: 5_000,
  replyChannelToken: `reply:${commandId}`,
  commandFrameMac: hash,
});

const clickCommand = {
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const,
    selector: "button[aria-label='Model selector']",
    expectedMatches: 1,
    postClickAttribute: { name: "aria-expanded" as const, equals: "true" as const, timeoutMs: 1_000 },
  },
};

const root = await mkdtemp(join(tmpdir(), "browser-mutation-state-"));
try {
  const first = new BrowserMutationStore(root);
  first.prepare(identity("dispatched-command"));
  first.markDispatched("dispatched-command");
  first.markReceiptMissing("dispatched-command");
  first.prepare(identity("prepared-command"));
  first.close();

  const restarted = new BrowserMutationStore(root);
  assert.deepEqual(
    restarted
      .reconciliationStates()
      .map((entry) => [entry.mutation.commandId, entry.current])
      .sort((left, right) => left[0]!.localeCompare(right[0]!)),
    [
      ["dispatched-command", "DISPATCHED"],
      ["prepared-command", "FAILED"],
    ],
  );
  assert.deepEqual(
    restarted.dispatchedForBinding({
      jobId: "job-1",
      attemptId: "attempt-1",
      leaseVersion: 1,
      executionFenceHash: hash,
    }),
    ["dispatched-command"],
  );
  assert.equal(
    restarted.reconciliationScope({
      jobId: "job-2",
      ownerPluginId: "fixture-product-plugin",
    }),
    null,
    "DISPATCHED reconciliation must be scoped to the owning job",
  );
  assert.deepEqual(
    restarted.reconciliationScope({
      jobId: "job-1",
      ownerPluginId: "fixture-product-plugin",
    }),
    {
      commandId: "dispatched-command",
      ownerPluginId: "fixture-product-plugin",
      jobId: "job-1",
      targetRef: "target-1",
      documentRef: "document-1",
      payloadHash: hash,
    },
  );
  restarted.prepare(identity("second-dispatched-command"));
  restarted.markDispatched("second-dispatched-command");
  restarted.markReceiptMissing("second-dispatched-command");
  assert.throws(
    () =>
      restarted.reconciliationScope({
        jobId: "job-1",
        ownerPluginId: "fixture-product-plugin",
      }),
    /BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS/u,
    "multiple DISPATCHED mutations in one job must fail closed without affecting other jobs",
  );
  restarted.resolve({
    commandId: "second-dispatched-command",
    ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1",
    state: "REJECTED",
    proofHash: hash,
  });
  assert.equal(restarted.readDispatched("prepared-command"), null);
  restarted.resolve({
    commandId: "dispatched-command",
    ownerPluginId: "fixture-product-plugin",
    targetRef: "target-1",
    state: "CONFIRMED",
    proofHash: hash,
  });
  assert.deepEqual(
    restarted.dispatchedForBinding({
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
      .map((entry) => [entry.mutation.commandId, entry.current])
      .sort((left, right) => left[0]!.localeCompare(right[0]!)),
    [
      ["dispatched-command", "CONFIRMED"],
      ["prepared-command", "FAILED"],
      ["second-dispatched-command", "REJECTED"],
    ],
  );
  terminalRestart.close();

  const actorRoot = join(root, "actor");
  const actorStore = new BrowserMutationStore(actorRoot);
  const actorLogger = createRuntimeLogger({
    producer: "browser-actor-acceptance",
    producerRunId: "browser-actor-acceptance-run",
    owner: "browser-session",
    component: "browser-command",
    terminalEnabled: false,
    fileSink: { directoryPath: join(root, "actor-logs"), maxTotalBytes: 1_048_576 },
  });
  const actorFor = (send: ConstructorParameters<typeof BrowserCommandActor>[1]["send"]) =>
    new BrowserCommandActor(
      new BrowserCommandAdmissionBudget(),
      { send },
      actorStore,
      { assertCurrentAuthority: () => {} },
      actorLogger,
    );

  const confirmedPermit = permit("actor-confirmed");
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return {
      replyChannelToken: candidate.replyChannelToken,
      transportSequence: 1,
      permitSequence: candidate.sequence,
      result: { candidateCount: 1, identityRevalidated: true, mutationCount: 1, postconditionVerified: true },
    };
  }).execute(confirmedPermit, clickCommand);
  assert.equal(actorStore.readState(confirmedPermit.commandId), "CONFIRMED");

  const rejectedPermit = permit("actor-rejected");
  await assert.rejects(
    actorFor(async (candidate, _command, onDispatched) => {
      onDispatched?.();
      return {
        replyChannelToken: candidate.replyChannelToken,
        transportSequence: 2,
        permitSequence: candidate.sequence,
        result: {
          candidateCount: 1,
          identityRevalidated: true,
          mutationCount: 1,
          postconditionVerified: false,
          failureCode: "BROWSER_POSTCONDITION_FAILED",
        },
      };
    }).execute(rejectedPermit, clickCommand),
    /BROWSER_POSTCONDITION_FAILED/u,
  );
  assert.equal(actorStore.readState(rejectedPermit.commandId), "REJECTED");

  let dispatchCount = 0;
  const receiptMissingPermit = permit("actor-receipt-missing");
  const receiptMissingActor = actorFor(async (_candidate, _command, onDispatched) => {
    onDispatched?.();
    dispatchCount += 1;
    throw new Error("SOCKET_CLOSED_AFTER_SEND");
  });
  await assert.rejects(
    receiptMissingActor.execute(receiptMissingPermit, clickCommand),
    /BROWSER_COMMAND_RECEIPT_MISSING/u,
  );
  assert.equal(dispatchCount, 1);
  assert.equal(actorStore.readState(receiptMissingPermit.commandId), "DISPATCHED");
  assert.equal(receiptMissingActor.hasDispatchedMutation(receiptMissingPermit.commandId), true);
  assert.equal(receiptMissingActor.mutationOutcome(receiptMissingPermit.commandId), "dispatched");
  actorStore.close();

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
  assert.match(actor, /markDispatched/u);
  assert.match(actor, /markConfirmed/u);
  assert.match(actor, /markRejected/u);
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
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V13",
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
    "restart recovery preserves DISPATCHED without replay, binds exact plugin step child and action ordinal, rejects mismatched resolution identity, and terminalizes direct postconditions as CONFIRMED or REJECTED",
});
