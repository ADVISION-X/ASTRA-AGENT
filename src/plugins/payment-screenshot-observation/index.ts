import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation",
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
  ],
  execute: executeOwnedFlow,
};
