import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const baziAiFullAnalysisPlugin: ProductPlugin = {
  pluginId: "bazi-ai-full-analysis", pluginVersion: 6, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_ai_full_analysis", actionId: "produce" },
    { productId: "bazi_ai_full_analysis", actionId: "accuracy_challenge" },
    { productId: "bazi_ai_full_analysis", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:bazi-ai-full-analysis:${task.action_id}`);
  },
};
