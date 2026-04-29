import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { PaidVisionAiChildExecutionPolicySchema, PaidVisionAiChildInputSchema, PaidVisionAiChildResultSchema } from "./schema.js";

export const PAID_VISION_AI_CHILD_ID = "paid-vision-ai";
export const PAID_VISION_AI_SUPPORTED_TASK_TYPES = ["visual_observation", "visual_target_candidate_analysis"] as const;
export const PaidVisionAiChildExecutionPolicy = PaidVisionAiChildExecutionPolicySchema.parse({
  providerKind: "paid",
  allowedTaskTypes: [...PAID_VISION_AI_SUPPORTED_TASK_TYPES],
  executable: false,
  disabledProviderDecision: "disabled",
  forbidsLocalFallback: true,
});
export const PaidVisionAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: PAID_VISION_AI_CHILD_ID,
  providerKind: "paid",
  supportedTaskTypes: PAID_VISION_AI_SUPPORTED_TASK_TYPES,
  modelRole: "vision",
  runtimeOwner: "ai-executor",
  implementationStatus: "disabled_by_policy",
  purpose: "Reserved paid vision provider; governed-disabled and forbidden to fallback to local.",
};
export type PaidVisionAiInput = z.output<typeof PaidVisionAiChildInputSchema>;
export type PaidVisionAiResult = z.output<typeof PaidVisionAiChildResultSchema>;
