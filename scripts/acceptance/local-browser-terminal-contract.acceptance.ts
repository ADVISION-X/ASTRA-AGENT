import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
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
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { verifyBrowserArtifactAndLockContracts } from "./local-browser-artifact-and-lock.acceptance-support.js";
import { exerciseStrictMutationReceipts } from "./local-browser-mutation-receipt-support.js";
import { exerciseBrowserDiagnosticContract } from "./local-browser-diagnostic-contract-support.js";
import { exactHash, exerciseBrowserMutationStore, hash, valueHash } from
  "./local-browser-mutation-store-support.js";
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
const matchClickCommand = {
  kind: "dom-intent" as const,
  intent: {
    kind: "click" as const,
    selector: "button[aria-label='Model selector']",
    expectedMatches: 1,
    postClickMatch: { selector: "[aria-hidden='true']", expectedMatches: 1 },
  },
};
const root = await mkdtemp(join(tmpdir(), "browser-mutation-state-"));
try {
  exerciseBrowserMutationStore(root);
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
      result: { clicked: true, candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, postconditionVerified: true },
    };
  }).execute(confirmedPermit, clickCommand);
  assert.equal(actorStore.readState(confirmedPermit.commandId), "CONFIRMED");
  assert.equal(actorStore.readMutationOutcome(confirmedPermit.commandId), "confirmed");
  const zeroActionPermit = permit("actor-zero-action");
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true } };
  }).execute(zeroActionPermit, clickCommand);
  assert.equal(actorStore.readState(zeroActionPermit.commandId), "CONFIRMED");
  assert.equal(actorStore.readMutationOutcome(zeroActionPermit.commandId), "no");
  const fillReadbackPermit: BrowserCommandPermit = {
    ...permit("actor-fill-readback-rejected"),
    capabilityId: "browser.dom.fill.v1",
    childCapabilityId: "prepare_clean_gpt_chat",
  };
  const fillCommand = { kind: "dom-intent" as const, intent: {
    kind: "fill" as const, selector: "#prompt-textarea", approvedText: "",
    clearBeforeType: true, expectedMatches: 1,
  } };
  const fillReadbackActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        filled: true, candidateCount: 0, identityRevalidated: false,
        mutationCount: 1, retainedValueVerified: false, postconditionVerified: false,
        failureCode: "BROWSER_POSTCONDITION_FAILED",
        nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
      } };
  });
  let fillReadbackError: unknown = null;
  try { await fillReadbackActor.execute(fillReadbackPermit, fillCommand); }
  catch (error) { fillReadbackError = error; }
  assert.match(String(fillReadbackError), /BROWSER_POSTCONDITION_FAILED/u);
  assert.equal(serializeTerminalFailure(fillReadbackError).cause?.code, "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(actorStore.readState(fillReadbackPermit.commandId), "REJECTED");
  assert.equal(fillReadbackActor.mutationOutcome(fillReadbackPermit.commandId), "confirmed");
  const qualificationPermit = permit("actor-qualification-rejected");
  const qualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "actionability",
        failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
        nativeCauseCode: "BROWSER_DOM_ACTION_HIT_TEST_FAILED" } };
  });
  await assert.rejects(qualificationActor.execute(qualificationPermit, clickCommand),
    /BROWSER_DOM_ACTION_NOT_QUALIFIED/u);
  assert.equal(actorStore.readState(qualificationPermit.commandId), "REJECTED");
  assert.equal(qualificationActor.mutationOutcome(qualificationPermit.commandId), "no");
  const actorDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId), {
    reason: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
    native_cause_code: "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
  }, "the unique mutation WAL must retain the outer failure and exact native qualification cause");
  const storedQualificationIdentity = actorDatabase.prepare(
    "select exact_call_identity_hash from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId) as { exact_call_identity_hash: `sha256:${string}` };
  const qualificationFact = actorStore.readExactCallMutationFact({
    jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    ownerPluginId: qualificationPermit.ownerPluginId, pluginVersion: qualificationPermit.pluginVersion,
    exactCallIdentityHash: storedQualificationIdentity.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal,
  });
  assert.equal(qualificationFact?.failureCode, "BROWSER_DOM_ACTION_NOT_QUALIFIED");
  assert.equal(qualificationFact?.nativeFailureCode, "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  const qualificationRecovery = actorStore.atomicStepRecovery({
    jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    ownerPluginId: qualificationPermit.ownerPluginId, pluginVersion: qualificationPermit.pluginVersion,
    exactCallIdentityHash: storedQualificationIdentity.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal, targetRef: qualificationPermit.targetRef,
    effectScope: "target_local",
  });
  assert.equal(qualificationRecovery?.failureCode, "BROWSER_DOM_ACTION_NOT_QUALIFIED");
  assert.equal(qualificationRecovery?.nativeFailureCode, "BROWSER_DOM_ACTION_HIT_TEST_FAILED");
  actorDatabase.close();

  const observationPermit: BrowserCommandPermit = {
    ...permit("actor-observation"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  const observationCommand = { kind: "dom-intent" as const, intent: { kind: "observe" as const,
    queries: [{ queryId: "model", selector: "button", maxMatches: 1, fields: ["visible" as const] }] } };
  const observedAt = "2026-09-02T12:34:56.789Z";
  const observationIdentityHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: exactHash(observationPermit.targetRef),
    documentRefHash: exactHash(observationPermit.documentRef), observedAt, queryId: "model", candidateIndex: 0,
  }));
  const observationQueries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1,
    rawCount: 1, eligibleCount: 1, matches: [{ candidateIndex: 0, observationIdentityHash, visible: true }], nativeCauseCode: null,
    nativeCauseCount: 0, nativeStage: "runtime-call-function-on", scopeRejections: [], rejections: [] }];
  const targetRefHash = exactHash(observationPermit.targetRef);
  const documentRefHash = exactHash(observationPermit.documentRef);
  const currentUrl = "https://chatgpt.com/";
  const observationRevisionHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash, documentRefHash, currentUrl, observedAt, queries: observationQueries,
  }));
  const observationResult = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence, result: { schemaVersion: "grasseye.browser.dom-observation.v2",
      targetRefHash, documentRefHash, currentUrl, observationRevisionHash, observedAt, queries: observationQueries },
  })).execute(observationPermit, observationCommand) as Readonly<Record<string, unknown>>;
  assert.equal(observationResult.exactCallIdentityHash, valueHash([
    observationPermit.jobId, observationPermit.attemptId, observationPermit.ownerPluginId,
    observationPermit.pluginVersion, observationPermit.productStepId, observationPermit.callId,
    observationPermit.childCapabilityId, observationPermit.inputHash,
  ]));
  assert.equal(actorStore.readState(observationPermit.commandId), null);

  const coherentClickPermit: BrowserCommandPermit = {
    ...permit("actor-coherent-click"), commandTtlMs: 10_000,
  };
  const coherentClickCommand = { kind: "dom-intent" as const, intent: {
    kind: "click" as const, selector: "button[aria-label='Model selector']", expectedMatches: 1,
    postClickObservation: { timeoutMs: 5_000, queries: [{
      queryId: "model", selector: "button", maxMatches: 1, fields: [] as const,
      expectedEligibleCount: 1,
    }] },
  } };
  const coherentTargetRefHash = exactHash(coherentClickPermit.targetRef);
  const coherentDocumentRefHash = exactHash(coherentClickPermit.documentRef);
  const coherentObservationIdentityHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: coherentTargetRefHash, documentRefHash: coherentDocumentRefHash,
    observedAt, queryId: "model", candidateIndex: 0,
  }));
  const coherentObservationQueries = [{ queryId: "model", scopeRawCount: 1, scopeEligibleCount: 1,
    rawCount: 1, eligibleCount: 1,
    matches: [{ candidateIndex: 0, observationIdentityHash: coherentObservationIdentityHash }],
    nativeCauseCode: null, nativeCauseCount: 0, nativeStage: "runtime-call-function-on",
    scopeRejections: [], rejections: [] }];
  const coherentRevisionHash = exactHash(canonicalizeBrowserAuthorityValue({
    targetRefHash: coherentTargetRefHash, documentRefHash: coherentDocumentRefHash,
    currentUrl, observedAt, queries: coherentObservationQueries,
  }));
  const coherentClickResult = await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
        postconditionVerified: true,
        postconditionObservation: {
          schemaVersion: "grasseye.browser.dom-observation.v2", targetRefHash: coherentTargetRefHash,
          documentRefHash: coherentDocumentRefHash, currentUrl, observationRevisionHash: coherentRevisionHash,
          observedAt, queries: coherentObservationQueries,
        },
      } };
  }).execute(coherentClickPermit, coherentClickCommand) as Readonly<Record<string, unknown>>;
  assert.equal((coherentClickResult.postconditionObservation as Readonly<Record<string, unknown>>)
    .exactCallIdentityHash, valueHash([
    coherentClickPermit.jobId, coherentClickPermit.attemptId, coherentClickPermit.ownerPluginId,
    coherentClickPermit.pluginVersion, coherentClickPermit.productStepId, coherentClickPermit.callId,
    coherentClickPermit.childCapabilityId, coherentClickPermit.inputHash,
  ]), "the post-click coherent packet must be exact-call bound before WAL confirmation and GPT consumption");
  assert.equal(actorStore.readState(coherentClickPermit.commandId), "CONFIRMED");

  const coherentQualificationPermit: BrowserCommandPermit = {
    ...permit("actor-coherent-click-qualification-rejected"), commandTtlMs: 10_000,
  };
  const coherentQualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        candidateCount: 0, identityRevalidated: false, mutationCount: 0,
        postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "candidate-set",
        failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: null,
      } };
  });
  await assert.rejects(
    coherentQualificationActor.execute(coherentQualificationPermit, coherentClickCommand),
    /BROWSER_DOM_CANDIDATE_MISSING/u,
  );
  assert.equal(actorStore.readState(coherentQualificationPermit.commandId), "REJECTED",
    "a coherent-click qualification terminal must not be misclassified as a missing receipt");
  assert.equal(coherentQualificationActor.mutationOutcome(coherentQualificationPermit.commandId), "no");

  let insufficientBudgetSends = 0;
  const insufficientBudgetPermit: BrowserCommandPermit = {
    ...permit("actor-insufficient-postcondition-budget"), commandTtlMs: 5_999,
  };
  await assert.rejects(actorFor(async () => {
    insufficientBudgetSends += 1;
    throw new Error("MUST_NOT_SEND");
  }).execute(insufficientBudgetPermit, coherentClickCommand), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.equal(insufficientBudgetSends, 0,
    "a command without postcondition timeout plus terminal-reply margin must fail before send");
  assert.equal(actorStore.readState(insufficientBudgetPermit.commandId), null,
    "insufficient reply budget must produce neither PREPARED nor DISPATCHED");

  const fileCommand = { kind: "file-input" as const, selector: "#upload-files",
    approvedFiles: [{ grantRef: "grant-one", contentHash: hash, maxBytes: 64 }],
    resolvedFilePaths: ["/approved/one.txt"] };
  const forgedFilePermit: BrowserCommandPermit = {
    ...permit("actor-file-forged-success"), capabilityId: "browser.file-input.v1",
  };
  await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, postconditionVerified: true } };
  }).execute(forgedFilePermit, fileCommand), /BROWSER_COMMAND_RECEIPT_MISSING/u,
  "file-input may not be confirmed without exact selected-count, approved-set, and accept readback");
  assert.equal(actorStore.readState(forgedFilePermit.commandId), "DISPATCHED",
    "a malformed after-dispatch file receipt must remain unknown rather than inventing success");

  const confirmedFilePermit: BrowserCommandPermit = {
    ...permit("actor-file-confirmed"), capabilityId: "browser.file-input.v1",
  };
  await actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: true,
        mutationCount: 1, selectedFileCount: 1, approvedSetVerified: true, acceptVerified: true,
        postconditionVerified: true } };
  }).execute(confirmedFilePermit, fileCommand);
  assert.equal(actorStore.readState(confirmedFilePermit.commandId), "CONFIRMED");

  const rejectedPermit = permit("actor-rejected");
  const rejectedActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return {
      replyChannelToken: candidate.replyChannelToken,
      transportSequence: 2,
      permitSequence: candidate.sequence,
      result: {
        clicked: true,
        candidateCount: 1,
        identityRevalidated: true,
        mutationCount: 1,
        postconditionVerified: false,
        postconditionRawCount: 1,
        postconditionEligibleCount: 0,
        postconditionRejections: [{ index: 0, reasons: ["ARIA_HIDDEN"] }],
        failureCode: "BROWSER_POSTCONDITION_FAILED",
        nativeCauseCode: "ARIA_HIDDEN",
      },
    };
  });
  await assert.rejects(
    rejectedActor.execute(rejectedPermit, matchClickCommand),
    /BROWSER_POSTCONDITION_FAILED/u,
  );
  assert.equal(actorStore.readState(rejectedPermit.commandId), "REJECTED");
  assert.equal(rejectedActor.mutationOutcome(rejectedPermit.commandId), "confirmed");
  const rejectedDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(rejectedDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(rejectedPermit.commandId), {
    reason: "BROWSER_POSTCONDITION_FAILED", native_cause_code: "ARIA_HIDDEN",
  }, "the Browser WAL must retain the exact postcondition rejection cause");
  rejectedDatabase.close();
  exerciseStrictMutationReceipts();
  exerciseBrowserDiagnosticContract();
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
  lawId: "LAW-LOCAL-BROWSER-SESSION-004-V19",
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
