import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation", pluginVersion: 7, checkpointSchemaVersion: 2,
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
    { productId: "payment_screenshot_observation", actionId: "accuracy_challenge" },
    { productId: "payment_screenshot_observation", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
