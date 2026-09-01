import type { GptChildCapabilityResult } from "../../../capabilities/gpt/index.js";
import { withRuntimeLogCause } from "../../runtime-logs/index.js";
import { executionFailure } from "../../typed-failure.js";
import type { ProductionExecutionLease } from "./executor.js";
import { childFailureEventIds, persistedEvidenceRefs } from "./gpt-evidence-writer.js";
import type { ProductGptTools } from "./plugin.js";
import type { ProductionHash, WebsiteAgentTask } from "./contracts.js";

export type GptChildExecutionInput = Readonly<{
  task: WebsiteAgentTask;
  pluginId: string;
  pluginVersion: number;
  lease: ProductionExecutionLease;
  parentSpanId: string;
}>;

export type ConfirmedProviderSubmitReceipt = Readonly<{
  sourceAttemptId: string;
  sourceExactCallIdentityHash: ProductionHash;
  sourceActionOrdinal: number;
  sourceProductStepId: string;
  sourceCallId: string;
  sourceTargetRef: string;
  sourceDocumentRef: string;
  sourceTerminalAt: string;
  evidenceRef: string;
  evidenceHash: ProductionHash;
  promptHash: ProductionHash;
  turnMarker: string;
}>;

export type ProductGptExecution = Readonly<{
  tools: ProductGptTools;
  continuationRef(): string | null;
  reconcilePermanentCancellation(): Promise<void>;
  settle(error: unknown | null): Promise<void>;
}>;

export const throwGptChildFailure = (result: GptChildCapabilityResult): never => {
  const native = result.failureCause ? Object.assign(new Error(result.failureCause.name), {
    name: result.failureCause.name,
    ...(result.failureCause.code ? { code: result.failureCause.code } : {}),
  }) : undefined;
  const error = executionFailure("failed", result.failureCode ?? "GPT_CHILD_FAILED", {
    mutationOutcome: result.proof.committedMutation,
    evidenceRef: persistedEvidenceRefs.get(result) ?? null,
    evidenceHash: result.proof.evidenceHash,
    ...(native ? { cause: native } : {}),
  });
  const causeEventId = childFailureEventIds.get(result);
  throw causeEventId ? withRuntimeLogCause(error, causeEventId) : error;
};
