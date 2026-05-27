import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";
import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import type {
  AmazonKeywordOpportunityVerdict,
  AmazonKeywordRecord,
  AmazonTaskRecord,
} from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

const KEYWORD_REVIEW_DIR_NAME = "keyword-opportunity-review";

export type KeywordReviewArtifacts = {
  reviewDir: string;
  inputJsonPath: string;
  promptPath: string;
  responsePath: string;
};

export type KeywordReviewSlice = {
  taskId: string;
  keywordId: string;
  keyword: string;
  taskScope: Pick<AmazonTaskRecord, "amazonMarketplace" | "targetMarket" | "productDirection" | "requestedKeywordCount" | "languagePreference"> | null;
  keywordStatus: string;
  evidenceSummary: {
    searchResultCount: number;
    linkedProductCount: number;
    linkedReviewCount: number;
    imageRefCount: number;
    exceptionCount: number;
  };
  searchResults: Array<{
    itemId: string;
    rankPosition: number;
    isSponsored: boolean;
    title: string | null;
    price: string | null;
    rating: string | null;
    reviewCount: string | null;
    productUrl: string;
    detailIds: string[];
  }>;
  linkedProducts: Array<{
    detailId: string;
    asin: string | null;
    title: string | null;
    currentPrice: string | null;
    rating: string | null;
    reviewCount: string | null;
    bestSellersRankIfVisible: string | null;
    categoryPathIfVisible: string | null;
    starDistribution: string | null;
    status: string;
    sourceItemIds: string[];
    reviewSampleCount: number;
    reviewSamples: Array<{
      reviewId: string;
      rating: string | null;
      reviewTitle: string | null;
      reviewBody: string | null;
      verifiedPurchase: boolean | null;
    }>;
    imageRefs: string[];
  }>;
  imageRefs: string[];
  exceptions: Array<{
    exceptionId: string;
    scope: string;
    scopeId: string | null;
    exceptionKind: string;
    message: string;
    createdAt: string;
  }>;
  completeness: {
    hasSearchResults: boolean;
    hasLinkedProducts: boolean;
    hasLinkedReviews: boolean;
    missingEvidence: string[];
  };
};

type SearchResultRecord = ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>[number];
type SearchResultProductLinkRecord = ReturnType<AmazonMiningStorage["getSearchResultProductLinksForTask"]>[number];
type ProductDetailRecord = ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>[number];
type ReviewRecord = ReturnType<AmazonMiningStorage["getReviewsForProduct"]>[number];
type ExceptionRecord = ReturnType<AmazonMiningStorage["getExceptionsForTask"]>[number];

const writeJson = (filePath: string, data: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const writeText = (filePath: string, text: string): void => {
  writeFileSync(filePath, `${text.trimEnd()}\n`, "utf8");
};

export const resolveKeywordReviewArtifacts = (input: { dataDir: string; taskId: string; keywordId: string }): KeywordReviewArtifacts => {
  const reviewDir = resolve(
    input.dataDir,
    AMAZON_PRODUCT_MINING_ARTIFACTS_DIR,
    input.taskId,
    KEYWORD_REVIEW_DIR_NAME,
    `keyword-${input.keywordId}`,
  );
  mkdirSync(reviewDir, { recursive: true });
  return {
    reviewDir,
    inputJsonPath: join(reviewDir, `keyword-${input.keywordId}-opportunity-review-input.json`),
    promptPath: join(reviewDir, `keyword-${input.keywordId}-opportunity-review-prompt.md`),
    responsePath: join(reviewDir, `keyword-${input.keywordId}-opportunity-review-response.json`),
  };
};

const collectUniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (value) {
      unique.add(value);
    }
  }
  return [...unique];
};

const takeReviewSamples = (
  reviews: Array<{
    reviewId: string;
    rating: string | null;
    reviewTitle: string | null;
    reviewBody: string | null;
    verifiedPurchase: boolean | null;
  }>,
): KeywordReviewSlice["linkedProducts"][number]["reviewSamples"] => reviews.slice(0, 3);

const buildDetailIdsByItemId = (links: SearchResultProductLinkRecord[]): Map<string, string[]> => {
  const detailIdsByItemId = new Map<string, string[]>();
  for (const link of links) {
    const existing = detailIdsByItemId.get(link.itemId) ?? [];
    existing.push(link.detailId);
    detailIdsByItemId.set(link.itemId, existing);
  }
  return detailIdsByItemId;
};

const collectKeywordReviewExceptions = (input: {
  exceptions: ExceptionRecord[];
  keywordId: string;
  linkedDetailIds: string[];
  searchResults: SearchResultRecord[];
}): ExceptionRecord[] => input.exceptions.filter((exception) => {
  if (exception.scopeId === input.keywordId) {
    return true;
  }
  if (exception.scopeId && input.linkedDetailIds.includes(exception.scopeId)) {
    return true;
  }
  return exception.scopeId !== null && input.searchResults.some((item) => item.itemId === exception.scopeId);
});

