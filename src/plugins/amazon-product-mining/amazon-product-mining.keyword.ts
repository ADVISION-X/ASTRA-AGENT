import { randomUUID } from "node:crypto";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { AmazonKeywordRecord, AmazonMiningInput } from "./amazon-product-mining.schema.js";

export type KeywordProviderKind = "gemini-api" | "gemini-web-chat" | "gpt-web-chat";

type KeywordGenerationResult = {
  runId: string;
  promptText: string;
  rawResponse: string;
  parsedKeywords: string[];
  dedupedKeywords: string[];
  status: "success" | "failed";
  failureReason: string | null;
};

const buildKeywordPrompt = (input: {
  amazonMarketplace: string;
  targetMarket: string;
  productDirection: string;
  requestedKeywordCount: number;
  languagePreference: string;
  existingMinedKeywords: string[];
}): string => {
  const existingList = input.existingMinedKeywords.length > 0
    ? `\n\nAlready mined keywords (DO NOT REPEAT THESE):\n${input.existingMinedKeywords.map((k) => `- ${k}`).join("\n")}`
    : "\n\nNo keywords mined yet for this product direction.";

  return `You are helping mine Amazon product search keywords for a specific market opportunity.

Amazon Marketplace: ${input.amazonMarketplace}
Target Market / Customer Segment: ${input.targetMarket}
Product Direction: ${input.productDirection}
Requested Keyword Count: ${input.requestedKeywordCount}
Language Preference: ${input.languagePreference}
${existingList}

TASK: Generate exactly ${input.requestedKeywordCount} NEW Amazon search keywords for this product direction.

CONSTRAINTS:
- Must NOT repeat any already-mined keyword
- Keywords should be actual Amazon search terms buyers would type
- Focus on commercial intent (buyers looking to purchase)
- Do NOT include brand names unless commonly used as generic terms
- Each keyword should be distinct and cover different aspects / use cases

OUTPUT FORMAT (JSON only, no explanation):
{
  "keywords": [
    { "keyword": "...", "reason": "..." },
    ...
  ]
}`;
};

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
  keyword.toLowerCase().replace(/\s+/gu, " ").trim();

export const deduplicateKeywords = (
  candidates: string[],
  existingMinedKeywords: string[],
  currentTaskKeywords: string[],
): string[] => {
  const existingNormalized = new Set([
    ...existingMinedKeywords.map(normalizeKeyword),
    ...currentTaskKeywords.map(normalizeKeyword),
  ]);
  const result: string[] = [];
  const seenInBatch = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeKeyword(candidate);
    if (existingNormalized.has(normalized)) continue;
    if (seenInBatch.has(normalized)) continue;
    seenInBatch.add(normalized);
    result.push(candidate);
  }
  return result;
};

export const runKeywordGeneration = async (input: {
  miningInput: AmazonMiningInput;
  taskId: string;
  existingMinedKeywords: string[];
  aiInputGateway: AiInputGatewayAbilityGroup;
  providerKind?: KeywordProviderKind;
}): Promise<KeywordGenerationResult> => {
  const runId = randomUUID();
  const providerKind = input.providerKind ?? "gemini-api";
  const promptText = buildKeywordPrompt({
    amazonMarketplace: input.miningInput.amazonMarketplace,
    targetMarket: input.miningInput.targetMarket,
    productDirection: input.miningInput.productDirection,
    requestedKeywordCount: input.miningInput.requestedKeywordCount,
    languagePreference: input.miningInput.languagePreference,
    existingMinedKeywords: input.existingMinedKeywords,
  });

  let rawResponse = "";
  try {
    const result = await input.aiInputGateway.execute({
      providerKind,
      promptPackageId: `amazon-mining-keyword-${input.taskId}`,
      promptContractId: "amazon-product-mining-keyword-generation-v1",
      expectedOutputSchemaRef: null,
      textPrompt: promptText,
      inputRefs: [],
      modelName: null,
      timeoutMs: 60_000,
      maxInputChars: 30_000,
      maxFileCount: 0,
      maxFileBytes: 0,
      requestedBy: "ai-capability",
      missionId: input.taskId,
      runId,
      roundId: null,
    });
    rawResponse = result.normalizedText ?? "";
    const parsedKeywords = parseKeywordsFromResponse(rawResponse);
    const dedupedKeywords = deduplicateKeywords(parsedKeywords, input.existingMinedKeywords, []);
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

export const buildKeywordRecords = (input: {
  taskId: string;
  keywords: string[];
  aiRunId: string;
}): AmazonKeywordRecord[] => {
  const now = new Date().toISOString();
  return input.keywords.map((keyword) => ({
    keywordId: randomUUID(),
    taskId: input.taskId,
    keyword,
    source: "ai_generated" as const,
    aiRunId: input.aiRunId,
    reason: null,
    status: "pending" as const,
    createdAt: now,
    updatedAt: null,
  }));
};
