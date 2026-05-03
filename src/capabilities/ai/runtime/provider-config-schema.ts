import { z } from "zod";

export const EXTERNAL_AI_PROVIDER_IDS = ["openai-compatible"] as const;

export const ExternalAiProviderIdSchema = z.enum(EXTERNAL_AI_PROVIDER_IDS);

export const AiExternalProviderConfigSchema = z.object({
  providerId: ExternalAiProviderIdSchema,
  configRef: z.string().min(1),
  secretRef: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  enabled: z.boolean().default(true),
  updatedAt: z.string().datetime(),
}).strict();

export const AiExternalProviderPublicStateSchema = z.object({
  providerId: ExternalAiProviderIdSchema,
  configured: z.boolean(),
  enabled: z.boolean(),
  configRef: z.string().min(1).nullable().default(null),
  secretRef: z.string().min(1).nullable().default(null),
  baseUrl: z.string().min(1).nullable().default(null),
  model: z.string().min(1).nullable().default(null),
  maskedApiKey: z.string().min(1).nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
}).strict();

export type AiExternalProviderConfig = z.output<typeof AiExternalProviderConfigSchema>;
export type AiExternalProviderPublicState = z.output<typeof AiExternalProviderPublicStateSchema>;