const buildKeywordProductReviewSlice = (input: {
  product: ProductDetailRecord;
  links: SearchResultProductLinkRecord[];
  reviews: ReviewRecord[];
}): KeywordReviewSlice["linkedProducts"][number] => ({
  detailId: input.product.detailId,
  asin: input.product.asin,
  title: input.product.title,
  currentPrice: input.product.currentPrice,
  rating: input.product.rating,
  reviewCount: input.product.reviewCount,
  bestSellersRankIfVisible: input.product.bestSellersRankIfVisible,
  categoryPathIfVisible: input.product.categoryPathIfVisible,
  starDistribution: input.product.starDistribution,
  status: input.product.status,
  sourceItemIds: input.links.filter((link) => link.detailId === input.product.detailId).map((link) => link.itemId),
  reviewSampleCount: input.reviews.length,
  reviewSamples: takeReviewSamples(input.reviews.map((review) => ({
    reviewId: review.reviewId,
    rating: review.rating,
    reviewTitle: review.reviewTitle,
    reviewBody: review.reviewBody,
    verifiedPurchase: review.verifiedPurchase,
  }))),
  imageRefs: collectUniqueStrings([
    input.product.mainImage,
    ...input.product.allVisibleImages,
    ...input.product.aPlusImageUrls,
    ...input.reviews.flatMap((review) => review.reviewImagesIfVisible),
    ...input.reviews.flatMap((review) => review.reviewVideosIfVisible),
  ]),
});

const buildKeywordProducts = (input: {
  linkedProducts: ProductDetailRecord[];
  links: SearchResultProductLinkRecord[];
  reviewsByDetailId: Map<string, ReviewRecord[]>;
}): KeywordReviewSlice["linkedProducts"] => input.linkedProducts.map((product) => buildKeywordProductReviewSlice({
  product,
  links: input.links,
  reviews: input.reviewsByDetailId.get(product.detailId) ?? [],
}));

const buildMissingEvidence = (input: {
  searchResults: SearchResultRecord[];
  keywordProducts: KeywordReviewSlice["linkedProducts"];
}): string[] => {
  const missingEvidence: string[] = [];
  if (input.searchResults.length === 0) {
    missingEvidence.push("search_results");
  }
  if (input.keywordProducts.length === 0) {
    missingEvidence.push("linked_product_details");
  }
  if (!input.keywordProducts.some((product) => product.reviewSampleCount > 0)) {
    missingEvidence.push("linked_reviews");
  }
  return missingEvidence;
};

const buildTaskScope = (
  task: AmazonTaskRecord | null,
): KeywordReviewSlice["taskScope"] => task
  ? {
      amazonMarketplace: task.amazonMarketplace,
      targetMarket: task.targetMarket,
      productDirection: task.productDirection,
      requestedKeywordCount: task.requestedKeywordCount,
      languagePreference: task.languagePreference,
    }
  : null;

export const buildKeywordEvidenceSlice = (input: {
  storage: AmazonMiningStorage;
  taskId: string;
  keyword: AmazonKeywordRecord;
}): KeywordReviewSlice => {
  const task = input.storage.getTask(input.taskId);
  const searchResults = input.storage.getSearchResultsForKeyword(input.keyword.keywordId);
  const links = input.storage.getSearchResultProductLinksForTask(input.taskId);
  const detailIdsByItemId = buildDetailIdsByItemId(links);
  const linkedDetailIds = collectUniqueStrings(searchResults.flatMap((item) => detailIdsByItemId.get(item.itemId) ?? []));
  const linkedProducts = input.storage
    .getProductDetailsForTask(input.taskId)
    .filter((product) => linkedDetailIds.includes(product.detailId));
  const reviewsByDetailId = new Map(
    linkedProducts.map((product) => [product.detailId, input.storage.getReviewsForProduct(product.detailId)]),
  );
  const exceptions = collectKeywordReviewExceptions({
    exceptions: input.storage.getExceptionsForTask(input.taskId),
    keywordId: input.keyword.keywordId,
    linkedDetailIds,
    searchResults,
  });
  const keywordProducts = buildKeywordProducts({ linkedProducts, links, reviewsByDetailId });
  const allImageRefs = collectUniqueStrings([
    ...searchResults.map((item) => item.mainImageUrl),
    ...keywordProducts.flatMap((product) => product.imageRefs),
  ]);
  const missingEvidence = buildMissingEvidence({ searchResults, keywordProducts });

  return {
    taskId: input.taskId,
    keywordId: input.keyword.keywordId,
    keyword: input.keyword.keyword,
    taskScope: buildTaskScope(task),
    keywordStatus: input.keyword.status,
    evidenceSummary: {
      searchResultCount: searchResults.length,
      linkedProductCount: keywordProducts.length,
      linkedReviewCount: keywordProducts.reduce((count, product) => count + product.reviewSampleCount, 0),
      imageRefCount: allImageRefs.length,
      exceptionCount: exceptions.length,
    },
    searchResults: searchResults.map((item) => ({
      itemId: item.itemId,
      rankPosition: item.rankPosition,
      isSponsored: item.isSponsored,
      title: item.title,
      price: item.price,
      rating: item.rating,
      reviewCount: item.reviewCount,
      productUrl: item.productUrl,
      detailIds: detailIdsByItemId.get(item.itemId) ?? [],
    })),
    linkedProducts: keywordProducts,
    imageRefs: allImageRefs,
    exceptions,
    completeness: {
      hasSearchResults: searchResults.length > 0,
      hasLinkedProducts: keywordProducts.length > 0,
      hasLinkedReviews: keywordProducts.some((product) => product.reviewSampleCount > 0),
      missingEvidence,
    },
  };
};

