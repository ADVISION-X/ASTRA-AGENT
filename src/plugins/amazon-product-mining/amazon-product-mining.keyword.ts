import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  hasNearDuplicateAmazonKeyword,
  normalizeAmazonKeywordText,
  normalizeAmazonTargetMarketKey,
} from "./amazon-product-mining.keyword-dedup.js";
import type {
  AmazonKeywordHistoryPolicy,
  AmazonKeywordHistoryRelation,
  AmazonKeywordProviderKind,
  AmazonKeywordRecord,
  AmazonMiningInput,
} from "./amazon-product-mining.schema.js";

type KeywordGenerationResult = {
  runs: KeywordGenerationRun[];
  runId: string;
  promptText: string;
  rawResponse: string;
  parsedKeywords: string[];
  dedupedKeywords: string[];
  status: "success" | "failed";
  failureReason: string | null;
};

type KeywordGenerationRun = {
  runId: string;
  promptText: string;
  rawResponse: string;
  parsedKeywords: string[];
  dedupedKeywords: string[];
  status: "success" | "failed";
  failureReason: string | null;
};

export const AMAZON_KEYWORD_GENERATION_NEUTRALITY_POLICY = "The system only supplies marketplace, market, user product direction, deduplication data, and JSON format rules; it must not add product traits or sourcing assumptions.";
export const AMAZON_KEYWORD_GENERATION_CHINA_SUPPLIER_POLICY = "If the user mentions China suppliers, treat it only as sourcing background and do not narrow keywords to small, lightweight, compact, low-volume, or easy-to-ship products unless the user explicitly wrote that constraint.";
export const AMAZON_KEYWORD_GENERATION_FORBIDDEN_SYSTEM_ASSUMPTIONS = [
  "size",
  "weight",
  "small",
  "lightweight",
  "compact",
  "easy-to-ship",
] as const;
export const AMAZON_KEYWORD_GENERATION_INSUFFICIENT_NEW_KEYWORDS_REASON = "keyword_generation_insufficient_new_keywords";
export const AMAZON_KEYWORD_GENERATION_NO_REFRESHABLE_KEYWORDS_REASON = "no_refreshable_historical_keywords";

const buildKeywordPrompt = (input: {
  amazonMarketplace: string;
  targetMarket: string;
  productDirection: string;
  requestedKeywordCount: number;
  languagePreference: string;
  existingMinedKeywords: string[];
  keywordHistoryPolicy: AmazonKeywordHistoryPolicy;
}): string => {
  const targetMarketCanonicalKey = normalizeAmazonTargetMarketKey(input.targetMarket);
  const historyLabel = input.keywordHistoryPolicy === "refresh_historical_keywords"
    ? "Historical keyword refresh pool"
    : "Historical keyword exclusions";
  const existingList = input.existingMinedKeywords.length > 0
    ? `\n\n${historyLabel} for this canonical marketplace/target market (${targetMarketCanonicalKey}); count=${input.existingMinedKeywords.length}:\n${input.existingMinedKeywords.map((k) => `- ${k}`).join("\n")}`
    : `\n\nNo previously mined keywords found for this canonical marketplace/target market (${targetMarketCanonicalKey}).`;
  const historyInstruction = input.keywordHistoryPolicy === "refresh_historical_keywords"
    ? "- This task is historical market refresh mode: you may repeat historical keywords only when they are still relevant to refreshing current Amazon market evidence"
    : "- Must NOT repeat any already-mined keyword";
  const taskInstruction = input.keywordHistoryPolicy === "refresh_historical_keywords"
    ? `Generate exactly ${input.requestedKeywordCount} Amazon search keywords for current market refresh; historical keywords are allowed only for refreshing market evidence.`
    : `Generate exactly ${input.requestedKeywordCount} NEW Amazon search keywords for this product direction.`;

  return `You are helping mine Amazon product search keywords for a specific market opportunity.

Amazon Marketplace: ${input.amazonMarketplace}
Target Market / Customer Segment: ${input.targetMarket}
Product Direction: ${input.productDirection}
Requested Keyword Count: ${input.requestedKeywordCount}
Language Preference: ${input.languagePreference}
Keyword History Policy: ${input.keywordHistoryPolicy}
${existingList}

TASK: ${taskInstruction}

CONSTRAINTS:
${historyInstruction}
- Keywords should be actual Amazon search terms buyers would type
- Do NOT include brand names unless the user's product direction explicitly asks for brand terms
- ${AMAZON_KEYWORD_GENERATION_NEUTRALITY_POLICY}
- ${AMAZON_KEYWORD_GENERATION_CHINA_SUPPLIER_POLICY}
- Do not add or infer these constraints unless they appear in the user's Product Direction: ${AMAZON_KEYWORD_GENERATION_FORBIDDEN_SYSTEM_ASSUMPTIONS.join(", ")}

OUTPUT FORMAT (JSON only, no explanation):
{
  "keywords": [
    { "keyword": "..." },
    ...
  ]
}`;
};

