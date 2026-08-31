import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const qimenProfessionalAnswerPlugin: ProductPlugin = {
  pluginId: "qimen-professional-answer", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "qimen_professional_answer", actionId: "produce" },
    { productId: "qimen_professional_answer", actionId: "accuracy_challenge" },
    { productId: "qimen_professional_answer", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
