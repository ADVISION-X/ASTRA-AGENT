import { writeFileSync } from "node:fs";

import { AmazonMiningSchemas } from "./amazon-product-mining.schema.js";
import {
  buildKeywordReviewDetailEvidence,
  buildKeywordReviewSamples,
  clipKeywordReviewText,
  compactKeywordReviewDisclosureMap,
  KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT,
  type EvidenceDisclosureMap,
  type EvidenceField,
  type KeywordReviewSample,
} from "./amazon-product-mining.keyword-review-evidence.js";
import type {
  AmazonKeywordOpportunityVerdict,
  AmazonKeywordRecord,
  AmazonTaskRecord,
} from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

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
    productUrl: string;
    currentPrice: string | null;
    rating: string | null;
    reviewCount: string | null;
    boughtInPastMonthIfVisible: string | null;
    bestSellersRankIfVisible: string | null;
    categoryPathIfVisible: string | null;
    starDistribution: string | null;
    fieldDisclosureMap: EvidenceDisclosureMap;
    detailEvidence: Record<string, EvidenceField<string | string[]>>;
    status: string;
    sourceItemIds: string[];
    reviewSampleCount: number;
    reviewCoverage: {
      totalStoredReviews: number;
      includedReviewSamples: number;
      omittedReviewSamples: number;
      samplePolicy: string;
    };
    reviewSamples: KeywordReviewSample[];
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

const collectUniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (value) {
      unique.add(value);
    }
  }
  return [...unique];
};

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
}): KeywordReviewSlice["linkedProducts"][number] => {
  const reviewSamples = buildKeywordReviewSamples(input.reviews);
  return {
    detailId: input.product.detailId,
    asin: input.product.asin,
    title: input.product.title,
    productUrl: input.product.productUrl,
    currentPrice: input.product.currentPrice,
    rating: input.product.rating,
    reviewCount: input.product.reviewCount,
    boughtInPastMonthIfVisible: input.product.boughtInPastMonthIfVisible,
    bestSellersRankIfVisible: input.product.bestSellersRankIfVisible,
    categoryPathIfVisible: input.product.categoryPathIfVisible,
    starDistribution: clipKeywordReviewText(input.product.starDistribution),
    fieldDisclosureMap: compactKeywordReviewDisclosureMap(input.product.fieldDisclosureMap),
    detailEvidence: buildKeywordReviewDetailEvidence(input.product),
    status: input.product.status,
    sourceItemIds: input.links.filter((link) => link.detailId === input.product.detailId).map((link) => link.itemId),
    reviewSampleCount: input.reviews.length,
    reviewCoverage: {
      totalStoredReviews: input.reviews.length,
      includedReviewSamples: reviewSamples.length,
      omittedReviewSamples: Math.max(input.reviews.length - reviewSamples.length, 0),
      samplePolicy: `first ${KEYWORD_REVIEW_MAX_REVIEW_SAMPLES_PER_PRODUCT} stored accessible reviews per product, preserving page order and full review media/language/region metadata when captured`,
    },
    reviewSamples,
    imageRefs: collectUniqueStrings([
      input.product.mainImage,
      ...input.product.allVisibleImages,
      ...input.product.aPlusImageUrls,
      ...input.reviews.flatMap((review) => review.reviewImagesIfVisible),
      ...input.reviews.flatMap((review) => review.reviewVideosIfVisible),
    ]),
  };
};

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

const escapeLooseQuotesInsideJsonStrings = (jsonPayload: string): string => {
  let output = "";
  let insideString = false;
  let escaped = false;
  for (let index = 0; index < jsonPayload.length; index++) {
    const char = jsonPayload[index]!;
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      output += char;
      escaped = insideString;
      continue;
    }
    if (char !== '"') {
      output += char;
      continue;
    }
    if (!insideString) {
      insideString = true;
      output += char;
      continue;
    }
    const nextNonSpace = jsonPayload.slice(index + 1).trimStart()[0] ?? "";
    if ([",", "}", "]", ":"].includes(nextNonSpace)) {
      insideString = false;
      output += char;
      continue;
    }
    output += '\\"';
  }
  return output;
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
    try {
      const repaired = JSON.parse(escapeLooseQuotesInsideJsonStrings(jsonPayload)) as unknown;
      return AmazonMiningSchemas.AmazonKeywordOpportunityVerdictSchema.parse(repaired);
    } catch {
      return null;
    }
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