const buildKeywordRefillPrompt = (input: {
  amazonMarketplace: string;
  targetMarket: string;
  productDirection: string;
  requestedKeywordCount: number;
  languagePreference: string;
  existingMinedKeywords: string[];
  acceptedKeywords: string[];
  keywordHistoryPolicy: AmazonKeywordHistoryPolicy;
}): string => buildKeywordPrompt({
  amazonMarketplace: input.amazonMarketplace,
  targetMarket: input.targetMarket,
  productDirection: input.productDirection,
  requestedKeywordCount: input.requestedKeywordCount,
  languagePreference: input.languagePreference,
  existingMinedKeywords: [...input.existingMinedKeywords, ...input.acceptedKeywords],
  keywordHistoryPolicy: input.keywordHistoryPolicy,
});

const parseKeywordsFromResponse = (rawResponse: string): string[] => {
  const jsonMatch = rawResponse.match(/\{[\s\S]*"keywords"[\s\S]*\}/u);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { keywords?: Array<{ keyword?: string }> };
    if (!Array.isArray(parsed.keywords)) return [];
    return parsed.keywords
      .map((item) => (typeof item.keyword === "string" ? item.keyword.trim() : ""))
      .filter((k): k is string => k.length > 0);
  } catch {
    return [];
  }
};

const normalizeKeyword = (keyword: string): string =>
  normalizeAmazonKeywordText(keyword);

export const deduplicateKeywords = (
  candidates: string[],
  existingMinedKeywords: string[],
  currentTaskKeywords: string[],
  keywordHistoryPolicy: AmazonKeywordHistoryPolicy = "new_keywords_only",
): string[] => {
  const existingNormalized = new Set([
    ...existingMinedKeywords.map(normalizeKeyword),
    ...currentTaskKeywords.map(normalizeKeyword),
  ]);
  const result: string[] = [];
  const seenInBatch = new Set<string>();
  const currentTaskNormalized = new Set(currentTaskKeywords.map(normalizeKeyword));
  for (const candidate of candidates) {
    const normalized = normalizeKeyword(candidate);
    if (currentTaskNormalized.has(normalized)) continue;
    if (keywordHistoryPolicy === "new_keywords_only" && existingNormalized.has(normalized)) continue;
    if (seenInBatch.has(normalized)) continue;
    if (keywordHistoryPolicy === "new_keywords_only" && hasNearDuplicateAmazonKeyword(candidate, [...existingMinedKeywords, ...currentTaskKeywords, ...result])) continue;
    seenInBatch.add(normalized);
    result.push(candidate);
  }
  return result;
};

type KeywordGenerationAttemptInput = {
  miningInput: AmazonMiningInput;
  taskId: string;
  existingMinedKeywords: string[];
  currentTaskKeywords: string[];
  requestedKeywordCount: number;
  aiInputGateway: AiInputGatewayAbilityGroup;
  providerKind: AmazonKeywordProviderKind;
};

const buildKeywordGenerationPrompt = (input: KeywordGenerationAttemptInput): string =>
  input.currentTaskKeywords.length > 0
    ? buildKeywordRefillPrompt({
        amazonMarketplace: input.miningInput.amazonMarketplace,
        targetMarket: input.miningInput.targetMarket,
        productDirection: input.miningInput.productDirection,
        requestedKeywordCount: input.requestedKeywordCount,
        languagePreference: input.miningInput.languagePreference,
        existingMinedKeywords: input.existingMinedKeywords,
        acceptedKeywords: input.currentTaskKeywords,
        keywordHistoryPolicy: input.miningInput.keywordHistoryPolicy,
      })
    : buildKeywordPrompt({
        amazonMarketplace: input.miningInput.amazonMarketplace,
        targetMarket: input.miningInput.targetMarket,
        productDirection: input.miningInput.productDirection,
        requestedKeywordCount: input.requestedKeywordCount,
        languagePreference: input.miningInput.languagePreference,
        existingMinedKeywords: input.existingMinedKeywords,
        keywordHistoryPolicy: input.miningInput.keywordHistoryPolicy,
      });

