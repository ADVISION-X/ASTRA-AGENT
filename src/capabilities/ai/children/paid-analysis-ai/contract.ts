import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { PaidAnalysisAiChildExecutionPolicySchema, PaidAnalysisAiChildInputSchema, PaidAnalysisAiChildResultSchema } from "./schema.js";

export const PAID_ANALYSIS_AI_CHILD_ID = "paid-analysis-ai";
export const PAID_ANALYSIS_AI_SUPPORTED_TASK_TYPES = ["evidence_packet_analysis", "map_authoring"] as const;
export const PaidAnalysisAiChildExecutionPolicy = PaidAnalysisAiChildExecutionPolicySchema.parse({
  providerKind: "paid",
  allowedTaskTypes: [...PAID_ANALYSIS_AI_SUPPORTED_TASK_TYPES],
  executable: false,
  disabledProviderDecision: "disabled",
  forbidsLocalFallback: true,
});
export const PaidAnalysisAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: PAID_ANALYSIS_AI_CHILD_ID,
  providerKind: "paid",
  supportedTaskTypes: PAID_ANALYSIS_AI_SUPPORTED_TASK_TYPES,
  modelRole: "future",
  runtimeOwner: "ai-executor",
  implementationStatus: "policy_guarded",
  purpose: "Reserved paid analysis provider for explicit operator-approved external execution.",
  executionPolicy: {
    allowedTaskTypes: PAID_ANALYSIS_AI_SUPPORTED_TASK_TYPES,
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
export type PaidAnalysisAiInput = z.output<typeof PaidAnalysisAiChildInputSchema>;
export type PaidAnalysisAiResult = z.output<typeof PaidAnalysisAiChildResultSchema>;
