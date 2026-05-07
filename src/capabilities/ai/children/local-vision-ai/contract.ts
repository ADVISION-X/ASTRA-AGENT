import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { LocalVisionAiChildExecutionPolicySchema, LocalVisionAiChildInputSchema, LocalVisionAiChildResultSchema } from "./schema.js";

export const LOCAL_VISION_AI_CHILD_ID = "local-vision-ai";
export const LOCAL_VISION_AI_SUPPORTED_TASK_TYPES = ["page_preparation_judgment", "product_presence_judgment", "visual_observation", "visual_target_candidate_analysis"] as const;
export const LocalVisionAiChildExecutionPolicy = LocalVisionAiChildExecutionPolicySchema.parse({
  providerKind: "local",
  allowedTaskTypes: [...LOCAL_VISION_AI_SUPPORTED_TASK_TYPES],
  requiresLocalRuntime: true,
  forbidsPlatformActions: true,
});
export const LocalVisionAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: LOCAL_VISION_AI_CHILD_ID,
  providerKind: "local",
  supportedTaskTypes: LOCAL_VISION_AI_SUPPORTED_TASK_TYPES,
  modelRole: "vision",
  runtimeOwner: "ai-executor",
  implementationStatus: "local_runtime",
  purpose: "Run governed local vision cognition without platform action authority.",
  executionPolicy: {
    allowedTaskTypes: LOCAL_VISION_AI_SUPPORTED_TASK_TYPES,
    requiresLocalRuntime: true,
    executable: true,
    forbidsLocalAiGateway: false,
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
export type LocalVisionAiInput = z.output<typeof LocalVisionAiChildInputSchema>;
export type LocalVisionAiResult = z.output<typeof LocalVisionAiChildResultSchema>;
