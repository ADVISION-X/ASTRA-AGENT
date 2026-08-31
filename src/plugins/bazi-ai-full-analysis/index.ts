import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const baziAiFullAnalysisPlugin: ProductPlugin = {
  pluginId: "bazi-ai-full-analysis", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_ai_full_analysis", actionId: "produce" },
    { productId: "bazi_ai_full_analysis", actionId: "accuracy_challenge" },
    { productId: "bazi_ai_full_analysis", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
