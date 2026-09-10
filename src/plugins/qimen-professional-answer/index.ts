import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const qimenProfessionalAnswerPlugin: ProductPlugin = {
  pluginId: "qimen-professional-answer", pluginVersion: 8,
  accepts: [
    { productId: "qimen_professional_answer", actionId: "produce" },
    { productId: "qimen_professional_answer", actionId: "accuracy_challenge" },
    { productId: "qimen_professional_answer", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
