import type { AiChildCapability } from "../../contract.js";
import { FutureApiAiChildContract as contract } from "./contract.js";
import { FutureApiAiChildReadinessSchema } from "./schema.js";

export function createFutureApiAiCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute() {
        return Promise.reject(new Error("mutated future execute"));
      },
      async checkReadiness() {
        return FutureApiAiChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "future-api-ai",
          providerKind: "future",
          status: "disabled_by_policy",
          supportedTaskTypes: [],
          detail: "future api provider is non-executable until law unfreezes.",
          enabledByPolicy: false,
        });
      },
    },
  };
}
