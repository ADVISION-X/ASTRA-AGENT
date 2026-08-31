import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const localizationProductionPlugin: ProductPlugin = {
  pluginId: "localization-production", pluginVersion: 11, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "localization_report_translation", actionId: "report_translation" },
    { productId: "localization_report_translation", actionId: "accuracy_challenge" },
    { productId: "localization_report_translation", actionId: "quality_reflection" },
    { productId: "localization_article_translation", actionId: "article_translation" },
    { productId: "localization_article_translation", actionId: "accuracy_challenge" },
    { productId: "localization_article_translation", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
