import type { AiChildCapability } from "../../contract.js";
import { executeAiChild } from "../../runtime/ai-executor.js";
import { LocalOcrAiChildContract as contract } from "./contract.js";
import { LocalOcrAiChildInputSchema, LocalOcrAiChildReadinessSchema, LocalOcrAiChildResultSchema } from "./schema.js";

export function createLocalOcrAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute(input, context) {
        return LocalOcrAiChildResultSchema.parse(await executeAiChild({
          request: LocalOcrAiChildInputSchema.parse(input),
          childContract: contract,
          context,
        }));
      },
      async checkReadiness(context) {
        const health = await context.runtime.getRuntimeHealth();
        return LocalOcrAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "local-ocr-ai",
          providerKind: "local",
          status: health.dependencies.ocr === "ready" ? "ready" : "unavailable",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: `ocr=${health.dependencies.ocr}`,
          enabledByPolicy: true,
        });
      },
    },
  };
}