export const buildKeywordReviewPrompt = (input: {
  evidenceSlice: KeywordReviewSlice;
  inputJsonPath: string;
}): string => `# Keyword Opportunity Review Prompt

You are not a final procurement decision AI.
You are not a profit calculation AI.
You are not a supply-chain judgment AI.
Your task is to judge whether the Amazon product pool under this keyword is worth entering the next stage of human research.

Review unit: keywordId ${input.evidenceSlice.keywordId}
Review target: keyword product pool, not final single-product selection.
Evidence input file: ${input.inputJsonPath}

Decision rules:
- PASS = worth entering the next stage of human validation.
- WATCH = there is signal, but the evidence is still thin and related keywords or more data should be mined.
- REJECT = the product pool is too weak to enter the next human candidate pool.
- INSUFFICIENT_DATA = current evidence is not enough to decide.

Fixed dimensions:
- Demand Signal (demandSignal)
- Review Health (reviewHealth)
- Price Ceiling (priceCeiling)
- Competition Openness (competitionOpenness)
- Improvement Opportunity (improvementOpportunity)
- Data Confidence (dataConfidence)

Each dimension must be exactly one of: strong, medium, weak, insufficient.

Allowed humanNextStep values:
- enter_next_validation
- mine_related_keywords
- reject
- rerun_or_collect_more_data

Forbidden output:
- procurement advice
- sampling advice
- inventory or place-order advice
- run-ads advice
- profit conclusions
- final product selection
- deterministic marketing claims

Return JSON only. No prose before or after the JSON object.

Required JSON schema:
{
  "decision": "PASS | WATCH | REJECT | INSUFFICIENT_DATA",
  "demandSignal": "strong | medium | weak | insufficient",
  "reviewHealth": "strong | medium | weak | insufficient",
  "priceCeiling": "strong | medium | weak | insufficient",
  "competitionOpenness": "strong | medium | weak | insufficient",
  "improvementOpportunity": "strong | medium | weak | insufficient",
  "dataConfidence": "strong | medium | weak | insufficient",
  "evidenceRefs": [],
  "missingEvidence": [],
  "riskPoints": [],
  "humanNextStep": "enter_next_validation | mine_related_keywords | reject | rerun_or_collect_more_data"
}

Evidence slice:
${JSON.stringify(input.evidenceSlice, null, 2)}
`;

export const writeKeywordReviewSourceArtifacts = (input: {
  dataDir: string;
  taskId: string;
  keywordId: string;
  evidenceSlice: KeywordReviewSlice;
}): { artifacts: KeywordReviewArtifacts; aiPromptText: string } => {
  const artifacts = resolveKeywordReviewArtifacts(input);
  const aiPromptText = buildKeywordReviewPrompt({
    evidenceSlice: input.evidenceSlice,
    inputJsonPath: artifacts.inputJsonPath,
  });
  writeJson(artifacts.inputJsonPath, input.evidenceSlice);
  writeText(artifacts.promptPath, aiPromptText);
  return { artifacts, aiPromptText };
};

const unwrapJsonPayload = (rawResponse: string): string | null => {
  const trimmed = rawResponse.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith("```")) {
    const firstLineBreak = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");
    if (firstLineBreak === -1 || lastFence <= firstLineBreak) {
      return null;
    }
    const fencedBody = trimmed.slice(firstLineBreak + 1, lastFence).trim();
    return fencedBody.startsWith("{") && fencedBody.endsWith("}") ? fencedBody : null;
  }
  return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed : null;
};

export const parseKeywordReviewResponse = (rawResponse: string): AmazonKeywordOpportunityVerdict | null => {
  const jsonPayload = unwrapJsonPayload(rawResponse);
  if (!jsonPayload) {
    return null;
  }
  try {
    const parsed = JSON.parse(jsonPayload) as unknown;
    return AmazonMiningSchemas.AmazonKeywordOpportunityVerdictSchema.parse(parsed);
  } catch {
    return null;
  }
};

export const validateKeywordReviewVerdict = (verdict: unknown): AmazonKeywordOpportunityVerdict =>
  AmazonMiningSchemas.AmazonKeywordOpportunityVerdictSchema.parse(verdict);

export const writeKeywordReviewResponseArtifact = (input: {
  reviewId: string;
  status: string;
  failureReason: string | null;
  rawResponse: string;
  verdict: AmazonKeywordOpportunityVerdict | null;
  responsePath: string;
}): void => {
  writeJson(input.responsePath, {
    reviewId: input.reviewId,
    status: input.status,
    failureReason: input.failureReason,
    rawResponse: input.rawResponse,
    verdict: input.verdict,
  });
};