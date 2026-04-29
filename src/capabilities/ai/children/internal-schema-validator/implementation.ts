import type { AiChildCapability } from "../../contract.js";
import { executeAiChild } from "../../runtime/ai-executor.js";
import { InternalSchemaValidatorChildContract as contract } from "./contract.js";
import { InternalSchemaValidatorChildInputSchema, InternalSchemaValidatorChildReadinessSchema, InternalSchemaValidatorChildResultSchema } from "./schema.js";

export function createInternalSchemaValidatorCapability(): AiChildCapability {
  return {
    contract,
    implementation: {
      async execute(input, context) {
        return InternalSchemaValidatorChildResultSchema.parse(await executeAiChild({
          request: InternalSchemaValidatorChildInputSchema.parse(input),
          childContract: contract,
          context,
        }));
      },
      async checkReadiness() {
        return InternalSchemaValidatorChildReadinessSchema.parse({
          abilityGroupId: "ai",
          childCapabilityId: "internal-schema-validator",
          providerKind: "internal",
          status: "ready",
          supportedTaskTypes: [...contract.supportedTaskTypes],
          detail: "internal schema validation is ready and does not enter LocalAiGateway.",
          enabledByPolicy: true,
        });
      },
    },
  };
}
