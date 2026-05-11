import type { z } from "zod";

import type {
  AiAbilityInputSchema,
  AiAbilityResultSchema,
} from "./schema.js";
import type { AI_CAPABILITY_ID, AI_CHILD_CAPABILITY_ID } from "./registry.js";
import type { LocalAiDebugHook } from "../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";

type AiAbilityInput = z.infer<typeof AiAbilityInputSchema>;
type AiAbilityResult = z.infer<typeof AiAbilityResultSchema>;

type AiPromptContractCatalogEntry = {
  promptContractId: string;
  promptContractVersion: string;
  promptCatalogVersion: string;
  taskType: "visual_mission_judgment";
  outputSchemaRef: "ai.visual_mission_judgment.v1";
  requiredInputRefs: string[];
  timeoutMs: number;
};

type CreateConfiguredAiAbilityGroupInput = {
  dataDir?: string;
  emitDebugEvent?: LocalAiDebugHook;
};

type AiAbilityGroup = {
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<AiAbilityResult>;
  getHealth(): Promise<{ ok: boolean; detail: string }>;
  getRuntimeHealth(): Promise<{
    lastTaskType: string | null;
    lastInvocationStatus: string | null;
    lastFailureReason: string | null;
  }>;
};

export type {
  AiAbilityGroup,
  AiAbilityInput,
  AiAbilityResult,
  AiPromptContractCatalogEntry,
  CreateConfiguredAiAbilityGroupInput,
};

export { AI_CAPABILITY_ID, AI_CHILD_CAPABILITY_ID };