const runKeywordGenerationAttempt = async (input: KeywordGenerationAttemptInput): Promise<KeywordGenerationRun> => {
  const runId = randomUUID();
  const promptText = buildKeywordGenerationPrompt(input);

  let rawResponse = "";
  try {
    const result = await input.aiInputGateway.execute({
      providerKind: input.providerKind,
      taskIdentity: {
        labelKey: "amazon_product_mining",
        sourceProject: "amazon-product-mining",
        taskKind: "keyword-generation",
        sourceTaskId: runId,
      },
      promptPackageId: `amazon-mining-keyword-${input.taskId}`,
      promptContractId: "amazon-product-mining-keyword-generation-v1",
      expectedOutputSchemaRef: null,
      textPrompt: promptText,
      inputRefs: [],
      modelName: null,
      timeoutMs: 60_000,
      maxInputChars: 30_000,
      maxFileCount: 0,
      maxFileBytes: 1,
      requestedBy: "ai-capability",
      missionId: input.taskId,
      runId,
      roundId: null,
    });
    rawResponse = result.normalizedText ?? "";
    const parsedKeywords = parseKeywordsFromResponse(rawResponse);
    const dedupedKeywords = deduplicateKeywords(
      parsedKeywords,
      input.existingMinedKeywords,
      input.currentTaskKeywords,
      input.miningInput.keywordHistoryPolicy,
    );
    return {
      runId,
      promptText,
      rawResponse,
      parsedKeywords,
      dedupedKeywords,
      status: result.status === "success" ? "success" : "failed",
      failureReason: result.status !== "success" ? (result.failureReason ?? result.reviewRequiredReason ?? "ai_gateway_non_success") : null,
    };
  } catch (error) {
    return {
      runId,
      promptText,
      rawResponse,
      parsedKeywords: [],
      dedupedKeywords: [],
      status: "failed",
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
};

export const runKeywordGeneration = async (input: {
  miningInput: AmazonMiningInput;
  taskId: string;
  existingMinedKeywords: string[];
  aiInputGateway: AiInputGatewayAbilityGroup;
  providerKind: AmazonKeywordProviderKind;
}): Promise<KeywordGenerationResult> => {
  const runs: KeywordGenerationRun[] = [];
  const acceptedKeywords: string[] = [];
  const maxAttempts = 3;
  for (let attemptIndex = 0; attemptIndex < maxAttempts && acceptedKeywords.length < input.miningInput.requestedKeywordCount; attemptIndex++) {
    const requestedKeywordCount = input.miningInput.requestedKeywordCount - acceptedKeywords.length;
    const run = await runKeywordGenerationAttempt({
      ...input,
      currentTaskKeywords: acceptedKeywords,
      requestedKeywordCount,
    });
    runs.push(run);
    acceptedKeywords.push(...run.dedupedKeywords.slice(0, requestedKeywordCount));
    if (run.status === "failed") break;
  }
  const parsedKeywords = runs.flatMap((run) => run.parsedKeywords);
  const lastRun = runs.at(-1)!;
  const reachedRequestedCount = acceptedKeywords.length >= input.miningInput.requestedKeywordCount;
  const refreshModeHasKeywords = input.miningInput.keywordHistoryPolicy === "refresh_historical_keywords" && acceptedKeywords.length > 0;
  const success = reachedRequestedCount || refreshModeHasKeywords;
  const failureReason = success
    ? null
    : input.miningInput.keywordHistoryPolicy === "refresh_historical_keywords"
      ? `${AMAZON_KEYWORD_GENERATION_NO_REFRESHABLE_KEYWORDS_REASON}:requested=${input.miningInput.requestedKeywordCount};deduped=${acceptedKeywords.length}`
      : `${AMAZON_KEYWORD_GENERATION_INSUFFICIENT_NEW_KEYWORDS_REASON}:requested=${input.miningInput.requestedKeywordCount};deduped=${acceptedKeywords.length}`;
  return {
    runs,
    runId: lastRun.runId,
    promptText: lastRun.promptText,
    rawResponse: lastRun.rawResponse,
    parsedKeywords,
    dedupedKeywords: acceptedKeywords,
    status: success ? "success" : "failed",
    failureReason,
  };
};

export const buildKeywordRecords = (input: {
  taskId: string;
  keywords: string[];
  aiRunId: string;
  existingMinedKeywords?: string[];
  keywordHistoryPolicy?: AmazonKeywordHistoryPolicy;
}): AmazonKeywordRecord[] => {
  const now = new Date().toISOString();
  const existingNormalized = new Set((input.existingMinedKeywords ?? []).map(normalizeKeyword));
  const relationForKeyword = (keyword: string): AmazonKeywordHistoryRelation =>
    input.keywordHistoryPolicy === "refresh_historical_keywords" && existingNormalized.has(normalizeKeyword(keyword))
      ? "historical_refresh"
      : "new_keyword";
  return input.keywords.map((keyword) => ({
    keywordId: randomUUID(),
    taskId: input.taskId,
    keyword,
    source: "ai_generated" as const,
    aiRunId: input.aiRunId,
    reason: null,
    keywordHistoryRelation: relationForKeyword(keyword),
    status: "pending" as const,
    createdAt: now,
    updatedAt: null,
  }));
};
