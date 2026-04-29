import { CaptureRegionPlanSchema } from "./schema.js";
import type { CaptureRegionChildCapability } from "./contract.js";

export const captureRegionChildCapability: CaptureRegionChildCapability = {
  childCapabilityId: "capture-region",
  async execute({ request }) {
    return CaptureRegionPlanSchema.parse({
      kind: "image-processing",
      operation: "capture-region",
      sourceFilePath: request.source.sourceStorageRef,
      sourceProof: request.source.sourceProof,
      region: request.region,
    });
  },
};
