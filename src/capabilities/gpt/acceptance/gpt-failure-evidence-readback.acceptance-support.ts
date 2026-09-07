import { createHash } from "node:crypto";
import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptChildCapabilityResult,
  GptChildInputMap,
} from "../contract.js";
import {
  isPendingExactEvidence,
  readExactGptEvidenceFact,
} from "../evidence-fact.js";
import {
  confirmedProviderReadbackEvidencePending,
  type ConfirmedProviderSubmitReceipt,
} from "../confirmed-provider-readback.js";
import { typedGptExecutionFailure } from "../execution-fault.js";
import { persistGptChildEvidence } from "../evidence-writer.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
import type { GptEvidenceStorePort } from "../production-ports.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { failureCode } from "../../../lib/execution-failure.js";
import { throwGptChildFailure } from "../production-child-support.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type StoredEvidence = Readonly<{ recordRef: string; record: Readonly<Record<string, unknown>> }>;
const evidenceHarness = () => {
  const storedByKey = new Map<string, StoredEvidence>();
  const storedByRef = new Map<string, StoredEvidence>();
  let lastStored: StoredEvidence | null = null;
  const evidenceStore: GptEvidenceStorePort = {
    appendRecord: async (input) => {
      const existing = storedByKey.get(input.idempotencyKey);
      if (existing) {
        return JSON.stringify(existing.record.payload) === JSON.stringify(input.recordPayload)
          ? { status: "success", recordRef: existing.recordRef }
          : { status: "failed" };
      }
      const recordRef = input.idempotencyKey.startsWith("gpt-call-terminal-evidence:v1:")
        ? "record:gpt-terminal-readback"
        : "record:gpt-failed-readback";
      const stored = Object.freeze({ recordRef, record: Object.freeze({
        missionId: input.missionId, runId: input.runId, stepId: input.stepId,
        sourceAbilityGroupId: input.sourceCapabilityId,
        sourceChildCapabilityId: input.sourceChildCapabilityId,
        idempotencyKey: input.idempotencyKey, payload: input.recordPayload,
        artifactRefs: Object.freeze([...(input.artifactRefs ?? [])]),
      }) });
      storedByKey.set(input.idempotencyKey, stored);
      storedByRef.set(recordRef, stored);
      lastStored = stored;
      return { status: "success", recordRef };
    },
    appendArtifact: async () => ({ status: "failed" }),
    readRecordRef: async (input) => storedByRef.has(input.recordRef)
      ? { status: "success", recordRef: input.recordRef, record: storedByRef.get(input.recordRef)!.record }
      : { status: "failed" },
    readArtifactRef: async () => ({ status: "failed" }),
    readExactCallEvidence: async (input) => storedByKey.get(
      `gpt-call-terminal-evidence:v1:${input.exactCallIdentityHash}`,
    ) ?? storedByKey.get(`gpt-call-evidence:v1:${input.exactCallIdentityHash}`) ?? null,
  };
  return Object.freeze({
    evidenceStore,
    stored: () => lastStored,
    recordCount: () => storedByKey.size,
    recordKeys: () => Object.freeze([...storedByKey.keys()]),
    tamperLastPayload: (payload: Readonly<Record<string, unknown>>): void => {
      if (!lastStored) throw new Error("EVIDENCE_TEST_RECORD_MISSING");
      const key = String(lastStored.record.idempotencyKey);
      const replacement = Object.freeze({
        recordRef: lastStored.recordRef,
        record: Object.freeze({ ...lastStored.record, payload }),
      });
      storedByKey.set(key, replacement);
      storedByRef.set(replacement.recordRef, replacement);
      lastStored = replacement;
    },
  });
};

const intentFor = <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>,
  input: GptChildInputMap[K],
): GptChildCapabilityIntent<K> => {
  const proof = result.proof;
  return Object.freeze({
    childCapabilityId: proof.childCapabilityId as K, executionId: proof.executionId,
    jobId: proof.jobId, attemptId: proof.attemptId, pluginId: proof.pluginId,
    pluginVersion: proof.pluginVersion, productStepId: proof.productStepId,
    callId: proof.callId, inputHash: proof.inputHash, actionOrdinal: proof.actionOrdinal,
    input,
  }) as GptChildCapabilityIntent<K>;
};

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
  assert.deepEqual(payload.reasoning_requirement_result, result.reasoningRequirementResult);
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

