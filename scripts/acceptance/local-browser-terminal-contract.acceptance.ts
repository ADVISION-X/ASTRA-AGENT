import assert from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BrowserCommandActor } from "../../src/lib/browser/exact-target/browser-command-actor.js";
import { browserExecutionFailure } from "../../src/lib/browser/browser-failure.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { canonicalizeBrowserAuthorityValue } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { serializeTerminalFailure } from "../../src/lib/typed-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";

const hash = `sha256:${"a".repeat(64)}` as const;
const negativeHash = `sha256:${"b".repeat(64)}` as const;
const exactHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const valueHash = (value: unknown): `sha256:${string}` => exactHash(JSON.stringify(value));
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

const permitAuthority = (commandId: string) => ({
  permitRef: `permit:${commandId}`,
  authorityRef: "authority-1",
  authorityEpoch: 1,
  certificateHash: hash,
  channelSessionHash: hash,
  executionBindingHash: hash,
  writerFenceHash: hash,
  candidateHash: hash,
  contractManifestHash: hash,
});

const permitExecution = (commandId: string) => ({
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
  replayPolicy: "target-local-per-generation" as const,
  actionOrdinal: 1,
  capabilityId: "browser.dom.click.v1" as const,
  commandId,
  sequence: 1,
  mutationClass: "mutation" as const,
  workspaceRef: "workspace-1",
  commandTtlMs: 5_000,
  replyChannelToken: `reply:${commandId}`,
  commandFrameMac: hash,
});

const permit = (commandId: string): BrowserCommandPermit => ({
  ...permitAuthority(commandId),
  ...permitExecution(commandId),
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

  const observationPermit: BrowserCommandPermit = {
    ...permit("actor-observation"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  const observationCommand = { kind: "dom-intent" as const, intent: { kind: "observe" as const,
    queries: [{ queryId: "model", selector: "button", maxMatches: 1, fields: ["visible" as const] }] } };
  const observedAt = "2026-09-02T12:34:56.789Z";
  const observationQueries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1,
    rawCount: 1, eligibleCount: 1, matches: [{ visible: true }], nativeCauseCode: null,
    nativeCauseCount: 0, nativeStage: "runtime-call-function-on" }];
  const targetRefHash = exactHash(observationPermit.targetRef);
  const documentRefHash = exactHash(observationPermit.documentRef);
  const observationRevisionHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash, documentRefHash, observedAt, queries: observationQueries,
  }));
  const observationResult = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence, result: { schemaVersion: "grasseye.browser.dom-observation.v1",
      targetRefHash, documentRefHash, observationRevisionHash, observedAt, queries: observationQueries },
  })).execute(observationPermit, observationCommand) as Readonly<Record<string, unknown>>;
  assert.equal(observationResult.exactCallIdentityHash, valueHash([
    observationPermit.jobId, observationPermit.attemptId, observationPermit.ownerPluginId,
    observationPermit.pluginVersion, observationPermit.productStepId, observationPermit.callId,
    observationPermit.childCapabilityId, observationPermit.inputHash,
  ]));
  assert.equal(actorStore.readState(observationPermit.commandId), null);

  const rejectedPermit = permit("actor-rejected");
  const rejectedActor = actorFor(async (candidate, _command, onDispatched) => {
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
  });
  await assert.rejects(
    rejectedActor.execute(rejectedPermit, clickCommand),
    /BROWSER_POSTCONDITION_FAILED/u,
  );
  assert.equal(actorStore.readState(rejectedPermit.commandId), "REJECTED");
  assert.equal(rejectedActor.mutationOutcome(rejectedPermit.commandId), "confirmed");
  assert.equal(rejectedActor.browserOutcome(rejectedPermit.commandId), "REJECTED");
  assert.deepEqual(
    serializeTerminalFailure(browserExecutionFailure(
      new Error("BROWSER_POSTCONDITION_FAILED"),
      rejectedActor.mutationOutcome(rejectedPermit.commandId),
      {
        effectScope: rejectedPermit.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
        childCapabilityId: rejectedPermit.childCapabilityId,
        browserOutcome: rejectedActor.browserOutcome(rejectedPermit.commandId)!,
      },
    )),
    {
      code: "BROWSER_POSTCONDITION_FAILED",
      mutation_outcome: "confirmed",
      effect_scope: "target_local",
      child_capability_id: "open_gpt_model_selector_v2",
      browser_outcome: "REJECTED",
      evidence_ref: null,
      evidence_hash: null,
      cause: { name: "Error", code: null },
    },
    "Browser terminal facts must survive typed-failure serialization without promoting REJECTED to CONFIRMED",
  );

  let dispatchCount = 0;
  const receiptMissingPermit = permit("actor-receipt-missing");
  const nativeSocketFailure = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
  const receiptMissingActor = actorFor(async (_candidate, _command, onDispatched) => {
    onDispatched?.();
    dispatchCount += 1;
    throw new Error("SOCKET_CLOSED_AFTER_SEND", { cause: nativeSocketFailure });
  });
  let wrappedBrowserFailure: unknown = null;
  try { await receiptMissingActor.execute(receiptMissingPermit, clickCommand); }
  catch (error) { wrappedBrowserFailure = error; }
  assert.match(String(wrappedBrowserFailure), /BROWSER_COMMAND_RECEIPT_MISSING/u);
  assert.equal(serializeTerminalFailure(wrappedBrowserFailure).cause?.code, "ECONNRESET",
    "the real Browser command wrapper must preserve the innermost native cause");
  assert.equal(dispatchCount, 1);
  assert.equal(actorStore.readState(receiptMissingPermit.commandId), "DISPATCHED");
  assert.equal(receiptMissingActor.hasDispatchedMutation(receiptMissingPermit.commandId), true);
  assert.equal(receiptMissingActor.mutationOutcome(receiptMissingPermit.commandId), "dispatched");
  assert.equal(receiptMissingActor.browserOutcome(receiptMissingPermit.commandId), "DISPATCHED");
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
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V16",
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
