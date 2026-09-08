import { createHash } from "node:crypto";
import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
  GptChildCapabilityResult,
  GptChildInputMap,
} from "../contract.js";
import { isPendingExactEvidence, readExactGptEvidenceFact } from "../evidence-fact.js";
import {
  confirmedProviderReadbackEvidencePending,
  type ConfirmedProviderSubmitReceipt,
} from "../confirmed-provider-readback.js";
import { persistGptChildEvidence } from "../evidence-writer.js";
import type { GptEvidenceStorePort } from "../production-ports.js";
import { failureCode } from "../../../lib/execution-failure.js";

export const acceptanceHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type StoredEvidence = Readonly<{ recordRef: string; record: Readonly<Record<string, unknown>> }>;
type StoredArtifact = Readonly<{ content: Uint8Array<ArrayBuffer>; mimeType?: string; integrityHash: string }>;

export const createEvidenceHarness = (options: Readonly<{ storeArtifacts?: boolean }> = {}) => {
  const storedByKey = new Map<string, StoredEvidence>();
  const storedByRef = new Map<string, StoredEvidence>();
  const artifactsByRef = new Map<string, StoredArtifact>();
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
        ? "record:gpt-terminal-readback" : "record:gpt-failed-readback";
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
    appendArtifact: async (input) => {
      if (!options.storeArtifacts || input.content === undefined) return { status: "failed" };
      const content = typeof input.content === "string"
        ? new TextEncoder().encode(input.content) : new Uint8Array(input.content);
      const artifactRef = `artifact:gpt-acceptance:${artifactsByRef.size + 1}`;
      artifactsByRef.set(artifactRef, Object.freeze({ content,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        integrityHash: `sha256:${createHash("sha256").update(content).digest("hex")}` }));
      return { status: "success", artifactRef };
    },
    readRecordRef: async (input) => storedByRef.has(input.recordRef)
      ? { status: "success", recordRef: input.recordRef, record: storedByRef.get(input.recordRef)!.record }
      : { status: "failed" },
    readArtifactRef: async (input) => artifactsByRef.has(input.artifactRef)
      ? { status: "success", artifactRef: input.artifactRef, artifact: artifactsByRef.get(input.artifactRef) }
      : { status: "failed" },
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

export const acceptanceIntentFor = <K extends GptChildCapabilityId>(
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
    result: input.result, intent: input.intent, evidenceStore: input.evidenceStore,
    jobId: input.result.proof.jobId, attemptId: input.result.proof.attemptId,
    stepId: input.result.proof.productStepId,
    exactCallIdentityHash: input.result.proof.exactCallIdentityHash,
    ...(input.settlesPendingEvidence ? { settlesPendingEvidence: true } : {}),
  });
};

type LifecycleContext = Readonly<{
  result: GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  intent: GptChildCapabilityIntent<"wait_for_stable_gpt_text">;
  receipt: ConfirmedProviderSubmitReceipt;
  recovery: boolean;
  historicalFailure: GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  historicalPersistence: ReturnType<typeof createEvidenceHarness>;
}>;

