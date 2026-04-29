import type { AiChildCapability } from "../../contract.js";
import { executeAiChild } from "../../runtime/ai-executor.js";
import { PaidVisionAiChildContract as contract } from "./contract.js";
import { PaidVisionAiChildInputSchema, PaidVisionAiChildReadinessSchema, PaidVisionAiChildResultSchema } from "./schema.js";

export function createPaidVisionAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute(input, context) {
        return PaidVisionAiChildResultSchema.parse(await executeAiChild({
          request: PaidVisionAiChildInputSchema.parse(input),
          childContract: contract,
          context,
        }));
      },
      async checkReadiness() {
        return PaidVisionAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "paid-vision-ai",
          providerKind: "paid",
          status: "disabled_by_policy",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: "paid vision provider is declared but disabled by policy.",
          enabledByPolicy: false,
        });
      },
    },
  };
}
