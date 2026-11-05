import {
  executionFailureCause,
  executionFailureMetadata,
  failureCode,
} from "../../execution-failure.js";
import { typedBrowserExecutionFailure } from "../../browser/browser-authority-api.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";

export type SerializedStoppedEmptyProof = Readonly<{
  schema_version: "gpt-stopped-empty-after-five-retries.v1";
  original_effect_identity_hash: `sha256:${string}`;
  original_wal_authority_ref: string;
  original_wal_authority_hash: `sha256:${string}`;
  retries: readonly Readonly<{ ordinal: number; effect_identity_hash: `sha256:${string}`;
    wal_authority_ref: string; wal_authority_hash: `sha256:${string}`;
    pre_empty_observation_revision_hash: `sha256:${string}` }>[];
  terminal_observation_revision_hash: `sha256:${string}`;
  terminal_observed_at: string;
}>;

export type SerializedExecutionFailure = Readonly<{
  code: string;
  mutation_outcome: "no" | "dispatched" | "confirmed";
  effect_scope: "target_local" | "provider_effect" | null;
  child_capability_id: string | null;
  browser_outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED" | null;
  evidence_ref: string | null;
  evidence_hash: `sha256:${string}` | null;
  child_proof_ref: string | null;
  child_proof_hash: `sha256:${string}` | null;
  stopped_empty_proof: SerializedStoppedEmptyProof | null;
  cause: Readonly<{ name: string; code: string | null }> | null;
}>;

export type SerializedTerminalFailure = SerializedExecutionFailure & Readonly<{
  provider_effect_identity_hash: `sha256:${string}` | null;
  settled_result_payload_hash: `sha256:${string}` | null;
}>;

export type AttemptFailureReleaseDescriptor = Readonly<{
  attempt_id: string;
  lease_version: number;
  request_id: string;
  body_payload_hash: `sha256:${string}`;
  write_request_payload_hash: `sha256:${string}`;
}>;

export type AttemptFailureFirstFact = Readonly<{
  failure_core: SerializedTerminalFailure;
  release_descriptor: AttemptFailureReleaseDescriptor;
}>;

export type AttemptFailureDisposition =
  | "new_attempt_allowed"
  | "same_attempt_provider_readback"
  | "fail_closed";

const browserEvidenceComplete = (failure: SerializedTerminalFailure): boolean =>
  failure.child_capability_id !== null
  && failure.evidence_ref !== null && failure.evidence_hash !== null;

const ordinaryProofFieldsEmpty = (failure: SerializedTerminalFailure): boolean =>
  failure.child_proof_ref === null && failure.child_proof_hash === null
  && failure.stopped_empty_proof === null && failure.settled_result_payload_hash === null;

const confirmedProviderEffect = (failure: SerializedTerminalFailure): boolean =>
  browserEvidenceComplete(failure) && failure.effect_scope === "provider_effect"
  && failure.provider_effect_identity_hash !== null
  && failure.browser_outcome === "CONFIRMED" && failure.mutation_outcome === "confirmed";

const rejectedBeforeProviderEffect = (failure: SerializedTerminalFailure): boolean =>
  ordinaryProofFieldsEmpty(failure) && browserEvidenceComplete(failure)
  && failure.browser_outcome === "REJECTED"
  && (failure.effect_scope === "target_local" && failure.provider_effect_identity_hash === null
    || failure.effect_scope === "provider_effect" && failure.provider_effect_identity_hash !== null
      && failure.mutation_outcome === "no");

const sameEffectReadback = (failure: SerializedTerminalFailure): boolean =>
  ordinaryProofFieldsEmpty(failure) && browserEvidenceComplete(failure)
  && failure.effect_scope === "provider_effect" && failure.provider_effect_identity_hash !== null
  && (failure.browser_outcome === "DISPATCHED" && failure.mutation_outcome === "dispatched"
    || failure.browser_outcome === "CONFIRMED" && failure.mutation_outcome === "confirmed"
    || failure.browser_outcome === "REJECTED"
      && ["dispatched", "confirmed"].includes(failure.mutation_outcome));

