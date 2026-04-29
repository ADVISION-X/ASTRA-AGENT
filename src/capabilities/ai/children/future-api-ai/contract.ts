import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { FutureApiAiChildExecutionPolicySchema, FutureApiAiChildInputSchema, FutureApiAiChildResultSchema } from "./schema.js";

export const FUTURE_API_AI_CHILD_ID = "future-api-ai";
export const FUTURE_API_AI_SUPPORTED_TASK_TYPES = [] as const;
export const FutureApiAiChildExecutionPolicy = FutureApiAiChildExecutionPolicySchema.parse({
  providerKind: "future",
  allowedTaskTypes: [],
  executable: false,
  disabledProviderDecision: "disabled",
  forbidsRuntimeExecution: true,
  forbidsLocalFallback: true,
});
export const FutureApiAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: FUTURE_API_AI_CHILD_ID,
  providerKind: "future",
  supportedTaskTypes: FUTURE_API_AI_SUPPORTED_TASK_TYPES,
  modelRole: "future",
  runtimeOwner: "ai-executor",
  implementationStatus: "disabled_by_policy",
  purpose: "Future API slot is non-executable until law unfreezes.",
  executionPolicy: {
    allowedTaskTypes: FUTURE_API_AI_SUPPORTED_TASK_TYPES,
    requiresLocalRuntime: false,
    executable: false,
    forbidsLocalAiGateway: true,
    forbidsLocalFallback: true,
  },
  boundaryPolicy: {
    forbidsPlatformActions: true,
    forbidsExecutableOutput: true,
    outputBoundaryGate: "ai-output-boundary-gate",
  },
  proofPolicy: {
    requiresRuntimeProof: true,
    requiresResultParse: true,
    requiresProofParse: true,
  },
};
export type FutureApiAiInput = z.output<typeof FutureApiAiChildInputSchema>;
export type FutureApiAiResult = z.output<typeof FutureApiAiChildResultSchema>;
