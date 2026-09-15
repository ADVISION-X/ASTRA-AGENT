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

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  decorateSettledResultFailure(error: unknown): unknown;
  settle(error: unknown | null): Promise<void>;
}>;

export const throwGptChildFailure = (
  result: GptChildCapabilityResult,
  evidenceRef: string = result.proof.evidenceRef,
  causeEventId?: string,
  confirmedProviderEffect?: GptChildBrowserFact | null,
): never => {
  const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
    name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
  }) : undefined;
  const browserFact = result.proof.browserFact ?? confirmedProviderEffect ?? null;
  const error = gptExecutionFailure(result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidence: browserFact ? Object.freeze({
      evidenceRef: browserFact.evidenceRef,
      evidenceHash: browserFact.evidenceHash,
    }) : Object.freeze({
      evidenceRef,
      evidenceHash: result.proof.evidenceHash,
    }),
    browserEffect: result.failureBrowserEffect ?? confirmedProviderEffect ?? null,
    ...(native ? { cause: native } : {}),
  });
  const propagated = causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
  throw propagated;
};
