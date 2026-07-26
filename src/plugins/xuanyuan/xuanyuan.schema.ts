import { z } from "zod";

import type {
  AiFeedResult,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";

export const XUANYUAN_JOB_ID = "xuanyuan" as const;

const XuanyuanInputRefSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  summary: z.string().min(1),
  filePath: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  sha256: z.string().regex(/^(?:sha256:)?[a-f0-9]{64}$/iu).optional(),
  byteCount: z.number().int().nonnegative().optional(),
}).strict();

export const XuanyuanRequestSchema = z.object({
  requestId: z.string().min(1),
  sourceProject: z.string().min(1),
  scenario: z.string().min(1),
  providerKind: z.literal("gpt-web-chat").default("gpt-web-chat"),
  promptPackageId: z.string().min(1),
  promptContractId: z.string().min(1),
  expectedOutputSchemaRef: z.string().min(1).nullable().default(null),
  systemPrompt: z.string().min(1).optional(),
  userPrompt: z.string().min(1).optional(),
  textPrompt: z.string().min(1).optional(),
  payloadJson: z.unknown().optional(),
  inputRefs: z.array(XuanyuanInputRefSchema).default([]),
  timeoutMs: z.number().int().positive().default(180_000),
  maxInputChars: z.number().int().positive().default(120_000),
  maxFileCount: z.number().int().nonnegative().default(0),
  maxFileBytes: z.number().int().positive().default(200_000_000),
  continuationTaskId: z.string().min(1).optional(),
  continuationResponseHash: z.string().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.continuationTaskId) !== Boolean(value.continuationResponseHash)) {
    context.addIssue({ code: "custom", message: "continuationTaskId and continuationResponseHash must be provided together" });
  }
});

export type XuanyuanRequest = z.infer<typeof XuanyuanRequestSchema>;

export type XuanyuanTaskStatus =
  | "accepted"
  | "queued"
  | "running"
  | "response_captured"
  | "review_required"
  | "failed";

export type XuanyuanTaskRecord = {
  taskId: string;
  jobId: typeof XUANYUAN_JOB_ID;
  requestId: string;
  sourceProject: string;
  scenario: string;
  providerKind: "gpt-web-chat";
  status: XuanyuanTaskStatus;
  requestSnapshot: XuanyuanRequest;
  promptPackageSnapshot: {
    promptPackageId: string;
    promptContractId: string;
    expectedOutputSchemaRef: string | null;
    textPrompt: string;
    inputRefs: XuanyuanRequest["inputRefs"];
  };
  aiFeedResult: AiFeedResult | null;
  rawResponseText: string | null;
  rawOutputRef: string | null;
  rawOutputHash: string | null;
  transportWarnings: string[];
  providerProof: AiFeedResult["providerProof"] | null;
  progress: {
    executionId: string;
    phase: "queued" | "running" | "terminal";
    attachmentUploadProof: WebChatAttachmentUploadProof | null;
  };
  continuationTaskId: string | null;
  conversationProof: {
    priorTaskId: string;
    priorRawOutputHash: string;
    requestedProviderPageUrl: string;
    actualProviderPageUrl: string | null;
    verified: boolean;
  } | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  createdAt: string;
  updatedAt: string;
};
