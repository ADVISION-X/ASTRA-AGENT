import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const namingCommercialPlugin: ProductPlugin = {
  pluginId: "naming-commercial",
  accepts: [
    { productId: "naming_commercial", actionId: "produce" },
    { productId: "naming_commercial", actionId: "accuracy_challenge" },
    { productId: "naming_commercial", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
