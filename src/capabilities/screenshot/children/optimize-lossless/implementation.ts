import { OptimizeLosslessPlanSchema } from "./schema.js";
import type { OptimizeLosslessChildCapability } from "./contract.js";

export const optimizeLosslessChildCapability: OptimizeLosslessChildCapability = {
  childCapabilityId: "optimize-lossless",
  async execute({ request }) {
    return OptimizeLosslessPlanSchema.parse({
      kind: "image-processing",
      operation: "optimize-lossless",
      sourceFilePath: request.source.sourceStorageRef,
      sourceProof: request.source.sourceProof,
    });
  },
};
