import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const hehunAiAnalysisPlugin: ProductPlugin = {
  pluginId: "hehun-ai-analysis", pluginVersion: 5, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "hehun_ai_analysis", actionId: "produce" },
    { productId: "hehun_ai_analysis", actionId: "accuracy_challenge" },
    { productId: "hehun_ai_analysis", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:hehun-ai-analysis:${task.action_id}`);
  },
};
