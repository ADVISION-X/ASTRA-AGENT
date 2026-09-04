import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const baziAiFullAnalysisPlugin: ProductPlugin = {
  pluginId: "bazi-ai-full-analysis", pluginVersion: 8, checkpointSchemaVersion: 2,
  accepts: [
    { productId: "bazi_ai_full_analysis", actionId: "produce" },
    { productId: "bazi_ai_full_analysis", actionId: "accuracy_challenge" },
    { productId: "bazi_ai_full_analysis", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
