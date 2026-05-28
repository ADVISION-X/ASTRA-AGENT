import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import type { AiFeedInput, AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import type {
  AmazonKeywordOpportunityManualIngestInput,
  AmazonKeywordOpportunityReviewRecord,
  AmazonKeywordOpportunityVerdict,
  AmazonKeywordProviderKind,
  AmazonKeywordRecord,
} from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import {
  parseKeywordReviewResponse,
  validateKeywordReviewVerdict,
  writeKeywordReviewResponseArtifact,
} from "./amazon-product-mining.keyword-review-support.js";
import {
  buildKeywordFullEvidencePackage,
  type KeywordFullPackageArtifacts,
} from "./amazon-product-mining.keyword-full-package.js";

export const AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS = 900_000;
export const AMAZON_KEYWORD_OPPORTUNITY_REVIEW_PROVIDER_KIND: AmazonKeywordProviderKind = "gpt-web-chat";

const buildKeywordOpportunityReviewInputRefs = (input: {
  keyword: AmazonKeywordRecord;
  artifacts: KeywordFullPackageArtifacts;
}): AiFeedInput["inputRefs"] => input.artifacts.uploadFileRefs.map((ref) => ({
  id: `${ref.id}-${input.keyword.keywordId}`,
  kind: ref.kind,
  summary: ref.summary,
  filePath: ref.filePath,
  mimeType: ref.mimeType,
}));

const buildReviewRecord = (input: {
  reviewId: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  status: AmazonKeywordOpportunityReviewRecord["status"];
  verdict: AmazonKeywordOpportunityVerdict | null;
  artifacts: KeywordFullPackageArtifacts;
  aiPromptText: string;
  aiRawResponse: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}): AmazonKeywordOpportunityReviewRecord => ({
  reviewId: input.reviewId,
  taskId: input.taskId,
  keywordId: input.keyword.keywordId,
  keyword: input.keyword.keyword,
  status: input.status,
  decision: input.verdict?.decision ?? null,
  demandSignal: input.verdict?.demandSignal ?? null,
  reviewHealth: input.verdict?.reviewHealth ?? null,
  priceCeiling: input.verdict?.priceCeiling ?? null,
  competitionOpenness: input.verdict?.competitionOpenness ?? null,
  improvementOpportunity: input.verdict?.improvementOpportunity ?? null,
  dataConfidence: input.verdict?.dataConfidence ?? null,
  evidenceRefs: input.verdict?.evidenceRefs ?? [],
  missingEvidence: input.verdict?.missingEvidence ?? [],
  riskPoints: input.verdict?.riskPoints ?? [],
  humanNextStep: input.verdict?.humanNextStep ?? null,
  aiPromptText: input.aiPromptText,
  aiRawResponse: input.aiRawResponse,
  aiResponseRef: input.artifacts.responsePath,
  packageRef: input.artifacts.packageRootPath,
  keywordPackageSliceRef: input.artifacts.inlineNavigationPath,
  failureReason: input.failureReason,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
});

type KeywordOpportunityReviewRuntimeContext = {
  artifacts: KeywordFullPackageArtifacts;
  aiPromptText: string;
  createdAt: string;
  keyword: AmazonKeywordRecord;
  reviewId: string;
  taskId: string;
};

type KeywordOpportunityReviewAiResult = Awaited<ReturnType<AiInputGatewayAbilityGroup["execute"]>>;

export const persistKeywordOpportunityReview = (input: {
  storage: AmazonMiningStorage;
  review: AmazonKeywordOpportunityReviewRecord;
}): AmazonKeywordOpportunityReviewRecord => input.storage.saveKeywordOpportunityReview(input.review);

const persistKeywordOpportunityReviewOutcome = (input: {
  storage: AmazonMiningStorage;
  context: KeywordOpportunityReviewRuntimeContext;
  status: AmazonKeywordOpportunityReviewRecord["status"];
  verdict: AmazonKeywordOpportunityVerdict | null;
  aiRawResponse: string;
  failureReason: string | null;
}): AmazonKeywordOpportunityReviewRecord => {
  writeKeywordReviewResponseArtifact({
    reviewId: input.context.reviewId,
    status: input.status,
    failureReason: input.failureReason,
    rawResponse: input.aiRawResponse,
    verdict: input.verdict,
    responsePath: input.context.artifacts.responsePath,
  });

  return persistKeywordOpportunityReview({
    storage: input.storage,
    review: buildReviewRecord({
      reviewId: input.context.reviewId,
      taskId: input.context.taskId,
      keyword: input.context.keyword,
      status: input.status,
      verdict: input.verdict,
      artifacts: input.context.artifacts,
      aiPromptText: input.context.aiPromptText,
      aiRawResponse: input.aiRawResponse,
      failureReason: input.failureReason,
      createdAt: input.context.createdAt,
      updatedAt: null,
    }),
  });
};

const requestKeywordOpportunityReview = (input: {
  aiInputGateway: AiInputGatewayAbilityGroup;
  context: KeywordOpportunityReviewRuntimeContext;
}) => input.aiInputGateway.execute({
  providerKind: AMAZON_KEYWORD_OPPORTUNITY_REVIEW_PROVIDER_KIND,
  promptPackageId: `amazon-mining-keyword-review-${input.context.taskId}-${input.context.keyword.keywordId}`,
  promptContractId: "amazon-product-mining-keyword-opportunity-review-v1",
  expectedOutputSchemaRef: null,
  textPrompt: input.context.aiPromptText,
  inputRefs: buildKeywordOpportunityReviewInputRefs({
    keyword: input.context.keyword,
    artifacts: input.context.artifacts,
  }),
  modelName: null,
  timeoutMs: 120_000,
  maxInputChars: AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS,
  maxFileCount: input.context.artifacts.uploadFileRefs.length,
  maxFileBytes: 200_000_000,
  requestedBy: "ai-capability",
  missionId: input.context.taskId,
  runId: input.context.reviewId,
  roundId: input.context.keyword.keywordId,
});

const providerProofContainsKeywordPackageFiles = (input: {
  context: KeywordOpportunityReviewRuntimeContext;
  aiResult: KeywordOpportunityReviewAiResult;
}): boolean => {
  const expectedInputRefIds = new Set(buildKeywordOpportunityReviewInputRefs({
    keyword: input.context.keyword,
    artifacts: input.context.artifacts,
  }).map((ref) => ref.id));
  const actualInputRefIds = new Set(input.aiResult.providerProof.inputRefs);
  return expectedInputRefIds.size > 0 && [...expectedInputRefIds].every((id) => actualInputRefIds.has(id));
};

const finalizeKeywordOpportunityReview = (input: {
  storage: AmazonMiningStorage;
  context: KeywordOpportunityReviewRuntimeContext;
  aiResult: KeywordOpportunityReviewAiResult;
}): AmazonKeywordOpportunityReviewRecord => {
  const aiRawResponse = input.aiResult.normalizedText ?? "";
  if (input.aiResult.status === "review_required") {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "manual_required",
      failureReason: input.aiResult.reviewRequiredReason ?? "keyword_review_manual_required",
      verdict: null,
      aiRawResponse,
    });
  }

  if (input.aiResult.status !== "success") {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "failed",
      failureReason: input.aiResult.failureReason ?? "keyword_review_ai_failed",
      verdict: null,
      aiRawResponse,
    });
  }

  if (!providerProofContainsKeywordPackageFiles(input)) {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "manual_required",
      failureReason: "keyword_full_package_files_not_confirmed_by_provider_proof",
      verdict: null,
      aiRawResponse,
    });
  }

  const verdict = parseKeywordReviewResponse(aiRawResponse);
  if (!verdict) {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context: input.context,
      status: "failed",
      failureReason: "keyword_review_invalid_or_non_json_response",
      verdict: null,
      aiRawResponse,
    });
  }

  return persistKeywordOpportunityReviewOutcome({
    storage: input.storage,
    context: input.context,
    status: "completed",
    failureReason: null,
    verdict,
    aiRawResponse,
  });
};

