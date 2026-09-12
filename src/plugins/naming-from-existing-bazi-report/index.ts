import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const namingFromExistingBaziReportPlugin: ProductPlugin = {
  pluginId: "naming-from-existing-bazi-report",
  accepts: [
    { productId: "naming_from_existing_bazi_report", actionId: "produce" },
    { productId: "naming_from_existing_bazi_report", actionId: "accuracy_challenge" },
    { productId: "naming_from_existing_bazi_report", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
