import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const hehunAiAnalysisPlugin: ProductPlugin = {
  pluginId: "hehun-ai-analysis",
  accepts: [
    { productId: "hehun_ai_analysis", actionId: "produce" },
    { productId: "hehun_ai_analysis", actionId: "accuracy_challenge" },
    { productId: "hehun_ai_analysis", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
