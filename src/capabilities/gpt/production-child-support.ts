import { gptCanonicalHash, type GptAnyChildCapabilityIntent, type GptChildBrowserFact,
  type GptChildCapabilityResult, type GptExecutionContext, type GptHash } from "./contract.js";
import { RuntimeFailureImpact, requireRuntimeLogWrite, runtimeLogCauseEventId, runtimeFailureFromError,
  withRuntimeLogCause, type RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import { executionFailure, executionFailureMetadata, failureCode, typedExecutionFailure } from "../../lib/execution-failure.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import type { ProductGptTools } from "./product-api.js";
import type { ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import type { GptProductionExecutionInput } from "./production-ports.js";

export type ProviderEffectReadbackProofV1 = Readonly<{ schema_version: "provider-effect-readback-proof.v1"; job_id: string;
  attempt_id: string; result_revision: number; provider_effect_identity_hash: GptHash; exact_call_identity_hash: GptHash;
  browser_authority_ref: string; browser_authority_hash: GptHash; readback_provider_input_delta: 0; proof_hash: GptHash }>;
const readbackKeys = ["attempt_id", "browser_authority_hash", "browser_authority_ref", "exact_call_identity_hash",
  "job_id", "proof_hash", "provider_effect_identity_hash", "readback_provider_input_delta", "result_revision", "schema_version"];
export const providerEffectReadbackProofHash = (proof: Omit<ProviderEffectReadbackProofV1, "proof_hash">): GptHash => gptCanonicalHash(proof);
export const isProviderEffectReadbackProofV1 = (value: unknown): value is ProviderEffectReadbackProofV1 => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Readonly<Record<string, unknown>>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(readbackKeys)) return false;
  const valid = row.schema_version === "provider-effect-readback-proof.v1"
    && [row.job_id, row.attempt_id, row.browser_authority_ref].every(field => typeof field === "string" && field.length > 0)
    && Number.isSafeInteger(row.result_revision) && Number(row.result_revision) >= 0
    && [row.provider_effect_identity_hash, row.exact_call_identity_hash, row.browser_authority_hash, row.proof_hash]
      .every(field => typeof field === "string" && /^sha256:[a-f0-9]{64}$/u.test(field))
    && row.readback_provider_input_delta === 0;
  if (!valid) return false;
  const unsigned = { schema_version: row.schema_version, job_id: row.job_id, attempt_id: row.attempt_id,
    result_revision: row.result_revision, provider_effect_identity_hash: row.provider_effect_identity_hash,
    exact_call_identity_hash: row.exact_call_identity_hash, browser_authority_ref: row.browser_authority_ref,
    browser_authority_hash: row.browser_authority_hash, readback_provider_input_delta: row.readback_provider_input_delta };
  return row.proof_hash === providerEffectReadbackProofHash(unsigned as Omit<ProviderEffectReadbackProofV1, "proof_hash">);
};
export type ProductGptExecution = Readonly<{ tools: ProductGptTools; readProviderEffectReadbackProof(): ProviderEffectReadbackProofV1 | null;
  decorateSettledResultFailure(error: unknown): unknown; settle(error: unknown | null): Promise<void> }>;
const nativeFailureCause = (result: GptChildCapabilityResult): Error | undefined => result.failureCause
  ? Object.assign(new Error(result.failureCause.name), { name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}) }) : undefined;
const proofFacts = (result: GptChildCapabilityResult) => ({ decision: result.proof.internalDecisionCode ?? "FAIL_CLOSED",
  factResultIds: result.proof.factResultIds, candidateCardinality: result.proof.candidateCardinality,
  authorityRefHashes: result.proof.authorityRefHashes, observationRevisionHash: result.proof.observationRevisionHash,
  mutationOutcome: result.proof.committedMutation, browserFact: result.proof.browserFact, nativeFailureCode: result.proof.nativeFailureCode,
  ...(result.proof.stoppedEmptyProof ? { stoppedEmptyProof: result.proof.stoppedEmptyProof } : {}) });
