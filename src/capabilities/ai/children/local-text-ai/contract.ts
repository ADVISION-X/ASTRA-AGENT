import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { LocalTextAiChildExecutionPolicySchema, LocalTextAiChildInputSchema, LocalTextAiChildResultSchema } from "./schema.js";

export const LOCAL_TEXT_AI_CHILD_ID = "local-text-ai";
export const LOCAL_TEXT_AI_SUPPORTED_TASK_TYPES = ["comment_signal_summary", "product_signal_summary"] as const;
export const LocalTextAiChildExecutionPolicy = LocalTextAiChildExecutionPolicySchema.parse({
  providerKind: "local",
  allowedTaskTypes: [...LOCAL_TEXT_AI_SUPPORTED_TASK_TYPES],
  requiresLocalRuntime: true,
  forbidsPlatformActions: true,
});
export const LocalTextAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: LOCAL_TEXT_AI_CHILD_ID,
  providerKind: "local",
  supportedTaskTypes: LOCAL_TEXT_AI_SUPPORTED_TASK_TYPES,
  modelRole: "multi-role",
  runtimeOwner: "ai-executor",
  implementationStatus: "local_runtime",
  purpose: "Run governed local text cognition without platform action authority.",
};
export type LocalTextAiInput = z.output<typeof LocalTextAiChildInputSchema>;
export type LocalTextAiResult = z.output<typeof LocalTextAiChildResultSchema>;
