import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const baziChartInterpretationPlugin: ProductPlugin = {
  pluginId: "bazi-chart-interpretation", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_chart_interpretation", actionId: "produce" },
    { productId: "bazi_chart_interpretation", actionId: "accuracy_challenge" },
    { productId: "bazi_chart_interpretation", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
