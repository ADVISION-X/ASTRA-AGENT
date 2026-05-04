import { z } from "zod";

export const EXTERNAL_AI_PROVIDER_IDS = ["openai-compatible"] as const;
export const EXTERNAL_AI_PROVIDER_COMPANIES = ["openai", "deepseek", "openrouter"] as const;

export const ExternalAiProviderIdSchema = z.enum(EXTERNAL_AI_PROVIDER_IDS);
export const ExternalAiProviderCompanySchema = z.enum(EXTERNAL_AI_PROVIDER_COMPANIES);

export const AiExternalProviderConfigSchema = z.object({
  providerId: ExternalAiProviderIdSchema,
  displayName: z.string().min(1).nullable().default(null),
  providerKind: ExternalAiProviderIdSchema.default("openai-compatible"),
  providerCompany: ExternalAiProviderCompanySchema.default("openai"),
  configRef: z.string().min(1),
  secretRef: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  allowPaidProvider: z.boolean().default(true),
  providerAllowlist: z.array(z.literal("paid-analysis-ai")).default(["paid-analysis-ai"]),
  dataPolicy: z.object({ allowExternalTransmission: z.boolean() }).strict().default({ allowExternalTransmission: true }),
  costPolicy: z.object({ maxEstimatedCost: z.number().positive() }).strict().default({ maxEstimatedCost: 5 }),
  operatorApprovalRef: z.string().min(1).nullable().default(null),
  approvalReason: z.string().min(1).nullable().default(null),
  enabled: z.boolean().default(true),
  updatedAt: z.string().datetime(),
}).strict();

export const AiExternalProviderPublicStateSchema = z.object({
  providerId: ExternalAiProviderIdSchema,
  displayName: z.string().min(1).nullable().default(null),
  providerKind: ExternalAiProviderIdSchema.nullable().default(null),
  providerCompany: ExternalAiProviderCompanySchema.nullable().default(null),
  configured: z.boolean(),
  enabled: z.boolean(),
  configRef: z.string().min(1).nullable().default(null),
  secretRef: z.string().min(1).nullable().default(null),
  hasSecret: z.boolean().default(false),
  secretLast4: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  allowPaidProvider: z.boolean().default(false),
  allowExternalTransmission: z.boolean().default(false),
  maxEstimatedCost: z.number().positive().nullable().default(null),
  operatorApprovalRef: z.string().min(1).nullable().default(null),
  missingReason: z.string().min(1).nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
}).strict();

export type AiExternalProviderConfig = z.output<typeof AiExternalProviderConfigSchema>;
export type AiExternalProviderPublicState = z.output<typeof AiExternalProviderPublicStateSchema>;
