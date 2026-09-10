import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptChildCapabilityResult,
  GptChildInputMap,
} from "../contract.js";
import {
  confirmedSubmitReadbackDocumentHash,
  isPendingExactEvidence,
  readExactGptEvidenceFact,
} from "../evidence-fact.js";
import { executionFailure, failureCode } from "../../../lib/execution-failure.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { persistGptChildEvidence, persistGptPreExecutionFailure } from "../evidence-writer.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { throwGptChildFailure } from "../production-child-support.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import {
  acceptanceHash as hash,
  acceptanceIntentFor as intentFor,
  createEvidenceHarness as evidenceHarness,
} from "./gpt-confirmed-provider-readback.acceptance-support.js";
export { exerciseConfirmedProviderReadbackEvidenceLifecycle } from
  "./gpt-confirmed-provider-readback.acceptance-support.js";

export const exerciseFailedEvidenceReadback = async <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  input: GptChildInputMap[K],
  expectedFailure: ReturnType<typeof serializeTerminalFailure>,
): Promise<void> => {
  const { evidenceStore } = evidenceHarness();
  const proof = result.proof;
  const intent = intentFor(result, input);
  await persistGptChildEvidence({
    result, intent, evidenceStore, jobId: proof.jobId, attemptId: proof.attemptId,
    stepId: proof.productStepId, exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  let replayedFailure: unknown = null;
  try {
    await readExactGptEvidenceFact({
      evidenceStore, intent, exactCallIdentityHash: proof.exactCallIdentityHash,
    });
  } catch (error) { replayedFailure = error; }
  const typed = typedGptExecutionFailure(replayedFailure);
  assert.deepEqual(serializeTerminalFailure(replayedFailure), expectedFailure);
  assert.deepEqual(typed?.proofFacts?.browserFact, result.proof.browserFact);
  assert.deepEqual(typed?.proofFacts?.candidateCardinality, result.proof.candidateCardinality);
  assert.deepEqual(typed?.proofFacts?.factResultIds, result.proof.factResultIds);
  assert.deepEqual(typed?.reasoningRequirementResult, result.reasoningRequirementResult);
};

export const exerciseReasoningEvidenceReadback = async (
  result: GptChildCapabilityResult<"ensure_gpt_reasoning_requirement">,
  input: GptChildInputMap["ensure_gpt_reasoning_requirement"],
): Promise<void> => {
  assert.equal(result.status, "success");
  const persistence = evidenceHarness();
  const proof = result.proof;
  const intent = intentFor(result, input);
  await persistGptChildEvidence({
    result, intent, evidenceStore: persistence.evidenceStore,
    jobId: proof.jobId, attemptId: proof.attemptId,
    stepId: proof.productStepId, exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  const readback = await readExactGptEvidenceFact({
    evidenceStore: persistence.evidenceStore,
    intent,
    exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  assert.equal(readback?.readbackVerified, true);
  const payload = persistence.stored()?.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(payload.schema_version, "agent-gpt-evidence-safe.v2");
  assert.equal(payload.input_hash, result.proof.inputHash);
  const pageInputRoleHashes = payload.page_input_role_hashes as Readonly<Record<string, unknown>>;
  assert.deepEqual(pageInputRoleHashes.reasoningRequirement, {
    hash: hash(JSON.stringify({ requestedTier: input.profile.reasoningRequirement.requestedTier,
      selectionPolicy: input.profile.reasoningRequirement.selectionPolicy })),
    selectionPolicy: input.profile.reasoningRequirement.selectionPolicy,
    requestedTier: input.profile.reasoningRequirement.requestedTier,
  });
  assert.deepEqual(payload.reasoning_requirement_result, result.reasoningRequirementResult);
};

export const exerciseContinuationPageInputRoleEvidence = async <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  input: GptChildInputMap[K],
): Promise<void> => {
  assert.equal(result.status, "success");
  const values = input as Readonly<Record<string, unknown>>;
  const rawUrl = values.canonicalConversationUrl ?? values.sourceCanonicalConversationUrl;
  assert.equal(typeof rawUrl, "string");
  const url = new URL(rawUrl as string);
  assert.equal(typeof values.sourcePromptHash, "string");
  assert.equal(typeof values.sourceResponseHash, "string");
  assert.equal(typeof values.sourceTurnMarker, "string");
  assert.equal(typeof values.sourceAssistantTurnId, "string");
  const persistence = evidenceHarness({ storeArtifacts: true });
  await persistGptChildEvidence({
    result, intent: intentFor(result, input), evidenceStore: persistence.evidenceStore,
    jobId: result.proof.jobId, attemptId: result.proof.attemptId,
    stepId: result.proof.productStepId, exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  const payload = persistence.stored()?.record.payload as Readonly<Record<string, unknown>>;
  const pageInputRoleHashes = payload.page_input_role_hashes as Readonly<Record<string, unknown>>;
  assert.equal(pageInputRoleHashes.conversationUrlHash, hash(`${url.origin}${url.pathname}`));
  assert.equal(pageInputRoleHashes.promptHash, values.sourcePromptHash);
  assert.equal(pageInputRoleHashes.responseHash, values.sourceResponseHash);
  assert.equal(pageInputRoleHashes.turnMarkerHash, hash(values.sourceTurnMarker as string));
  assert.equal(pageInputRoleHashes.assistantTurnIdHash, hash(values.sourceAssistantTurnId as string));
};

export const exerciseConfirmedSubmitFailureEvidenceReadback = async (
  result: GptChildCapabilityResult<"submit_exact_gpt_turn_once">,
  input: GptChildInputMap["submit_exact_gpt_turn_once"],
): Promise<void> => {
  assert.equal(result.status, "failed");
  assert.equal(result.proof.browserFact?.effectScope, "provider_effect");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "confirmed");
  const persistence = evidenceHarness();
  const proof = result.proof;
  const intent = intentFor<"submit_exact_gpt_turn_once">(result, input);
  await persistGptChildEvidence({
    result, intent, evidenceStore: persistence.evidenceStore,
    jobId: proof.jobId, attemptId: proof.attemptId,
    stepId: proof.productStepId, exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  const pending = await readExactGptEvidenceFact({
    evidenceStore: persistence.evidenceStore,
    intent,
    exactCallIdentityHash: proof.exactCallIdentityHash,
  });
  assert.equal(result.proof.postconditionResult, "pending");
  assert.equal(isPendingExactEvidence(pending), true);
  assert.equal(pending?.readbackVerified, true);
  assert.equal(pending?.evidenceRef, persistence.stored()?.recordRef);
};

export const exerciseConfirmedSubmitDocumentEvidence = async (
  result: GptChildCapabilityResult<"submit_exact_gpt_turn_once">,
  input: GptChildInputMap["submit_exact_gpt_turn_once"],
): Promise<void> => {
  const intent = intentFor(result, input);
  const persistence = evidenceHarness();
  await persistGptChildEvidence({
    result, intent, evidenceStore: persistence.evidenceStore,
    jobId: result.proof.jobId, attemptId: result.proof.attemptId,
    stepId: result.proof.productStepId, exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  const payload = persistence.stored()!.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(payload.confirmed_submit_readback_document_hash, result.proof.afterDocumentRefHash,
    "confirmed submit evidence must bind the direct post-submit Document by hash");
  const verified = await readExactGptEvidenceFact({
    evidenceStore: persistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  assert.equal(confirmedSubmitReadbackDocumentHash(verified), result.proof.afterDocumentRefHash);
  persistence.tamperLastPayload(Object.freeze({
    ...payload,
    confirmed_submit_readback_document_hash: null,
  }));
  await assert.rejects(
    () => readExactGptEvidenceFact({
      evidenceStore: persistence.evidenceStore,
      intent,
      exactCallIdentityHash: result.proof.exactCallIdentityHash,
    }),
    (error: unknown) => failureCode(error) === "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
    "confirmed submit evidence without the D1 hash must fail closed",
  );
};

export const exerciseBrowserRejectedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-rejected-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({
        rawCount: 1,
        eligibleCount: 1,
        matches: Object.freeze([{ exactEditableTextHash: hash("stale draft") }]),
      }),
    });
    if (intent.kind === "fill") return {
      filled: true, mutationCount: 1, retainedValueVerified: false, postconditionVerified: false,
      failureCode: "BROWSER_POSTCONDITION_FAILED",
      nativeCauseCode: "BROWSER_FILL_RETAINED_VALUE_MISMATCH",
    };
    throw new Error(`UNEXPECTED_REJECTED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(result.failureCause?.code, "BROWSER_FILL_RETAINED_VALUE_MISMATCH");
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.browserFact?.browserOutcome, "REJECTED");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  assert.equal(result.proof.browserFact?.evidenceHash, `sha256:${"9".repeat(64)}`);
  assert.equal(fixture.physicalMutations(), 1);
  let serialized: ReturnType<typeof serializeTerminalFailure> | null = null;
  try { throwGptChildFailure(result); }
  catch (error) { serialized = serializeTerminalFailure(error); }
  assert.deepEqual(serialized, {
    code: "BROWSER_POSTCONDITION_FAILED",
    mutation_outcome: "confirmed",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: "BROWSER_FILL_RETAINED_VALUE_MISMATCH" },
  });
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const recovered = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-rejected-wal-readback",
    gpt: Object.freeze({
      execute: async () => { throw new Error("REJECTED_WAL_MUST_NOT_REPLAY_GPT"); },
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    confirmedProviderSubmitReceipt: null,
    signal: new AbortController().signal,
  });
  assert.equal(recovered.result.failureCode, "BROWSER_POSTCONDITION_FAILED");
  assert.equal(recovered.result.proof.nativeFailureCode, "BROWSER_FILL_RETAINED_VALUE_MISMATCH");
  let recoveredFailure: unknown = null;
  try { throwGptChildFailure(recovered.result); }
  catch (error) { recoveredFailure = error; }
  assert.deepEqual(serializeTerminalFailure(recoveredFailure), serialized,
    "a rejected Browser WAL readback must preserve the exact outer and native failure tuple");
  await exerciseFailedEvidenceReadback(result, Object.freeze({ timeoutMs: 1_000 }), serialized!);
};

export const exerciseBrowserRejectedDispatchedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-rejected-dispatched-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({
        rawCount: 1,
        eligibleCount: 1,
        matches: Object.freeze([{ exactEditableTextHash: hash("stale draft") }]),
      }),
    });
    if (intent.kind === "fill") return {
      mutationCount: 1,
      terminalRejectedDispatched: true,
      failureCode: "BROWSER_CAPABILITY_REJECTED",
    };
    throw new Error(`UNEXPECTED_REJECTED_DISPATCHED_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_CAPABILITY_REJECTED");
  assert.equal(result.proof.committedMutation, "dispatched");
  assert.equal(result.proof.browserFact?.browserOutcome, "REJECTED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "dispatched");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  assert.equal(fixture.physicalMutations(), 1);
  let serialized: ReturnType<typeof serializeTerminalFailure> | null = null;
  try { throwGptChildFailure(result); }
  catch (error) { serialized = serializeTerminalFailure(error); }
  assert.deepEqual(serialized, {
    code: "BROWSER_CAPABILITY_REJECTED",
    mutation_outcome: "dispatched",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "REJECTED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: null },
  });
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const recovered = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-rejected-dispatched-wal-readback",
    gpt: Object.freeze({
      execute: async () => { throw new Error("REJECTED_DISPATCHED_WAL_MUST_NOT_REPLAY_GPT"); },
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    confirmedProviderSubmitReceipt: null,
    signal: new AbortController().signal,
  });
  assert.equal(recovered.result.failureCode, "BROWSER_CAPABILITY_REJECTED");
  assert.equal(recovered.result.proof.committedMutation, "dispatched");
  assert.equal(recovered.result.proof.browserFact?.browserOutcome, "REJECTED");
  let recoveredFailure: unknown = null;
  try { throwGptChildFailure(recovered.result); }
  catch (error) { recoveredFailure = error; }
  assert.deepEqual(serializeTerminalFailure(recoveredFailure), serialized,
    "a rejected+dispatched Browser WAL readback must preserve the terminal tuple without replay");
  await exerciseFailedEvidenceReadback(result, Object.freeze({ timeoutMs: 1_000 }), serialized!);
};

type CleanChatResult = GptChildCapabilityResult<"prepare_clean_gpt_chat">;
type CleanChatIntent = GptChildCapabilityIntent<"prepare_clean_gpt_chat">;

const assertPendingDispatchedPersistence = async (
  result: CleanChatResult,
  intent: CleanChatIntent,
  persistence: ReturnType<typeof evidenceHarness>,
): Promise<void> => {
  await persistGptChildEvidence({
    result, intent, evidenceStore: persistence.evidenceStore,
    jobId: result.proof.jobId, attemptId: result.proof.attemptId,
    stepId: result.proof.productStepId, exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  const pending = await readExactGptEvidenceFact({
    evidenceStore: persistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  });
  assert.equal(isPendingExactEvidence(pending), true);
  const payload = persistence.stored()?.record.payload as Readonly<Record<string, unknown>>;
  const failureProof = payload.failure_proof as Readonly<Record<string, unknown>>;
  assert.deepEqual(failureProof.browser_fact, {
    exact_call_identity_hash: result.proof.exactCallIdentityHash,
    child_capability_id: "prepare_clean_gpt_chat",
    effect_scope: "target_local",
    browser_outcome: "DISPATCHED",
    mutation_outcome: "dispatched",
    terminal_at: null,
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
  });
};

const assertDispatchedAtomicRecovery = async (
  result: CleanChatResult,
  intent: CleanChatIntent,
  fixture: ReturnType<typeof fakeBrowser>,
): Promise<void> => {
  const readback = Object.freeze({
    ...result,
    proof: Object.freeze({
      ...result.proof,
      childReasonCode: "GPT_CHAT_DRAFT_CLEAR_FAILED",
      committedMutation: "no" as const,
      postconditionResult: "failed" as const,
      browserFact: null,
      nativeFailureCode: "GPT_CHAT_ATTACHMENT_PRESENT",
    }),
    failureCode: "GPT_CHAT_DRAFT_CLEAR_FAILED",
    failureCause: Object.freeze({ name: "Error", code: "GPT_CHAT_ATTACHMENT_PRESENT" }),
    failureBrowserEffect: null,
  }) as CleanChatResult;
  const atomic = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-dispatched-readback",
    gpt: Object.freeze({
      execute: async () => readback as never,
    }),
    store: {} as never,
    browsers: {} as never,
    intent,
    browserCall: { browser: fixture.browser, facade: fixture.browser, providerWaitLog: null },
    confirmedProviderSubmitReceipt: null,
    signal: new AbortController().signal,
  });
  assert.equal(atomic.result.proof.browserFact?.browserOutcome, "DISPATCHED");
  assert.equal(atomic.result.proof.postconditionResult, "pending");
  let replayed: unknown = null;
  try { throwGptChildFailure(atomic.result); }
  catch (error) { replayed = error; }
  assert.deepEqual(serializeTerminalFailure(replayed), {
    code: "GPT_CHAT_DRAFT_CLEAR_FAILED",
    mutation_outcome: "dispatched",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "DISPATCHED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: "GPT_CHAT_ATTACHMENT_PRESENT" },
  });
};

export const exerciseBrowserDispatchedEvidenceReadback = async (): Promise<void> => {
  const { execute } = createGptAcceptanceHarness("gpt-browser-dispatched-evidence");
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      composer: Object.freeze({ rawCount: 1, eligibleCount: 1,
        matches: Object.freeze([{ exactEditableTextHash: hash("stale draft") }]) }),
    });
    if (intent.kind === "fill") return { mutationCount: 1, receiptMissing: true };
    throw new Error(`UNEXPECTED_DISPATCHED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_COMMAND_RECEIPT_MISSING");
  assert.equal(result.proof.committedMutation, "dispatched");
  assert.equal(result.proof.postconditionResult, "pending");
  assert.equal(result.proof.browserFact?.browserOutcome, "DISPATCHED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "dispatched");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  const intent = intentFor<"prepare_clean_gpt_chat">(
    result, Object.freeze({ timeoutMs: 1_000 }),
  );
  const persistence = evidenceHarness();
  await assertPendingDispatchedPersistence(result, intent, persistence);
  await assertDispatchedAtomicRecovery(result, intent, fixture);
};

export const exercisePreExecutionFailureEvidence = async (): Promise<void> => {
  const persistence = evidenceHarness();
  const exactCallIdentityHash = hash("pre-execution-failure");
  const intent = Object.freeze({
    childCapabilityId: "checkpoint_gpt_generated_image" as const,
    executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
    jobId: "job:gpt-pre-execution-failure",
    attemptId: "attempt:gpt-pre-execution-failure",
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 22,
    productStepId: "article-image",
    callId: "image-checkpoint",
    inputHash: hash("pre-execution-input"),
    actionOrdinal: 12,
    input: Object.freeze({}) as never,
  });
  const evidenceRef = await persistGptPreExecutionFailure({
    intent,
    evidenceStore: persistence.evidenceStore,
    jobId: intent.jobId,
    attemptId: intent.attemptId,
    stepId: intent.productStepId,
    exactCallIdentityHash,
    error: executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID"),
  });
  assert.equal(evidenceRef, "record:gpt-failed-readback");
  assert.deepEqual(persistence.recordKeys(), [
    `gpt-call-pre-execution-failure:v1:${exactCallIdentityHash}`,
  ]);
  const payload = persistence.stored()!.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(payload.schema_version, "agent-gpt-pre-execution-failure.v1");
  assert.equal(payload.exact_call_identity_hash, exactCallIdentityHash);
  assert.equal(payload.child_capability_id, "checkpoint_gpt_generated_image");
  assert.equal(payload.failure_code, "BROWSER_RECONCILIATION_SCOPE_INVALID");
  assert.equal(payload.mutation_outcome, "no");
};
