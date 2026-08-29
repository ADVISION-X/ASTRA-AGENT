import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const namingFromExistingBaziReportPlugin: ProductPlugin = {
  pluginId: "naming-from-existing-bazi-report", pluginVersion: 6, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_from_existing_bazi_report", actionId: "produce" },
    { productId: "naming_from_existing_bazi_report", actionId: "accuracy_challenge" },
    { productId: "naming_from_existing_bazi_report", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:naming-from-existing-bazi-report:${task.action_id}`);
  },
};
