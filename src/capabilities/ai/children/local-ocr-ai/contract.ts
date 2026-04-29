import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { LocalOcrAiChildExecutionPolicySchema, LocalOcrAiChildInputSchema, LocalOcrAiChildResultSchema } from "./schema.js";

export const LOCAL_OCR_AI_CHILD_ID = "local-ocr-ai";
export const LOCAL_OCR_AI_SUPPORTED_TASK_TYPES = ["ocr_cleanup"] as const;
export const LocalOcrAiChildExecutionPolicy = LocalOcrAiChildExecutionPolicySchema.parse({
  providerKind: "local",
  allowedTaskTypes: [...LOCAL_OCR_AI_SUPPORTED_TASK_TYPES],
  requiresLocalRuntime: true,
  forbidsPlatformActions: true,
});
export const LocalOcrAiChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: LOCAL_OCR_AI_CHILD_ID,
  providerKind: "local",
  supportedTaskTypes: LOCAL_OCR_AI_SUPPORTED_TASK_TYPES,
  modelRole: "ocr",
  runtimeOwner: "ai-executor",
  implementationStatus: "local_runtime",
  purpose: "Run governed local OCR cleanup without platform action authority.",
};
export type LocalOcrAiInput = z.output<typeof LocalOcrAiChildInputSchema>;
export type LocalOcrAiResult = z.output<typeof LocalOcrAiChildResultSchema>;
