import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const hehunAiAnalysisPlugin: ProductPlugin = {
  pluginId: "hehun-ai-analysis", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "hehun_ai_analysis", actionId: "produce" },
    { productId: "hehun_ai_analysis", actionId: "accuracy_challenge" },
    { productId: "hehun_ai_analysis", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
