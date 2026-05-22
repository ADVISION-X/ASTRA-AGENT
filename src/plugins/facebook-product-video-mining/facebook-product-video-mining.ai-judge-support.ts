import { createHash } from "node:crypto";

import type { AiFeedInput, AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";

import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

const COMMENT_SAMPLE_LIMIT = 8;

export const FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID = "facebook-product-video-mining.video-judge.v1";

export const buildAiHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);

const buildProviderProof = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  result: AiFeedResult;
}) => ({
  providerKind: input.providerKind,
  webChatUrl: input.result.providerProof.webChatUrl,
  sourcePageUrlBeforeFeed: input.result.providerProof.sourcePageUrlBeforeFeed,
  restoredSourcePage: input.result.providerProof.restoredSourcePage,
  startedAt: input.result.providerProof.startedAt,
  endedAt: input.result.providerProof.endedAt,
  durationMs: input.result.providerProof.durationMs,
  inputHash: input.result.providerProof.inputHash,
  outputHash: input.result.providerProof.outputHash,
});

const buildVideoInputRef = (input: {
  roundId: string;
  videoFilePath: string;
}) => ({
  id: `${input.roundId}_video`,
  kind: "video/mp4" as const,
  summary: "staging Facebook video artifact for product-seeding judgment",
  filePath: input.videoFilePath,
  mimeType: "video/mp4" as const,
  uploadStatus: "pending" as const,
});

export const buildPrompt = (input: {
  probe: FacebookVideoDomProbeResult;
  comments: readonly FacebookCommentRecord[];
}): string => {
  const commentSummary = input.comments
    .slice(0, COMMENT_SAMPLE_LIMIT)
    .map((comment, index) => `${index + 1}. ${comment.authorDisplayText ?? "anonymous"}: ${comment.commentText}`)
    .join("\n");
  return [
    "You are judging whether an uploaded Facebook video is a product-seeding / product recommendation video.",
    "Return JSON only. Do not wrap the JSON in markdown.",
    "Required JSON shape:",
    '{"selectedOptionId":"PRODUCT_SEEDING | NOT_PRODUCT_SEEDING | UNCERTAIN","confidence":0.0,"visibleProduct":"","productCategory":"","sellingIntentSignals":[],"evidenceFromVideo":[],"reason":""}',
    "Decision rules:",
    "PRODUCT_SEEDING: the video clearly demonstrates, recommends, reviews, unboxes, compares, or intentionally sells a purchasable product.",
    "NOT_PRODUCT_SEEDING: pure entertainment, news, story, vlog, or people content without clear product-selling intent.",
    "UNCERTAIN: a product may appear but the selling intent is unclear, or the video is too ambiguous.",
    `Page title: ${input.probe.pageTitle}`,
    `Caption text: ${input.probe.captionText ?? ""}`,
    `Author text: ${input.probe.authorText ?? ""}`,
    `Displayed like count: ${input.probe.likeCount ?? "unknown"}`,
    `Displayed comment count: ${input.probe.commentCountDisplayed ?? "unknown"}`,
    commentSummary ? `Comment samples:\n${commentSummary}` : "No comments were loaded from the authorized page.",
  ].join("\n\n");
};

const normalizeAiJson = (value: unknown): Omit<FacebookVideoAiJudgment, "providerKind" | "status" | "rawOutputRef" | "rawOutputHash" | "normalizedText" | "parseStatus" | "schemaValidationStatus" | "providerProof" | "createdAt"> => {
  const objectValue = value as Record<string, unknown>;
  return {
    selectedOptionId: String(objectValue.selectedOptionId ?? "UNCERTAIN") as FacebookVideoAiJudgment["selectedOptionId"],
    confidence: typeof objectValue.confidence === "number" ? objectValue.confidence : 0,
    visibleProduct: typeof objectValue.visibleProduct === "string" ? objectValue.visibleProduct : null,
    productCategory: typeof objectValue.productCategory === "string" ? objectValue.productCategory : null,
    sellingIntentSignals: Array.isArray(objectValue.sellingIntentSignals) ? objectValue.sellingIntentSignals.map(String) : [],
    evidenceFromVideo: Array.isArray(objectValue.evidenceFromVideo) ? objectValue.evidenceFromVideo.map(String) : [],
    reason: typeof objectValue.reason === "string" && objectValue.reason.trim().length > 0
      ? objectValue.reason.trim()
      : "AI judgment did not provide a reason.",
  };
};

