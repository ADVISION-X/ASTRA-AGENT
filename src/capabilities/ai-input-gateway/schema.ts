import { z } from "zod";

export const AI_INPUT_GATEWAY_ABILITY_GROUP_ID = "ai-input-gateway" as const;

const AiInputGatewayProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const AiInputGatewayChildCapabilityIdSchema = z.enum([
  "attach-approved-web-chat-files-once",
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
  fileName: z.string().min(1).optional(),
  sha256: z.string().regex(/^(?:sha256:)?[a-f0-9]{64}$/iu).optional(),
  byteCount: z.number().int().nonnegative().optional(),
  uploadStatus: z.enum(["pending", "uploading", "completed", "failed"]).optional(),
}).strict();

const AiFeedProviderContinuationRefSchema = z.object({
  priorTaskId: z.string().min(1),
  priorRawOutputHash: z.string().min(1),
  providerPageUrl: z.string().url(),
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
  providerContinuationRef: AiFeedProviderContinuationRefSchema.optional(),
}).strict();

const AiFeedProviderProofIdentitySchema = z.object({
  providerKind: AiInputGatewayProviderKindSchema,
  providerLeaseId: z.string().min(1).nullable().optional(),
  modelName: z.string().min(1).nullable(),
  inputHash: z.string().min(1),
  outputHash: z.string().min(1).nullable(),
  inputRefs: z.array(z.string().min(1)).default([]),
  uploadedFileRefs: z.array(z.string().min(1)).optional(),
  uploadedFiles: z.array(z.object({
    inputRefId: z.string().min(1),
    step: z.number().int().positive(),
    expectedAttachmentCount: z.number().int().positive(),
    detectedAttachmentCount: z.number().int().positive(),
    fileName: z.string().min(1),
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    byteCount: z.number().int().nonnegative(),
  }).strict()).optional(),
  attachmentUploadProof: z.object({
    childCapabilityId: z.literal("attach-approved-web-chat-files-once"),
    uploadAttemptId: z.string().min(1),
    transportKind: z.enum(["skipped", "ordered_clipboard", "native_picker_batch"]),
    expectedFileCount: z.number().int().nonnegative(),
    detectedFileCount: z.number().int().nonnegative(),
    stagingManifestHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).nullable(),
    files: z.array(z.object({
      inputRefId: z.string().min(1),
      order: z.number().int().positive(),
      sourceFileName: z.string().min(1),
      displayFileName: z.string().min(1),
      sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
      byteCount: z.number().int().nonnegative(),
    }).strict()),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    status: z.enum(["skipped", "attachments_stable", "failed", "review_required"]),
    failureReason: z.string().min(1).nullable(),
    reviewRequiredReason: z.string().min(1).nullable(),
  }).strict().optional(),
  outputRefs: z.array(z.string().min(1)).default([]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  transport: AiFeedTransportSchema,
}).strict();

const AiFeedProviderProofConversationSchema = z.object({
  webChatUrl: z.string().url().nullable().default(null),
  continuationPriorTaskId: z.string().min(1).nullable().optional(),
  continuationPriorRawOutputHash: z.string().min(1).nullable().optional(),
  continuationRequestedUrl: z.string().url().nullable().optional(),
  continuationActualUrl: z.string().url().nullable().optional(),
  continuationVerified: z.boolean().nullable().optional(),
  webChatWorkspaceId: z.string().min(1).nullable().optional(),
  providerTabPolicy: z.string().min(1).nullable().optional(),
  providerRecoveryAttemptCount: z.number().int().nonnegative().nullable().optional(),
  providerRecoveryStatus: z.string().min(1).nullable().optional(),
  staleConversationCleanupStatus: z.string().min(1).nullable().optional(),
  staleConversationHistoryCleanupStatus: z.string().min(1).nullable().optional(),
  sourcePageUrlBeforeFeed: z.string().min(1).nullable().default(null),
  restoredSourcePage: z.boolean().nullable().default(null),
}).strict();

const AiFeedProviderProofRuntimeSchema = z.object({
  transportWarnings: z.array(z.string().min(1)).optional(),
  retryCount: z.number().int().nonnegative().default(0),
  cooldownMs: z.number().int().nonnegative().default(0),
  estimatedInputTokens: z.number().int().nonnegative().nullable().default(null),
  estimatedOutputTokens: z.number().int().nonnegative().nullable().default(null),
  tokenEstimateUnavailableReason: z.string().min(1).nullable().default(null),
}).strict();

const AiFeedProviderProofSchema = z.object({
  ...AiFeedProviderProofIdentitySchema.shape,
  ...AiFeedProviderProofConversationSchema.shape,
  ...AiFeedProviderProofRuntimeSchema.shape,
}).strict();

export const AiFeedResultSchema = z.object({
  abilityGroupId: z.literal(AI_INPUT_GATEWAY_ABILITY_GROUP_ID),
  childCapabilityId: AiInputGatewayChildCapabilityIdSchema,
  providerKind: AiInputGatewayProviderKindSchema,
  status: AiFeedStatusSchema,
  rawResponseText: z.string().nullable().optional(),
  transportWarnings: z.array(z.string().min(1)).optional(),
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
export type AiFeedInput = z.infer<typeof AiFeedInputSchema>;
export type AiFeedProviderProof = z.infer<typeof AiFeedProviderProofSchema>;
export type AiFeedResult = z.infer<typeof AiFeedResultSchema>;
