import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const namingBaziAnalysisAndNamingPlugin: ProductPlugin = {
  pluginId: "naming-bazi-analysis-and-naming", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_bazi_analysis_and_naming", actionId: "produce" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "accuracy_challenge" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
