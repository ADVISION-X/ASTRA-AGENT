import { z } from "zod";

export const AI_INPUT_GATEWAY_ABILITY_GROUP_ID = "ai-input-gateway" as const;

const AiInputGatewayProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const AiInputGatewayChildCapabilityIdSchema = z.enum([
  "feed-gemini-api-once",
  "feed-gemini-web-chat-once",
  "feed-gpt-web-chat-once",
]);

const AiFeedStatusSchema = z.enum(["success", "failed", "review_required"]);
const AiFeedParseStatusSchema = z.enum(["json_valid", "json_invalid", "not_requested"]);
const AiFeedSchemaValidationStatusSchema = z.enum(["valid", "invalid", "not_applicable"]);
const AiFeedTransportSchema = z.enum(["api", "web-chat"]);

const AiFeedInputRefSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  summary: z.string().min(1),
  filePath: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  uploadStatus: z.enum(["pending", "uploading", "completed", "failed"]).optional(),
}).strict();

export const AiFeedInputSchema = z.object({
  providerKind: AiInputGatewayProviderKindSchema,
  promptPackageId: z.string().min(1),
  promptContractId: z.string().min(1),
  expectedOutputSchemaRef: z.string().min(1).nullable().default(null),
  textPrompt: z.string().min(1),
  inputRefs: z.array(AiFeedInputRefSchema).default([]),
  modelName: z.string().min(1).nullable().default(null),
  timeoutMs: z.number().int().positive().default(180_000),
  maxInputChars: z.number().int().positive().default(30_000),
  maxFileCount: z.number().int().nonnegative().default(3),
  maxFileBytes: z.number().int().positive().default(200_000_000),
  requestedBy: z.enum(["ai-capability", "manual-test", "acceptance-test"]),
  missionId: z.string().min(1).nullable().default(null),
  runId: z.string().min(1).nullable().default(null),
  roundId: z.string().min(1).nullable().default(null),
}).strict();

const AiFeedProviderProofSchema = z.object({
  providerKind: AiInputGatewayProviderKindSchema,
  modelName: z.string().min(1).nullable(),
  inputHash: z.string().min(1),
  outputHash: z.string().min(1).nullable(),
  inputRefs: z.array(z.string().min(1)).default([]),
  outputRefs: z.array(z.string().min(1)).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  transport: AiFeedTransportSchema,
  webChatUrl: z.string().url().nullable().default(null),
  sourcePageUrlBeforeFeed: z.string().min(1).nullable().default(null),
  restoredSourcePage: z.boolean().nullable().default(null),
  retryCount: z.number().int().nonnegative().default(0),
  cooldownMs: z.number().int().nonnegative().default(0),
  estimatedInputTokens: z.number().int().nonnegative().nullable().default(null),
  estimatedOutputTokens: z.number().int().nonnegative().nullable().default(null),
  tokenEstimateUnavailableReason: z.string().min(1).nullable().default(null),
}).strict();

export const AiFeedResultSchema = z.object({
  abilityGroupId: z.literal(AI_INPUT_GATEWAY_ABILITY_GROUP_ID),
  childCapabilityId: AiInputGatewayChildCapabilityIdSchema,
  providerKind: AiInputGatewayProviderKindSchema,
  status: AiFeedStatusSchema,
  normalizedText: z.string().nullable(),
  rawOutputRef: z.string().min(1).nullable(),
  rawOutputHash: z.string().min(1).nullable(),
  parseStatus: AiFeedParseStatusSchema,
  parsedJson: z.unknown().nullable(),
  schemaValidationStatus: AiFeedSchemaValidationStatusSchema,
  providerProof: AiFeedProviderProofSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

export type AiInputGatewayProviderKind = z.infer<typeof AiInputGatewayProviderKindSchema>;
export type AiInputGatewayChildCapabilityId = z.infer<typeof AiInputGatewayChildCapabilityIdSchema>;
export type AiFeedInputRef = z.infer<typeof AiFeedInputRefSchema>;
export type AiFeedInput = z.infer<typeof AiFeedInputSchema>;
export type AiFeedProviderProof = z.infer<typeof AiFeedProviderProofSchema>;
export type AiFeedResult = z.infer<typeof AiFeedResultSchema>;
export type AiFeedStatus = z.infer<typeof AiFeedStatusSchema>;