const judgmentFromFeed = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  result: AiFeedResult;
}): FacebookVideoAiJudgment => FacebookProductVideoMiningSchemas.FacebookVideoAiJudgmentSchema.parse({
  providerKind: input.providerKind,
  status: input.result.status,
  ...normalizeAiJson(input.result.parsedJson ?? {}),
  rawOutputRef: input.result.rawOutputRef,
  rawOutputHash: input.result.rawOutputHash,
  normalizedText: input.result.normalizedText,
  parseStatus: input.result.parseStatus,
  schemaValidationStatus: input.result.schemaValidationStatus,
  providerProof: buildProviderProof(input),
  createdAt: new Date().toISOString(),
});

const buildFailedAiJudgment = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  result: AiFeedResult;
}): FacebookVideoAiJudgment => FacebookProductVideoMiningSchemas.FacebookVideoAiJudgmentSchema.parse({
  providerKind: input.providerKind,
  status: input.result.status === "review_required" ? "review_required" : "failed",
  selectedOptionId: "UNCERTAIN",
  confidence: 0,
  visibleProduct: null,
  productCategory: null,
  sellingIntentSignals: [],
  evidenceFromVideo: [],
  reason: input.result.reviewRequiredReason ?? input.result.failureReason ?? "AI feed did not return valid JSON.",
  rawOutputRef: input.result.rawOutputRef,
  rawOutputHash: input.result.rawOutputHash,
  normalizedText: input.result.normalizedText,
  parseStatus: input.result.parseStatus,
  schemaValidationStatus: input.result.schemaValidationStatus,
  providerProof: buildProviderProof(input),
  createdAt: new Date().toISOString(),
});

export const buildAiFeedRequest = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  modelName?: string | null;
  missionId: string;
  runId: string;
  roundId: string;
  prompt: string;
  videoFilePath: string;
  inputRefs?: AiFeedInput["inputRefs"];
  timeoutMs: number;
  maxFileBytes: number;
}): AiFeedInput => ({
  providerKind: input.providerKind,
  promptPackageId: FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
  promptContractId: FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
  expectedOutputSchemaRef: FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
  textPrompt: input.prompt,
  inputRefs: input.inputRefs ?? [buildVideoInputRef({ roundId: input.roundId, videoFilePath: input.videoFilePath })],
  modelName: input.modelName ?? null,
  timeoutMs: input.timeoutMs,
  maxInputChars: 30_000,
  maxFileCount: 1,
  maxFileBytes: input.maxFileBytes,
  requestedBy: "ai-capability",
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId,
});

export const resolveFeedJudgment = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  feedResult: AiFeedResult;
}): FacebookVideoAiJudgment => input.feedResult.status !== "success"
    || input.feedResult.parseStatus !== "json_valid"
    || input.feedResult.parsedJson === null
      ? buildFailedAiJudgment({ providerKind: input.providerKind, result: input.feedResult })
      : judgmentFromFeed({ providerKind: input.providerKind, result: input.feedResult });

export const buildUploadStagePayload = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  modelName?: string | null;
  inputRefs: AiFeedInput["inputRefs"];
  expectedOutputSchemaRef: string;
  timeoutMs: number;
  beforeHash: string;
  afterHash: string;
}) => ({
  providerKind: input.providerKind,
  modelName: input.modelName ?? null,
  inputRefs: input.inputRefs,
  expectedOutputSchemaRef: input.expectedOutputSchemaRef,
  timeoutMs: input.timeoutMs,
  recoveryTrail: "facebook-ai-recovery-trail",
  action: "upload_video_to_ai_provider",
  beforeHash: input.beforeHash,
  afterHash: input.afterHash,
});

export const buildResponseStagePayload = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  modelName?: string | null;
  promptHash: string;
  timeoutMs: number;
  beforeHash: string;
  afterHash: string;
}) => ({
  providerKind: input.providerKind,
  modelName: input.modelName ?? null,
  promptHash: input.promptHash,
  timeoutMs: input.timeoutMs,
  recoveryTrail: "facebook-ai-recovery-trail",
  action: "wait_ai_response",
  beforeHash: input.beforeHash,
  afterHash: input.afterHash,
});

export const buildParseStagePayload = (input: {
  providerKind: FacebookVideoAiJudgment["providerKind"];
  modelName?: string | null;
  promptHash: string;
  expectedOutputSchemaRef: string;
  timeoutMs: number;
  beforeHash: string;
  afterHash: string;
}) => ({
  providerKind: input.providerKind,
  modelName: input.modelName ?? null,
  promptHash: input.promptHash,
  expectedOutputSchemaRef: input.expectedOutputSchemaRef,
  timeoutMs: input.timeoutMs,
  recoveryTrail: "facebook-ai-recovery-trail",
  action: "parse_ai_response",
  beforeHash: input.beforeHash,
  afterHash: input.afterHash,
});
