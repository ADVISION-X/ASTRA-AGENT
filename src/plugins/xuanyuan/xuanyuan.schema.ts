import { z } from "zod";

import type { AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";

export const XUANYUAN_JOB_ID = "xuanyuan" as const;

const XuanyuanInputRefSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  summary: z.string().min(1),
  filePath: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
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
}).strict();

export type XuanyuanRequest = z.infer<typeof XuanyuanRequestSchema>;

export type XuanyuanTaskStatus =
  | "accepted"
  | "running"
  | "provider_answer_captured"
  | "succeeded"
  | "parse_failed_raw_available"
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
  normalizedText: string | null;
  rawOutputRef: string | null;
  rawOutputHash: string | null;
  parseStatus: AiFeedResult["parseStatus"] | null;
  schemaValidationStatus: AiFeedResult["schemaValidationStatus"] | null;
  parsedJson: unknown | null;
  providerProof: AiFeedResult["providerProof"] | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  createdAt: string;
  updatedAt: string;
};
