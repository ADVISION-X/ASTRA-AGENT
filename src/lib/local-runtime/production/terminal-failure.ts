import { executionFailureCause, failureCode } from "../../execution-failure.js";
import { typedBrowserExecutionFailure } from "../../browser/browser-authority-api.js";
import {
  postCheckpointReceiverReceipt,
  postSubmitReadbackReceipt,
  typedGptExecutionFailure,
} from "../../../capabilities/gpt/index.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";

export type SerializedExecutionFailure = Readonly<{
  code: string;
  mutation_outcome: "no" | "dispatched" | "confirmed";
  effect_scope: "target_local" | "provider_effect" | null;
  child_capability_id: string | null;
  browser_outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED" | null;
  evidence_ref: string | null;
  evidence_hash: `sha256:${string}` | null;
  cause: Readonly<{ name: string; code: string | null }> | null;
}>;

export const serializeTerminalFailure = (
  error: unknown,
): SerializedExecutionFailure => {
  const browser = typedBrowserExecutionFailure(error);
  const gpt = typedGptExecutionFailure(error);
  const checkpoint = postCheckpointReceiverReceipt(error);
  const submit = postSubmitReadbackReceipt(error);
  const evidence = submit ?? gpt?.evidence ?? (checkpoint ? Object.freeze({
    evidenceRef: checkpoint.artifactRef,
    evidenceHash: checkpoint.semanticTextHash,
  }) : null);
  return Object.freeze({
    code: failureCode(error),
    mutation_outcome: gpt?.mutationOutcome ?? browser?.mutationOutcome ?? "no",
    effect_scope: gpt?.browserEffect?.effectScope ?? browser?.browserEffect?.effectScope ?? null,
    child_capability_id: gpt?.browserEffect?.childCapabilityId
      ?? browser?.browserEffect?.childCapabilityId ?? null,
    browser_outcome: gpt?.browserEffect?.browserOutcome ?? browser?.browserEffect?.browserOutcome ?? null,
    evidence_ref: evidence?.evidenceRef ?? null,
    evidence_hash: evidence?.evidenceHash ?? null,
    cause: executionFailureCause(error),
  });
};

export const terminalFailureHttpStatus = (error: unknown): number | null =>
  typedRuntimeTransportFailure(error)?.httpStatus ?? null;
