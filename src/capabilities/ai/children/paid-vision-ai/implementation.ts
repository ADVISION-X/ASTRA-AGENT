import type { AiChildCapability } from "../../contract.js";
import { PaidVisionAiChildContract as contract } from "./contract.js";
import { PaidVisionAiChildReadinessSchema } from "./schema.js";

export function createPaidVisionAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
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