const settledResultRevision = (failure: SerializedTerminalFailure): boolean =>
  confirmedProviderEffect(failure) && failure.settled_result_payload_hash !== null
  && failure.child_proof_ref === null && failure.child_proof_hash === null
  && failure.stopped_empty_proof === null;

const stoppedEmptyRevision = (failure: SerializedTerminalFailure): boolean =>
  confirmedProviderEffect(failure) && failure.child_capability_id === "retry_exact_gpt_response_once"
  && failure.child_proof_ref !== null && failure.child_proof_hash !== null
  && failure.stopped_empty_proof !== null && failure.settled_result_payload_hash === null;

export const classifyAttemptFailure = (
  failure: SerializedTerminalFailure,
): AttemptFailureDisposition => {
  if (failure.code === "RESULT_SETTLED_UNUSABLE")
    return settledResultRevision(failure) ? "new_attempt_allowed" : "fail_closed";
  if (failure.code === "GPT_RESPONSE_STOPPED_EMPTY")
    return stoppedEmptyRevision(failure) ? "new_attempt_allowed" : "fail_closed";
  if (rejectedBeforeProviderEffect(failure)) {
    return "new_attempt_allowed";
  }
  if (sameEffectReadback(failure)) {
    return "same_attempt_provider_readback";
  }
  return "fail_closed";
};

export const serializeTerminalFailure = (
  error: unknown,
): SerializedExecutionFailure => {
  const browser = typedBrowserExecutionFailure(error);
  const metadata = executionFailureMetadata(error);
  const evidence = metadata?.evidence ?? null;
  const stoppedEmpty = metadata?.stoppedEmptyProof ?? null;
  const failure: SerializedExecutionFailure = Object.freeze({
    code: failureCode(error),
    mutation_outcome: metadata?.mutationOutcome ?? browser?.mutationOutcome ?? "no",
    effect_scope: metadata?.browserEffect?.effectScope ?? browser?.browserEffect?.effectScope ?? null,
    child_capability_id: metadata?.browserEffect?.childCapabilityId
      ?? browser?.browserEffect?.childCapabilityId ?? null,
    browser_outcome: metadata?.browserEffect?.browserOutcome ?? browser?.browserEffect?.browserOutcome ?? null,
    evidence_ref: evidence?.evidenceRef ?? null,
    evidence_hash: evidence?.evidenceHash ?? null,
    child_proof_ref: metadata?.childProof?.evidenceRef ?? null,
    child_proof_hash: metadata?.childProof?.evidenceHash ?? null,
    stopped_empty_proof: stoppedEmpty ? Object.freeze({
      schema_version: stoppedEmpty.schemaVersion,
      original_effect_identity_hash: stoppedEmpty.originalEffectIdentityHash,
      original_wal_authority_ref: stoppedEmpty.originalWalAuthorityRef,
      original_wal_authority_hash: stoppedEmpty.originalWalAuthorityHash,
      retries: Object.freeze(stoppedEmpty.retries.map(retry => Object.freeze({ ordinal: retry.ordinal,
        effect_identity_hash: retry.effectIdentityHash, wal_authority_ref: retry.walAuthorityRef,
        wal_authority_hash: retry.walAuthorityHash,
        pre_empty_observation_revision_hash: retry.preEmptyObservationRevisionHash }))),
      terminal_observation_revision_hash: stoppedEmpty.terminalObservationRevisionHash,
      terminal_observed_at: stoppedEmpty.terminalObservedAt,
    }) : null,
    cause: executionFailureCause(error),
  });
  return failure;
};

export const serializeTerminalFailureTransport = (
  error: unknown,
): SerializedTerminalFailure => {
  const metadata = executionFailureMetadata(error);
  const browser = typedBrowserExecutionFailure(error);
  return Object.freeze({
    ...serializeTerminalFailure(error),
    provider_effect_identity_hash: metadata?.browserEffect?.providerEffectIdentityHash
      ?? browser?.browserEffect?.providerEffectIdentityHash ?? null,
    settled_result_payload_hash: metadata?.settledResultPayloadHash ?? null,
  });
};

export const terminalFailureHttpStatus = (error: unknown): number | null =>
  typedRuntimeTransportFailure(error)?.httpStatus ?? null;
