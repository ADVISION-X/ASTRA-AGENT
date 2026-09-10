import type { GptChildCapabilityResult, GptHash } from "./contract.js";
import { withRuntimeLogCause } from "../../lib/runtime-logs/index.js";
import {
  carryProductSafeConfirmedProviderSubmitReceipt,
  gptExecutionFailure,
} from "./execution-fault.js";
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
  capabilityManifestHash: GptHash;
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

export const throwGptChildFailure = (
  result: GptChildCapabilityResult,
  evidenceRef: string = result.proof.evidenceRef,
  causeEventId?: string,
): never => {
  const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
    name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
  }) : undefined;
  const browserFact = result.proof.browserFact;
  const error = gptExecutionFailure(result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidence: browserFact ? Object.freeze({
      evidenceRef: browserFact.evidenceRef,
      evidenceHash: browserFact.evidenceHash,
    }) : Object.freeze({
      evidenceRef,
      evidenceHash: result.proof.evidenceHash,
    }),
    browserEffect: result.failureBrowserEffect,
    ...(native ? { cause: native } : {}),
  });
  const propagated = causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
  if (result.proof.childCapabilityId === "submit_exact_gpt_turn_once"
    && result.proof.committedMutation === "confirmed"
    && browserFact?.effectScope === "provider_effect"
    && browserFact.browserOutcome === "CONFIRMED"
    && browserFact.mutationOutcome === "confirmed"
    && browserFact.terminalAt
    && evidenceRef) {
    throw carryProductSafeConfirmedProviderSubmitReceipt(propagated, {
      exactCallIdentityHash: result.proof.exactCallIdentityHash,
      terminalAt: browserFact.terminalAt,
      evidenceRef,
      evidenceHash: result.proof.evidenceHash,
    });
  }
  throw propagated;
};