const readbackFailureCode = async (input: Readonly<{
  evidenceStore: GptEvidenceStorePort;
  intent: GptChildCapabilityIntent;
  exactCallIdentityHash: `sha256:${string}`;
  postSubmitReadbackRecovery?: boolean;
}>): Promise<string | null> => {
  try {
    await readExactGptEvidenceFact(input);
    return null;
  } catch (error) {
    return failureCode(error, "UNKNOWN_FAILURE");
  }
};

const persistEvidence = async <K extends GptChildCapabilityId>(input: Readonly<{
  result: GptChildCapabilityResult<K>;
  intent: GptChildCapabilityIntent<K>;
  evidenceStore: GptEvidenceStorePort;
  settlesPendingEvidence?: boolean;
}>): Promise<void> => {
  await persistGptChildEvidence({
    result: input.result,
    intent: input.intent,
    evidenceStore: input.evidenceStore,
    jobId: input.result.proof.jobId,
    attemptId: input.result.proof.attemptId,
    stepId: input.result.proof.productStepId,
    exactCallIdentityHash: input.result.proof.exactCallIdentityHash,
    ...(input.settlesPendingEvidence ? { settlesPendingEvidence: true } : {}),
  });
};

export const exerciseConfirmedProviderReadbackEvidenceLifecycle = async (
  result: GptChildCapabilityResult<"wait_for_stable_gpt_text">,
  input: GptChildInputMap["wait_for_stable_gpt_text"],
  receipt: ConfirmedProviderSubmitReceipt,
): Promise<void> => {
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_DOM_READ_INVALID");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.postconditionResult, "pending");
  const intent = intentFor(result, input);
  const recovery = confirmedProviderReadbackEvidencePending(receipt, intent);
  assert.equal(recovery, true, "the validated same-attempt submit receipt must authorize readback recovery");

  const pendingPersistence = evidenceHarness();
  await persistEvidence({ result, intent, evidenceStore: pendingPersistence.evidenceStore });
  assert.equal(await readbackFailureCode({
    evidenceStore: pendingPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "pending+no must remain invalid outside the validated post-submit context");
  const pending = await readExactGptEvidenceFact({
    evidenceStore: pendingPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  });
  assert.equal(isPendingExactEvidence(pending), true);

  const historicalFailure = Object.freeze({
    ...result,
    proof: Object.freeze({ ...result.proof, postconditionResult: "failed" as const }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const historicalPersistence = evidenceHarness();
  await persistEvidence({
    result: historicalFailure,
    intent,
    evidenceStore: historicalPersistence.evidenceStore,
  });
  assert.equal(await readbackFailureCode({
    evidenceStore: historicalPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  }), "BROWSER_DOM_READ_INVALID", "the historical failure must remain terminal without receipt context");
  const recovered = await readExactGptEvidenceFact({
    evidenceStore: historicalPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  });
  assert.equal(isPendingExactEvidence(recovered), true,
    "the exact historical failed+no initial record must become retryable only in context");

  const mismatchedReceipts: readonly ConfirmedProviderSubmitReceipt[] = Object.freeze([
    Object.freeze({ ...receipt, sourceAttemptId: "attempt:other" }),
    Object.freeze({ ...receipt, sourceProductStepId: "step:other" }),
    Object.freeze({ ...receipt, sourceActionOrdinal: intent.actionOrdinal }),
    Object.freeze({ ...receipt, promptHash: hash("wrong-prompt") }),
    Object.freeze({ ...receipt, turnMarker: "[GRASSEYE:wrong-turn]" }),
    Object.freeze({ ...receipt, sourceTerminalAt: "not-an-iso-timestamp" }),
  ]);
  for (const mismatch of mismatchedReceipts) {
    const mismatchedRecovery = confirmedProviderReadbackEvidencePending(mismatch, intent);
    assert.equal(mismatchedRecovery, false);
    assert.equal(await readbackFailureCode({
      evidenceStore: historicalPersistence.evidenceStore,
      intent,
      exactCallIdentityHash: result.proof.exactCallIdentityHash,
      postSubmitReadbackRecovery: mismatchedRecovery,
    }), "BROWSER_DOM_READ_INVALID", "receipt drift must remain fail closed");
  }

  const terminalPersistence = evidenceHarness();
  await persistEvidence({
    result: historicalFailure,
    intent,
    evidenceStore: terminalPersistence.evidenceStore,
    settlesPendingEvidence: true,
  });
  assert.equal(await readbackFailureCode({
    evidenceStore: terminalPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  }), "BROWSER_DOM_READ_INVALID", "a terminal evidence key must never be reinterpreted as pending");

  const providerTerminal = Object.freeze({
    ...historicalFailure,
    failureCode: "GPT_PROVIDER_TERMINAL_DECLINED",
    proof: Object.freeze({
      ...historicalFailure.proof,
      childReasonCode: "GPT_PROVIDER_TERMINAL_DECLINED",
    }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const providerTerminalPersistence = evidenceHarness();
  await persistEvidence({
    result: providerTerminal,
    intent,
    evidenceStore: providerTerminalPersistence.evidenceStore,
  });
  assert.equal(await readbackFailureCode({
    evidenceStore: providerTerminalPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  }), "GPT_PROVIDER_TERMINAL_DECLINED", "a Provider terminal result must remain terminal");

  const malformedProviderPending = Object.freeze({
    ...providerTerminal,
    proof: Object.freeze({
      ...providerTerminal.proof,
      postconditionResult: "pending" as const,
    }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const malformedProviderPendingPersistence = evidenceHarness();
  await persistEvidence({
    result: malformedProviderPending,
    intent,
    evidenceStore: malformedProviderPendingPersistence.evidenceStore,
  });
  assert.equal(await readbackFailureCode({
    evidenceStore: malformedProviderPendingPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "a Provider terminal failure mislabeled pending must fail structural validation");

  const malformedPersistence = evidenceHarness();
  await persistEvidence({
    result: historicalFailure,
    intent,
    evidenceStore: malformedPersistence.evidenceStore,
  });
  const storedPayload = malformedPersistence.stored()!.record.payload as Readonly<Record<string, unknown>>;
  const malformedPayload = { ...storedPayload };
  delete malformedPayload.failure_proof;
  malformedPersistence.tamperLastPayload(Object.freeze(malformedPayload));
  assert.equal(await readbackFailureCode({
    evidenceStore: malformedPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "a malformed historical failure must not be recovered as pending");

  const success = Object.freeze({
    status: "success" as const,
    value: Object.freeze({
      assistantTurnId: "conversation-turn-2",
      responseHash: hash("stable response"),
      responseText: "stable response",
    }),
    proof: Object.freeze({
      ...result.proof,
      childStatus: "success" as const,
      childReasonCode: "GPT_CHILD_SUCCESS",
      internalDecisionCode: "DONE" as const,
      committedMutation: "no" as const,
      postconditionResult: "passed" as const,
      browserFact: null,
      nativeFailureCode: null,
    }),
    reasoningRequirementResult: null,
    failureCode: null,
    failureCause: null,
    failureBrowserEffect: null,
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  await persistEvidence({
    result: success,
    intent,
    evidenceStore: historicalPersistence.evidenceStore,
    settlesPendingEvidence: true,
  });
  const terminal = await readExactGptEvidenceFact({
    evidenceStore: historicalPersistence.evidenceStore,
    intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: recovery,
  });
  assert.equal(isPendingExactEvidence(terminal), false);
  assert.deepEqual(historicalPersistence.recordKeys(), [
    `gpt-call-evidence:v1:${result.proof.exactCallIdentityHash}`,
    `gpt-call-terminal-evidence:v1:${result.proof.exactCallIdentityHash}`,
  ]);
  assert.equal(historicalPersistence.recordCount(), 2);
  await persistEvidence({
    result: success,
    intent,
    evidenceStore: historicalPersistence.evidenceStore,
    settlesPendingEvidence: true,
  });
  assert.equal(historicalPersistence.recordCount(), 2,
    "repeated settlement must preserve one unique terminal evidence record");
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
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
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
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
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
      abilityGroupId: "gpt" as const,
      transport: "gpt-web" as const,
      listChildCapabilityIds: () => Object.freeze(["prepare_clean_gpt_chat" as const]),
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
