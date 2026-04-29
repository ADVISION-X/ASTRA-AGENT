import { CaptureBrowserViewportPlanSchema } from "./schema.js";
import type { CaptureBrowserViewportChildCapability } from "./contract.js";

export const captureBrowserViewportChildCapability: CaptureBrowserViewportChildCapability = {
  childCapabilityId: "capture-browser-viewport",
  async execute({ request }) {
    return CaptureBrowserViewportPlanSchema.parse({
      kind: "capture",
      operation: "browser-viewport",
      regionLabel: request.purpose,
      contentLines: request.contentLines,
    });
  },
};
