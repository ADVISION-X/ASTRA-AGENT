import { PrepareAiInputPlanSchema } from "./schema.js";
import type { PrepareAiInputChildCapability } from "./contract.js";

export const prepareAiInputChildCapability: PrepareAiInputChildCapability = {
  childCapabilityId: "prepare-ai-input",
  async execute({ request, context }) {
    return PrepareAiInputPlanSchema.parse({
      kind: "image-processing",
      operation: "prepare-ai-input",
      sourceFilePath: request.source.sourceStorageRef,
      sourceProof: request.source.sourceProof,
      region: request.region,
      maxAiWidth: request.maxAiWidth ?? context.defaultAiMaxWidth,
    });
  },
};
