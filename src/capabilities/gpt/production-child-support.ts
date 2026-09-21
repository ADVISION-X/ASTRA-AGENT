import { gptCanonicalHash } from "./contract.js";
import type { GptChildBrowserFact, GptChildCapabilityResult, GptHash } from "./contract.js";
import { withRuntimeLogCause } from "../../lib/runtime-logs/index.js";
import { gptExecutionFailure } from "./execution-fault.js";
import type { ProductGptTools } from "./product-api.js";

export type GptProductionExecutionInput = Readonly<{
  jobId: string;
  productId: string;
  ownerRef: string;
  subjectRef: string;
  authorizationRef: string;
  resultRevision: number;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  executionFenceHash: GptHash;
  capabilityManifestHash: GptHash;
  maxProviderTurns: number;
  expiresAtMonotonic: number;
  commandTtlMs: number;
  abortSignal: AbortSignal;
  parentSpanId: string;
  providerContinuationParent?: Readonly<{ jobId: string; acceptedAttemptId: string }>;
}>;

export type ProviderEffectReadbackProofV1 = Readonly<{
  schema_version: "provider-effect-readback-proof.v1";
  job_id: string;
  attempt_id: string;
  result_revision: number;
  provider_effect_identity_hash: GptHash;
  exact_call_identity_hash: GptHash;
  browser_authority_ref: string;
  browser_authority_hash: GptHash;
  readback_provider_input_delta: 0;
  proof_hash: GptHash;
}>;

const providerEffectReadbackProofKeys = [
  "attempt_id", "browser_authority_hash", "browser_authority_ref", "exact_call_identity_hash",
  "job_id", "proof_hash", "provider_effect_identity_hash", "readback_provider_input_delta",
  "result_revision", "schema_version",
];

export const providerEffectReadbackProofHash = (
  proof: Omit<ProviderEffectReadbackProofV1, "proof_hash">,
): GptHash => gptCanonicalHash(proof);

export const isProviderEffectReadbackProofV1 = (
  value: unknown,
): value is ProviderEffectReadbackProofV1 => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(providerEffectReadbackProofKeys)) return false;
  const withoutHash = Object.freeze({
    schema_version: row.schema_version,
    job_id: row.job_id,
    attempt_id: row.attempt_id,
    result_revision: row.result_revision,
    provider_effect_identity_hash: row.provider_effect_identity_hash,
    exact_call_identity_hash: row.exact_call_identity_hash,
    browser_authority_ref: row.browser_authority_ref,
    browser_authority_hash: row.browser_authority_hash,
    readback_provider_input_delta: row.readback_provider_input_delta,
  }) as Omit<ProviderEffectReadbackProofV1, "proof_hash">;
  return row.schema_version === "provider-effect-readback-proof.v1"
    && typeof row.job_id === "string" && row.job_id.length > 0
    && typeof row.attempt_id === "string" && row.attempt_id.length > 0
    && Number.isSafeInteger(row.result_revision) && Number(row.result_revision) >= 0
    && [row.provider_effect_identity_hash, row.exact_call_identity_hash, row.browser_authority_hash, row.proof_hash]
      .every((hash) => typeof hash === "string" && /^sha256:[a-f0-9]{64}$/u.test(hash))
    && typeof row.browser_authority_ref === "string" && row.browser_authority_ref.length > 0
    && row.readback_provider_input_delta === 0
    && row.proof_hash === providerEffectReadbackProofHash(withoutHash);
};

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  readProviderEffectReadbackProof(): ProviderEffectReadbackProofV1 | null;
  decorateSettledResultFailure(error: unknown): unknown;
  settle(error: unknown | null): Promise<void>;
}>;

const nativeFailureCause = (result: GptChildCapabilityResult): Error | undefined =>
  result.failureCause ? Object.assign(new Error(result.failureCause.name), {
    name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
  }) : undefined;

const stoppedEmptyEvidence = (result: GptChildCapabilityResult) =>
  result.failureCode === "GPT_RESPONSE_STOPPED_EMPTY" && result.proof.stoppedEmptyProof
    ? Object.freeze({
        evidenceRef: result.proof.factResultIds[0] ?? result.proof.evidenceRef,
        evidenceHash: result.proof.stoppedEmptyProof.terminalObservationRevisionHash,
      })
    : null;

const failureEvidence = (
  result: GptChildCapabilityResult,
  evidenceRef: string,
  browserFact: GptChildBrowserFact | null,
  confirmedProviderEffect?: GptChildBrowserFact | null,
) => confirmedProviderEffect ? Object.freeze({
  evidenceRef: confirmedProviderEffect.evidenceRef,
  evidenceHash: confirmedProviderEffect.evidenceHash,
}) : browserFact ? Object.freeze({
  evidenceRef: browserFact.evidenceRef,
  evidenceHash: browserFact.evidenceHash,
}) : stoppedEmptyEvidence(result) ?? Object.freeze({ evidenceRef, evidenceHash: result.proof.evidenceHash });

const failureProofFacts = (result: GptChildCapabilityResult) => Object.freeze({
  decision: result.proof.internalDecisionCode ?? "FAIL_CLOSED",
  factResultIds: result.proof.factResultIds,
  candidateCardinality: result.proof.candidateCardinality,
  authorityRefHashes: result.proof.authorityRefHashes,
  observationRevisionHash: result.proof.observationRevisionHash,
  mutationOutcome: result.proof.committedMutation,
  browserFact: result.proof.browserFact,
  nativeFailureCode: result.proof.nativeFailureCode,
  ...(result.proof.stoppedEmptyProof
    ? { stoppedEmptyProof: result.proof.stoppedEmptyProof } : {}),
});

export const throwGptChildFailure = (
  result: GptChildCapabilityResult,
  evidenceRef: string = result.proof.evidenceRef,
  causeEventId?: string,
  confirmedProviderEffect?: GptChildBrowserFact | null,
): never => {
  const native = nativeFailureCause(result);
  const browserFact = result.proof.browserFact ?? confirmedProviderEffect ?? null;
  const proofFacts = failureProofFacts(result);
  const confirmedReadbackMismatch = confirmedProviderEffect
    && result.proof.browserFact?.knownGptRateLimitPreflightFact
    ? Object.freeze({
        ...proofFacts,
        mutationOutcome: confirmedProviderEffect.mutationOutcome,
        browserFact: Object.freeze({
          ...confirmedProviderEffect,
          knownGptRateLimitPreflightFact:
            result.proof.browserFact.knownGptRateLimitPreflightFact,
        }),
      })
    : proofFacts;
  const error = gptExecutionFailure(result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: confirmedReadbackMismatch.mutationOutcome,
    evidence: failureEvidence(result, evidenceRef, browserFact,
      confirmedReadbackMismatch.browserFact?.knownGptRateLimitPreflightFact
        ? null : confirmedProviderEffect),
    browserEffect: confirmedProviderEffect ?? result.failureBrowserEffect ?? null,
    proofFacts: confirmedReadbackMismatch,
    childProof: result.failureCode === "GPT_RESPONSE_STOPPED_EMPTY"
      ? Object.freeze({ evidenceRef, evidenceHash: result.proof.evidenceHash }) : null,
    ...(native ? { cause: native } : {}),
  });
  const propagated = causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
  throw propagated;
};
