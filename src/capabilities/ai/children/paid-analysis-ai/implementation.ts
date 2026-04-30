import type { AiChildCapability } from "../../contract.js";
import { PaidAnalysisAiChildContract as contract } from "./contract.js";
import { PaidAnalysisAiChildReadinessSchema } from "./schema.js";

export function createPaidAnalysisAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async checkReadiness() {
        return PaidAnalysisAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "paid-analysis-ai",
          providerKind: "paid",
          status: "disabled_by_policy",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: "paid analysis provider is declared but disabled by policy.",
          enabledByPolicy: false,
        });
      },
    },
  };
}
