import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const baziChartInterpretationPlugin: ProductPlugin = {
  pluginId: "bazi-chart-interpretation",
  accepts: [
    { productId: "bazi_chart_interpretation", actionId: "produce" },
    { productId: "bazi_chart_interpretation", actionId: "accuracy_challenge" },
    { productId: "bazi_chart_interpretation", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
