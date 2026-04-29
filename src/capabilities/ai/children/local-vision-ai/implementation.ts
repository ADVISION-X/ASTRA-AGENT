import type { AiChildCapability } from "../../contract.js";
import { executeAiChild } from "../../runtime/ai-executor.js";
import { LocalVisionAiChildContract as contract } from "./contract.js";
import { LocalVisionAiChildInputSchema, LocalVisionAiChildReadinessSchema, LocalVisionAiChildResultSchema } from "./schema.js";

export function createLocalVisionAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute(input, context) {
        return LocalVisionAiChildResultSchema.parse(await executeAiChild({
          request: LocalVisionAiChildInputSchema.parse(input),
          childContract: contract,
          context,
        }));
      },
      async checkReadiness(context) {
        const health = await context.runtime.getRuntimeHealth();
        return LocalVisionAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "local-vision-ai",
          providerKind: "local",
          status: health.dependencies.vision === "ready" ? "ready" : "unavailable",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: `vision=${health.dependencies.vision}`,
          enabledByPolicy: true,
        });
      },
    },
  };
}
