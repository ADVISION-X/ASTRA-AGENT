import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeZejiFlow } from "./flow.js";

export const zejiPersonalSelectionPlugin: ProductPlugin = {
  pluginId: "zeji-personal-selection",
  accepts: [
    { productId: "zeji_personal_selection", actionId: "produce" },
    { productId: "zeji_personal_selection", actionId: "accuracy_challenge" },
    { productId: "zeji_personal_selection", actionId: "quality_reflection" },
  ],
  execute: executeZejiFlow,
};
