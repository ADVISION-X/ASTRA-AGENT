import { loadLocalAiModelConfig } from "../../../lib/local-ai/model-config.js";
import type { LocalAiModelConfig, LocalModelRole } from "../../../lib/local-ai/model-config.js";

export async function loadAiOwnedLocalModelConfig(): Promise<LocalAiModelConfig> {
  return loadLocalAiModelConfig();
}

export type { LocalAiModelConfig, LocalModelRole };