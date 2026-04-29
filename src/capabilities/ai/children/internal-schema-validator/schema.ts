import { z } from "zod";

import { AiChildReadinessSchema, InternalSchemaValidatorInputSchema, InternalSchemaValidatorResultSchema } from "../../schema.js";

export const InternalSchemaValidatorChildInputSchema = InternalSchemaValidatorInputSchema.describe("internal-schema-validator child input");
export const InternalSchemaValidatorChildResultSchema = InternalSchemaValidatorResultSchema.describe("internal-schema-validator child result");
export const InternalSchemaValidatorChildExecutionPolicySchema = z.object({
  providerKind: z.literal("internal"),
  allowedTaskTypes: z.tuple([z.literal("schema_validation_only")]),
  requiresLocalRuntime: z.literal(false),
  forbidsLocalAiGateway: z.literal(true),
  forbidsPlatformActions: z.literal(true),
}).strict();
export const InternalSchemaValidatorChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("internal-schema-validator"),
  providerKind: z.literal("internal"),
}).strict();

export type InternalSchemaValidatorInput = z.output<typeof InternalSchemaValidatorChildInputSchema>;
export type InternalSchemaValidatorResult = z.output<typeof InternalSchemaValidatorChildResultSchema>;
