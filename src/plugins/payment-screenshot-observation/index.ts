import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation", pluginVersion: 6, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
    { productId: "payment_screenshot_observation", actionId: "accuracy_challenge" },
    { productId: "payment_screenshot_observation", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:payment-screenshot-observation:${task.action_id}`);
  },
};
