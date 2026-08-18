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

export const AiTaskLabelKeySchema = z.enum([
  "seo_research",
  "seo_article",
  "hehun_analysis",
  "bazi_analysis",
  "qimen_analysis",
  "naming_analysis",
  "deep_research",
  "amazon_product_mining",
  "full_corpus_analysis",
  "system_acceptance",
  "generic_ai",
]);

const AiTaskIdentitySchema = z.object({
  labelKey: AiTaskLabelKeySchema,
  sourceProject: z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
  taskKind: z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
  sourceTaskId: z.string().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
}).strict();

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
  priorTurnMarker: z.string().min(1).optional(),
}).strict();

const AiFeedProviderForkRefSchema = z.object({
  priorTaskId: z.string().min(1),
  priorRawOutputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  providerPageUrl: z.string().url(),
  checkpointTurnMarker: z.string().min(1),
  checkpointResponseHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  parentConversationScopeRef: z.string().min(1),
}).strict();

export const AiFeedInputSchema = z.object({
  providerKind: AiInputGatewayProviderKindSchema,
  taskIdentity: AiTaskIdentitySchema,
  promptPackageId: z.string().min(1),
  promptContractId: z.string().min(1),
  expectedOutputSchemaRef: z.string().min(1).nullable().default(null),
  expectedOutputKind: z.enum(["text", "generated_image"]).default("text"),
  textPrompt: z.string().min(1),
  inputRefs: z.array(AiFeedInputRefSchema).default([]),
  modelName: z.string().min(1).nullable().default(null),
  timeoutMs: z.number().int().positive().default(180_000),
  maxFileCount: z.number().int().nonnegative().default(3),
  requestedBy: z.enum(["ai-capability", "manual-test", "acceptance-test"]),
  missionId: z.string().min(1).nullable().default(null),
  runId: z.string().min(1).nullable().default(null),
  roundId: z.string().min(1).nullable().default(null),
  conversationScopeRef: z.string().min(1).nullable().optional(),
  providerContinuationRef: AiFeedProviderContinuationRefSchema.optional(),
  providerForkRef: AiFeedProviderForkRefSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.providerContinuationRef && input.providerForkRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "AI_INPUT_GATEWAY_CONVERSATION_PARENT_AMBIGUOUS",
      path: ["providerForkRef"],
    });
  }
  if (input.providerForkRef && !input.conversationScopeRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "AI_INPUT_GATEWAY_FORK_SCOPE_REQUIRED",
      path: ["conversationScopeRef"],
    });
  }
});

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
    transportKind: z.enum(["skipped", "exact_target_file_input_batch"]),
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
  conversationMode: z.enum([
    "fresh",
    "same_conversation",
    "forked_from_checkpoint",
  ]).optional(),
  conversationScopeRef: z.string().min(1).nullable().optional(),
  webChatUrl: z.string().url().nullable().default(null),
  continuationPriorTaskId: z.string().min(1).nullable().optional(),
  continuationPriorRawOutputHash: z.string().min(1).nullable().optional(),
  continuationRequestedUrl: z.string().url().nullable().optional(),
  continuationActualUrl: z.string().url().nullable().optional(),
  continuationVerified: z.boolean().nullable().optional(),
  freshConversationProof: z.object({
    preSubmitUserTurnCount: z.literal(0),
    preSubmitAssistantTurnCount: z.literal(0),
    continuationParent: z.null(),
    forkParent: z.null(),
    firstTurnMarker: z.string().min(1),
    createdConversationUrl: z.string().url(),
    createdByExecutionId: z.string().min(1),
    verifiedAt: z.string().datetime(),
  }).strict().nullable().optional(),
  sameConversationProof: z.object({
    parentConversationUrl: z.string().url(),
    parentRawOutputHash: z.string().min(1),
    actualConversationUrl: z.string().url(),
    priorTurnMarker: z.string().min(1).nullable(),
    newTurnMarker: z.string().min(1),
    continuationVerifiedAt: z.string().datetime(),
  }).strict().nullable().optional(),
  forkedFromCheckpointProof: z.object({
    parentConversationUrl: z.string().url(),
    parentCheckpointTurnMarker: z.string().min(1),
    parentCheckpointResponseHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    forkActionEvidenceRef: z.string().min(1),
    forkActionEvidenceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    childConversationUrl: z.string().url(),
    childInitialHistoryFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    childFirstTurnMarker: z.string().min(1),
    verifiedAt: z.string().datetime(),
  }).strict().nullable().optional(),
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
  outputKind: z.enum(["text", "generated_image"]),
  outputArtifacts: z.array(z.object({
    kind: z.literal("generated_image"),
    artifactRef: z.string().min(1),
    filePath: z.string().min(1),
    mimeType: z.string().min(1),
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    originalSha256: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    providerOutputRef: z.string().min(1),
    byteCount: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict()).max(1).default([]),
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
export type AiTaskLabelKey = z.infer<typeof AiTaskLabelKeySchema>;
export type AiFeedInput = z.infer<typeof AiFeedInputSchema>;
export type AiFeedProviderProof = z.infer<typeof AiFeedProviderProofSchema>;
export type AiFeedResult = z.infer<typeof AiFeedResultSchema>;
