import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const namingBaziAnalysisAndNamingPlugin: ProductPlugin = {
  pluginId: "naming-bazi-analysis-and-naming", pluginVersion: 8,
  accepts: [
    { productId: "naming_bazi_analysis_and_naming", actionId: "produce" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "accuracy_challenge" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
