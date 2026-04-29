import { CaptureDesktopScreenPlanSchema } from "./schema.js";
import type { CaptureDesktopScreenChildCapability } from "./contract.js";

export const captureDesktopScreenChildCapability: CaptureDesktopScreenChildCapability = {
  childCapabilityId: "capture-desktop-screen",
  async execute({ request }) {
    return CaptureDesktopScreenPlanSchema.parse({
      kind: "capture",
      operation: "desktop-screen",
      screenId: request.source.screenId ?? "primary",
    });
  },
};
