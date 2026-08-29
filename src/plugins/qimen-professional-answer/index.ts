import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const qimenProfessionalAnswerPlugin: ProductPlugin = {
  pluginId: "qimen-professional-answer", pluginVersion: 6, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "qimen_professional_answer", actionId: "produce" },
    { productId: "qimen_professional_answer", actionId: "accuracy_challenge" },
    { productId: "qimen_professional_answer", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:qimen-professional-answer:${task.action_id}`);
  },
};
