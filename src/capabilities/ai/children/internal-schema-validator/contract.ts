import type { z } from "zod";

import type { AiChildContract } from "../../contract.js";
import { AI_ABILITY_GROUP_ID } from "../../contract.js";
import { InternalSchemaValidatorChildExecutionPolicySchema, InternalSchemaValidatorChildInputSchema, InternalSchemaValidatorChildResultSchema } from "./schema.js";

export const INTERNAL_SCHEMA_VALIDATOR_CHILD_ID = "internal-schema-validator";
export const INTERNAL_SCHEMA_VALIDATOR_SUPPORTED_TASK_TYPES = ["schema_validation_only"] as const;
export const InternalSchemaValidatorChildExecutionPolicy = InternalSchemaValidatorChildExecutionPolicySchema.parse({
  providerKind: "internal",
  allowedTaskTypes: [...INTERNAL_SCHEMA_VALIDATOR_SUPPORTED_TASK_TYPES],
  requiresLocalRuntime: false,
  forbidsLocalAiGateway: true,
  forbidsPlatformActions: true,
});
export const InternalSchemaValidatorChildContract: AiChildContract = {
  abilityGroupId: AI_ABILITY_GROUP_ID,
  childCapabilityId: INTERNAL_SCHEMA_VALIDATOR_CHILD_ID,
  providerKind: "internal",
  supportedTaskTypes: INTERNAL_SCHEMA_VALIDATOR_SUPPORTED_TASK_TYPES,
  modelRole: "schemaValidator",
  runtimeOwner: "ai-executor",
  implementationStatus: "internal_validator",
  purpose: "Run schema_validation_only through the internal schema gate, not LocalAiGateway.",
};
export type InternalSchemaValidatorInput = z.output<typeof InternalSchemaValidatorChildInputSchema>;
export type InternalSchemaValidatorResult = z.output<typeof InternalSchemaValidatorChildResultSchema>;