const verifyPendingAndHistorical = async (
  result: GptChildCapabilityResult<"wait_for_stable_gpt_text">,
  input: GptChildInputMap["wait_for_stable_gpt_text"],
  receipt: ConfirmedProviderSubmitReceipt,
): Promise<LifecycleContext> => {
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_DOM_READ_INVALID");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.postconditionResult, "pending");
  const intent = acceptanceIntentFor<"wait_for_stable_gpt_text">(result, input);
  const recovery = confirmedProviderReadbackEvidencePending(receipt, intent);
  assert.equal(recovery, true, "the validated same-attempt submit receipt must authorize readback recovery");
  const pendingPersistence = createEvidenceHarness();
  await persistEvidence({ result, intent, evidenceStore: pendingPersistence.evidenceStore });
  assert.equal(await readbackFailureCode({
    evidenceStore: pendingPersistence.evidenceStore, intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "pending+no must remain invalid outside the validated post-submit context");
  const pending = await readExactGptEvidenceFact({
    evidenceStore: pendingPersistence.evidenceStore, intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash, postSubmitReadbackRecovery: recovery,
  });
  assert.equal(isPendingExactEvidence(pending), true);
  const historicalFailure = Object.freeze({
    ...result, proof: Object.freeze({ ...result.proof, postconditionResult: "failed" as const }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const historicalPersistence = createEvidenceHarness();
  await persistEvidence({ result: historicalFailure, intent, evidenceStore: historicalPersistence.evidenceStore });
  assert.equal(await readbackFailureCode({
    evidenceStore: historicalPersistence.evidenceStore, intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash,
  }), "BROWSER_DOM_READ_INVALID", "the historical failure must remain terminal without receipt context");
  const recovered = await readExactGptEvidenceFact({
    evidenceStore: historicalPersistence.evidenceStore, intent,
    exactCallIdentityHash: result.proof.exactCallIdentityHash, postSubmitReadbackRecovery: recovery,
  });
  assert.equal(isPendingExactEvidence(recovered), true,
    "the exact historical failed+no initial record must become retryable only in context");
  return Object.freeze({ result, intent, receipt, recovery, historicalFailure, historicalPersistence });
};

const verifyMismatchedReceipts = async (context: LifecycleContext): Promise<void> => {
  const mismatches: readonly ConfirmedProviderSubmitReceipt[] = Object.freeze([
    Object.freeze({ ...context.receipt, sourceAttemptId: "attempt:other" }),
    Object.freeze({ ...context.receipt, sourceProductStepId: "step:other" }),
    Object.freeze({ ...context.receipt, sourceActionOrdinal: context.intent.actionOrdinal }),
    Object.freeze({ ...context.receipt, promptHash: acceptanceHash("wrong-prompt") }),
    Object.freeze({ ...context.receipt, turnMarker: "[GRASSEYE:wrong-turn]" }),
    Object.freeze({ ...context.receipt, sourceTerminalAt: "not-an-iso-timestamp" }),
  ]);
  for (const mismatch of mismatches) {
    const recovery = confirmedProviderReadbackEvidencePending(mismatch, context.intent);
    assert.equal(recovery, false);
    assert.equal(await readbackFailureCode({
      evidenceStore: context.historicalPersistence.evidenceStore,
      intent: context.intent,
      exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
      postSubmitReadbackRecovery: recovery,
    }), "BROWSER_DOM_READ_INVALID", "receipt drift must remain fail closed");
  }
};

const verifyTerminalEvidence = async (context: LifecycleContext): Promise<void> => {
  const terminalPersistence = createEvidenceHarness();
  await persistEvidence({
    result: context.historicalFailure, intent: context.intent,
    evidenceStore: terminalPersistence.evidenceStore, settlesPendingEvidence: true,
  });
  assert.equal(await readbackFailureCode({
    evidenceStore: terminalPersistence.evidenceStore, intent: context.intent,
    exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: context.recovery,
  }), "BROWSER_DOM_READ_INVALID", "a terminal evidence key must never be reinterpreted as pending");
  const providerTerminal = Object.freeze({
    ...context.historicalFailure,
    failureCode: "GPT_PROVIDER_TERMINAL_DECLINED",
    proof: Object.freeze({
      ...context.historicalFailure.proof,
      childReasonCode: "GPT_PROVIDER_TERMINAL_DECLINED",
    }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const providerPersistence = createEvidenceHarness();
  await persistEvidence({ result: providerTerminal, intent: context.intent,
    evidenceStore: providerPersistence.evidenceStore });
  assert.equal(await readbackFailureCode({
    evidenceStore: providerPersistence.evidenceStore, intent: context.intent,
    exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: context.recovery,
  }), "GPT_PROVIDER_TERMINAL_DECLINED", "a Provider terminal result must remain terminal");
  await verifyMalformedEvidence(context, providerTerminal);
};

const verifyMalformedEvidence = async (
  context: LifecycleContext,
  providerTerminal: GptChildCapabilityResult<"wait_for_stable_gpt_text">,
): Promise<void> => {
  const malformedProviderPending = Object.freeze({
    ...providerTerminal,
    proof: Object.freeze({ ...providerTerminal.proof, postconditionResult: "pending" as const }),
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  const providerPersistence = createEvidenceHarness();
  await persistEvidence({ result: malformedProviderPending, intent: context.intent,
    evidenceStore: providerPersistence.evidenceStore });
  assert.equal(await readbackFailureCode({
    evidenceStore: providerPersistence.evidenceStore, intent: context.intent,
    exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: context.recovery,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "a Provider terminal failure mislabeled pending must fail structural validation");
  const malformedPersistence = createEvidenceHarness();
  await persistEvidence({ result: context.historicalFailure, intent: context.intent,
    evidenceStore: malformedPersistence.evidenceStore });
  const storedPayload = malformedPersistence.stored()!.record.payload as Readonly<Record<string, unknown>>;
  const malformedPayload = { ...storedPayload };
  delete malformedPayload.failure_proof;
  malformedPersistence.tamperLastPayload(Object.freeze(malformedPayload));
  assert.equal(await readbackFailureCode({
    evidenceStore: malformedPersistence.evidenceStore, intent: context.intent,
    exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: context.recovery,
  }), "FORENSICS_EXACT_CALL_EVIDENCE_INVALID",
  "a malformed historical failure must not be recovered as pending");
};

const verifySuccessfulSettlement = async (context: LifecycleContext): Promise<void> => {
  const success = Object.freeze({
    status: "success" as const,
    value: Object.freeze({
      assistantTurnId: "conversation-turn-2",
      responseHash: acceptanceHash("stable response"),
      responseText: "stable response",
    }),
    proof: Object.freeze({
      ...context.result.proof,
      childStatus: "success" as const, childReasonCode: "GPT_CHILD_SUCCESS",
      internalDecisionCode: "DONE" as const, committedMutation: "no" as const,
      postconditionResult: "passed" as const, browserFact: null, nativeFailureCode: null,
    }),
    reasoningRequirementResult: null, failureCode: null, failureCause: null, failureBrowserEffect: null,
  }) as GptChildCapabilityResult<"wait_for_stable_gpt_text">;
  await persistEvidence({ result: success, intent: context.intent,
    evidenceStore: context.historicalPersistence.evidenceStore, settlesPendingEvidence: true });
  const terminal = await readExactGptEvidenceFact({
    evidenceStore: context.historicalPersistence.evidenceStore, intent: context.intent,
    exactCallIdentityHash: context.result.proof.exactCallIdentityHash,
    postSubmitReadbackRecovery: context.recovery,
  });
  assert.equal(isPendingExactEvidence(terminal), false);
  assert.deepEqual(context.historicalPersistence.recordKeys(), [
    `gpt-call-evidence:v1:${context.result.proof.exactCallIdentityHash}`,
    `gpt-call-terminal-evidence:v1:${context.result.proof.exactCallIdentityHash}`,
  ]);
  assert.equal(context.historicalPersistence.recordCount(), 2);
  await persistEvidence({ result: success, intent: context.intent,
    evidenceStore: context.historicalPersistence.evidenceStore, settlesPendingEvidence: true });
  assert.equal(context.historicalPersistence.recordCount(), 2,
    "repeated settlement must preserve one unique terminal evidence record");
};

export const exerciseConfirmedProviderReadbackEvidenceLifecycle = async (
  result: GptChildCapabilityResult<"wait_for_stable_gpt_text">,
  input: GptChildInputMap["wait_for_stable_gpt_text"],
  receipt: ConfirmedProviderSubmitReceipt,
): Promise<void> => {
  const context = await verifyPendingAndHistorical(result, input, receipt);
  await verifyMismatchedReceipts(context);
  await verifyTerminalEvidence(context);
  await verifySuccessfulSettlement(context);
};