export const runKeywordOpportunityReview = async (input: {
  dataDir: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  storage: AmazonMiningStorage;
  aiInputGateway: AiInputGatewayAbilityGroup;
}): Promise<AmazonKeywordOpportunityReviewRecord> => {
  const artifacts = buildKeywordFullEvidencePackage({
    dataDir: input.dataDir,
    taskId: input.taskId,
    keyword: input.keyword,
    storage: input.storage,
  });
  const aiPromptText = readFileSync(artifacts.promptPath, "utf8");

  const context: KeywordOpportunityReviewRuntimeContext = {
    artifacts,
    aiPromptText,
    createdAt: new Date().toISOString(),
    keyword: input.keyword,
    reviewId: randomUUID(),
    taskId: input.taskId,
  };

  if (artifacts.integrityStatus !== "pass") {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context,
      status: "manual_required",
      failureReason: "keyword_full_package_integrity_failed",
      verdict: null,
      aiRawResponse: "",
    });
  }

  if (artifacts.uploadFileRefs.length === 0) {
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context,
      status: "manual_required",
      failureReason: "keyword_full_package_upload_unavailable",
      verdict: null,
      aiRawResponse: "",
    });
  }

  try {
    const aiResult = await requestKeywordOpportunityReview({
      aiInputGateway: input.aiInputGateway,
      context,
    });
    return finalizeKeywordOpportunityReview({
      storage: input.storage,
      context,
      aiResult,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    return persistKeywordOpportunityReviewOutcome({
      storage: input.storage,
      context,
      status: "failed",
      failureReason,
      verdict: null,
      aiRawResponse: "",
    });
  }
};

export const ingestManualKeywordOpportunityReview = (input: {
  dataDir: string;
  storage: AmazonMiningStorage;
  rawInput: unknown;
}): AmazonKeywordOpportunityReviewRecord => {
  const manualInput = AmazonMiningSchemas.AmazonKeywordOpportunityManualIngestSchema.parse(input.rawInput) as AmazonKeywordOpportunityManualIngestInput;
  const existing = input.storage.getKeywordOpportunityReview(manualInput.reviewId);
  if (!existing) {
    throw new Error("keyword_review_not_found");
  }
  const { reviewId: _reviewId, aiRawResponse: manualRawResponse, ...verdictInput } = manualInput;
  const verdict = validateKeywordReviewVerdict(verdictInput);
  const responsePath = existing.aiResponseRef;
  if (!responsePath) {
    throw new Error("manual_keyword_review_response_ref_missing");
  }
  const aiRawResponse = manualRawResponse ?? JSON.stringify(verdict, null, 2);
  const updatedAt = new Date().toISOString();
  writeKeywordReviewResponseArtifact({
    reviewId: existing.reviewId,
    status: "completed",
    failureReason: null,
    rawResponse: aiRawResponse,
    verdict,
    responsePath,
  });
  return persistKeywordOpportunityReview({
    storage: input.storage,
    review: {
      ...existing,
      status: "completed",
      decision: verdict.decision,
      demandSignal: verdict.demandSignal,
      reviewHealth: verdict.reviewHealth,
      priceCeiling: verdict.priceCeiling,
      competitionOpenness: verdict.competitionOpenness,
      improvementOpportunity: verdict.improvementOpportunity,
      dataConfidence: verdict.dataConfidence,
      evidenceRefs: verdict.evidenceRefs,
      missingEvidence: verdict.missingEvidence,
      riskPoints: verdict.riskPoints,
      humanNextStep: verdict.humanNextStep,
      aiRawResponse,
      aiResponseRef: responsePath,
      failureReason: null,
      updatedAt,
    },
  });
};
