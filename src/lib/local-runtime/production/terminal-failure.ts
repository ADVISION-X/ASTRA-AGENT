import {
  executionFailureCause,
  executionFailureMetadata,
  failureCode,
} from "../../execution-failure.js";
import { typedBrowserExecutionFailure } from "../../browser/browser-authority-api.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";

export type SerializedStoppedEmptyProof = Readonly<{
  first_observed_at: string;
  terminal_observed_at: string;
  continuous_monotonic_ms: number;
  observation_count: number;
  identity_hash: `sha256:${string}`;
  terminal_observation_revision_hash: `sha256:${string}`;
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
      first_observed_at: stoppedEmpty.firstObservedAt,
      terminal_observed_at: stoppedEmpty.terminalObservedAt,
      continuous_monotonic_ms: stoppedEmpty.continuousMonotonicMs,
      observation_count: stoppedEmpty.observationCount,
      identity_hash: stoppedEmpty.identityHash,
      terminal_observation_revision_hash: stoppedEmpty.terminalObservationRevisionHash,
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
