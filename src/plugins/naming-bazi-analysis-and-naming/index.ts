import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const namingBaziAnalysisAndNamingPlugin: ProductPlugin = {
  pluginId: "naming-bazi-analysis-and-naming", pluginVersion: 5, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_bazi_analysis_and_naming", actionId: "produce" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "accuracy_challenge" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:naming-bazi-analysis-and-naming:${task.action_id}`);
  },
};
