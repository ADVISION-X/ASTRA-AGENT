import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const localizationProductionPlugin: ProductPlugin = {
  pluginId: "localization-production", pluginVersion: 9, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "localization_report_translation", actionId: "report_translation" },
    { productId: "localization_report_translation", actionId: "accuracy_challenge" },
    { productId: "localization_report_translation", actionId: "quality_reflection" },
    { productId: "localization_article_translation", actionId: "article_translation" },
    { productId: "localization_article_translation", actionId: "accuracy_challenge" },
    { productId: "localization_article_translation", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:localization-production:${task.action_id}`);
  },
};
