import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
    { productId: "payment_screenshot_observation", actionId: "accuracy_challenge" },
    { productId: "payment_screenshot_observation", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