export const throwGptChildFailure = (result: GptChildCapabilityResult, evidenceRef: string = result.proof.evidenceRef,
  causeEventId?: string, confirmedProviderEffect?: GptChildBrowserFact | null): never => {
  const native = nativeFailureCause(result), original = proofFacts(result), preflight = result.proof.browserFact?.knownGptRateLimitPreflightFact;
  const facts = confirmedProviderEffect && preflight ? { ...original, mutationOutcome: confirmedProviderEffect.mutationOutcome,
    browserFact: Object.freeze({ ...confirmedProviderEffect, knownGptRateLimitPreflightFact: preflight }) } : original;
  const effect = confirmedProviderEffect ?? facts.browserFact;
  const evidence = effect ? { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash }
    : result.failureCode === "GPT_RESPONSE_STOPPED_EMPTY" && result.proof.stoppedEmptyProof
      ? { evidenceRef: result.proof.factResultIds[0] ?? evidenceRef, evidenceHash: result.proof.stoppedEmptyProof.terminalObservationRevisionHash }
      : { evidenceRef, evidenceHash: result.proof.evidenceHash };
  const error = gptExecutionFailure(result.failureCode ?? "GPT_CHILD_FAILED", { mutationOutcome: facts.mutationOutcome, evidence,
    browserEffect: confirmedProviderEffect ?? result.failureBrowserEffect ?? null, proofFacts: facts,
    childProof: result.failureCode === "GPT_RESPONSE_STOPPED_EMPTY" ? { evidenceRef, evidenceHash: result.proof.evidenceHash } : null,
    ...(native ? { cause: native } : {}) });
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};
export const terminalizeGptChildResult = (span: RuntimeSpanHandle, result: GptChildCapabilityResult): string => {
  const native = nativeFailureCause(result), causeEventId = runtimeLogCauseEventId(result);
  const error = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", { ...(native ? { cause: native } : {}) });
  const terminal = requireRuntimeLogWrite(result.status === "success" ? span.terminal({ outcome: "succeeded" })
    : span.terminal({ outcome: "failed", failure: runtimeFailureFromError({ error, code: result.failureCode ?? "GPT_CHILD_FAILED",
      responsibleOwner: "gpt", impact: causeEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
      ...(causeEventId ? { causedByEventId: causeEventId } : {}) }) }));
  return terminal.eventId;
};
export const terminalizeGptChildError = (span: RuntimeSpanHandle, error: unknown,
  confirmedProviderEffect?: ProductionGptBrowserCall["confirmedProviderEffect"]): never => {
  const causeEventId = runtimeLogCauseEventId(error), original = typedExecutionFailure(error)
    ?? executionFailure("failed", failureCode(error, "GPT_CHILD_RUNTIME_FAILED"), { cause: error });
  const gpt = typedGptExecutionFailure(error);
  const failure = confirmedProviderEffect ? gptExecutionFailure(original.code, { mutationOutcome: confirmedProviderEffect.mutationOutcome,
    evidence: { evidenceRef: confirmedProviderEffect.evidenceRef, evidenceHash: confirmedProviderEffect.evidenceHash },
    browserEffect: confirmedProviderEffect, proofFacts: gpt?.proofFacts ?? null,
    childProof: executionFailureMetadata(original)?.childProof ?? null, cause: original }) : original;
  const terminal = requireRuntimeLogWrite(span.terminal({ outcome: "failed", failure: runtimeFailureFromError({ error: failure,
    code: failureCode(failure, "GPT_CHILD_RUNTIME_FAILED"), responsibleOwner: "gpt",
    impact: causeEventId ? RuntimeFailureImpact.CONSEQUENTIAL : RuntimeFailureImpact.BLOCKING,
    ...(causeEventId ? { causedByEventId: causeEventId } : {}) }) }));
  throw withRuntimeLogCause(error instanceof AggregateError && error.cause !== undefined ? error : failure, terminal.eventId);
};
/** Return a known preflight result; the caller owns its one incident closure and terminal point. */
export const handleGptChildExecutionError = async (input: Readonly<{ dataDir: string; execution: GptProductionExecutionInput;
  intent: GptAnyChildCapabilityIntent; startedAt: string; error: unknown; browserCall: ProductionGptBrowserCall | undefined;
  browserAtomicIdentity: BrowserAtomicStepIdentity | undefined; span: RuntimeSpanHandle; childCapabilityId: string }>): Promise<GptChildCapabilityResult> => {
  if (!["BROWSER_GPT_DIALOG_UNRECOGNIZED", "BROWSER_KNOWN_GPT_RATE_LIMIT"].includes(failureCode(input.error))) {
    return terminalizeGptChildError(input.span, input.error, input.browserCall?.confirmedProviderEffect ?? null);
  }
  const atomicIdentity = input.browserCall ? input.browserAtomicIdentity ?? productionGptAtomicIdentity(input.intent, input.execution.resultRevision) : undefined;
  const context: GptExecutionContext = { dataDir: input.dataDir, signal: input.execution.abortSignal,
    ...(input.browserCall ? { browser: input.browserCall.facade } : {}), ...(atomicIdentity ? { browserAtomicIdentity: atomicIdentity } : {}) };
  return failedGptChildExecutionResult({ intent: input.intent, context, startedAt: input.startedAt, error: input.error });
};
