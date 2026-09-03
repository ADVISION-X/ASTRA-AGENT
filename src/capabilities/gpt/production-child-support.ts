import type { GptChildCapabilityResult, GptHash } from "./contract.js";
import { withRuntimeLogCause } from "../../lib/runtime-logs/index.js";
import { gptExecutionFailure } from "./execution-fault.js";
import { persistedGptEvidenceRef } from "./evidence-writer.js";
import type { ProductGptTools } from "./product-api.js";

export type GptProductionExecutionInput = Readonly<{
  jobId: string;
  continuationRef: string | null;
  ownerRef: string;
  subjectRef: string;
  authorizationRef: string;
  pluginId: string;
  pluginVersion: number;
  attemptId: string;
  deviceId: string;
  leaseVersion: number;
  executionFenceHash: GptHash;
  controlManifestHash: GptHash;
  maxProviderTurns: number;
  expiresAtMonotonic: number;
  commandTtlMs: number;
  abortSignal: AbortSignal;
  parentSpanId: string;
}>;

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  continuationRef(): string | null;
  reconcilePermanentCancellation(): Promise<void>;
  settle(error: unknown | null): Promise<void>;
}>;

export const childFailureEventIds = new WeakMap<object, string>();

export const throwGptChildFailure = (result: GptChildCapabilityResult): never => {
  const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
    name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
  }) : undefined;
  const evidenceRef = persistedGptEvidenceRef(result);
  const error = gptExecutionFailure(result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidence: evidenceRef ? Object.freeze({
      evidenceRef,
      evidenceHash: result.proof.evidenceHash,
    }) : null,
    browserEffect: result.failureBrowserEffect,
    ...(native ? { cause: native } : {}),
  });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};
