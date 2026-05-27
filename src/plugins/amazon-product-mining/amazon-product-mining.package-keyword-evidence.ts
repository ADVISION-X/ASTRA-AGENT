import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { AMAZON_PACKAGE_FILE_NAMES, type AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import {
  writeJsonFile,
  type AmazonKeywordRecord,
  type AmazonSearchResultItem,
} from "./amazon-product-mining.package-artifact-builders.js";
import {
  buildRangeSummary,
  buildRawTextBlob,
  escapeCsvValue,
  toPackageRelativePath,
  writeTextFile,
} from "./amazon-product-mining.package-evidence-shared.js";

export type AmazonPackageKeywordEvidence = {
  keywordId: string;
  keyword: string;
  status: string;
  searchUrl: string | null;
  dirPath: string;
  dirRef: string;
  summaryPath: string;
  summaryRef: string;
  searchResultsPath: string;
  searchResultsRef: string;
  searchResultsCsvPath: string;
  searchResultsCsvRef: string;
  rawVisibleTextPath: string;
  rawVisibleTextRef: string;
  itemIds: string[];
  linkedDetailIds: string[];
  sponsoredCount: number;
  organicCount: number;
  topProducts: Array<{
    itemId: string;
    detailId: string | null;
    asinIfAvailable: string | null;
    title: string | null;
    rankPosition: number;
    productUrl: string;
  }>;
  exceptionIds: string[];
};

const buildTopProducts = (
  searchResults: readonly AmazonSearchResultItem[],
  detailIdsByItemId: Map<string, string[]>,
) => searchResults.slice(0, 10).map((item) => ({
  itemId: item.itemId,
  detailId: (detailIdsByItemId.get(item.itemId) ?? [null])[0] ?? null,
  asinIfAvailable: item.asinIfAvailable,
  title: item.title,
  rankPosition: item.rankPosition,
  productUrl: item.productUrl,
}));

const writeKeywordSummaryArtifact = (input: {
  summaryPath: string;
  keyword: AmazonKeywordRecord;
  searchResults: readonly AmazonSearchResultItem[];
  topProducts: AmazonPackageKeywordEvidence["topProducts"];
  sponsoredCount: number;
  organicCount: number;
  exceptionIds: readonly string[];
}) => {
  writeJsonFile(input.summaryPath, {
    keywordId: input.keyword.keywordId,
    keyword: input.keyword.keyword,
    status: input.keyword.status,
    searchUrl: input.searchResults[0]?.searchUrl ?? null,
    visibleProductCount: input.searchResults.length,
    sponsoredCount: input.sponsoredCount,
    organicCount: input.organicCount,
    topProducts: input.topProducts,
    priceRange: buildRangeSummary(input.searchResults.map((item) => item.price)),
    ratingRange: buildRangeSummary(input.searchResults.map((item) => item.rating)),
    reviewCountRange: buildRangeSummary(input.searchResults.map((item) => item.reviewCount)),
    exceptionFlags: input.exceptionIds,
  });
};

const writeKeywordSearchResultArtifacts = (input: {
  searchResultsPath: string;
  searchResultsCsvPath: string;
  rawVisibleTextPath: string;
  keyword: AmazonKeywordRecord;
  searchResults: readonly AmazonSearchResultItem[];
  detailIdsByItemId: Map<string, string[]>;
}) => {
  writeJsonFile(input.searchResultsPath, {
    taskId: input.keyword.taskId,
    keywordId: input.keyword.keywordId,
    keyword: input.keyword.keyword,
    searchUrl: input.searchResults[0]?.searchUrl ?? null,
    capturedAt: input.searchResults[0]?.createdAt ?? input.keyword.createdAt,
    status: input.keyword.status,
    items: input.searchResults.map((item) => ({
      rank: item.rankPosition,
      placementType: item.isSponsored ? "sponsored" : "organic",
      asin: item.asinIfAvailable,
      title: item.title,
      price: item.price,
      rating: item.rating,
      reviewCount: item.reviewCount,
      mainImageUrl: item.mainImageUrl,
      productUrl: item.productUrl,
      detailIds: input.detailIdsByItemId.get(item.itemId) ?? [],
      rawVisibleTextSnapshot: item.rawVisibleTextSnapshot,
    })),
  });
  const csvRows = [
    ["Rank", "SponsoredOrOrganic", "ASIN", "Title", "Price", "Rating", "ReviewCount", "MainImageURL", "ProductURL", "DetailID"],
    ...input.searchResults.map((item) => [
      String(item.rankPosition),
      item.isSponsored ? "Sponsored" : "Organic",
      item.asinIfAvailable ?? "",
      item.title ?? "",
      item.price ?? "",
      item.rating ?? "",
      item.reviewCount ?? "",
      item.mainImageUrl ?? "",
      item.productUrl,
      (input.detailIdsByItemId.get(item.itemId) ?? []).join("|"),
    ]),
  ];
  writeTextFile(input.searchResultsCsvPath, csvRows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n"));
  writeTextFile(input.rawVisibleTextPath, buildRawTextBlob(input.searchResults.map((item) => item.rawVisibleTextSnapshot)));
};

const createKeywordEvidenceArtifact = (input: {
  layout: AmazonPackageLayout;
  keyword: AmazonKeywordRecord;
  searchResults: readonly AmazonSearchResultItem[];
  detailIdsByItemId: Map<string, string[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageKeywordEvidence => {
  const keywordDir = join(input.layout.keywordSearchEvidenceDir, `keyword-${input.keyword.keywordId}`);
  mkdirSync(keywordDir, { recursive: true });
  const summaryPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.keywordSummary);
  const searchResultsPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageResults);
  const searchResultsCsvPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageResultsCsv);
  const rawVisibleTextPath = join(keywordDir, AMAZON_PACKAGE_FILE_NAMES.searchPageRawVisibleText);
  const linkedDetailIds = [...new Set(input.searchResults.flatMap((item) => input.detailIdsByItemId.get(item.itemId) ?? []))];
  const itemExceptionIds = input.searchResults.flatMap((item) => input.exceptionIdsByScopeId.get(item.itemId) ?? []);
  const exceptionIds = [...new Set([...(input.exceptionIdsByScopeId.get(input.keyword.keywordId) ?? []), ...itemExceptionIds])];
  const sponsoredCount = input.searchResults.filter((item) => item.isSponsored).length;
  const organicCount = input.searchResults.length - sponsoredCount;
  const topProducts = buildTopProducts(input.searchResults, input.detailIdsByItemId);
  writeKeywordSummaryArtifact({
    summaryPath,
    keyword: input.keyword,
    searchResults: input.searchResults,
    topProducts,
    sponsoredCount,
    organicCount,
    exceptionIds,
  });
  writeKeywordSearchResultArtifacts({
    searchResultsPath,
    searchResultsCsvPath,
    rawVisibleTextPath,
    keyword: input.keyword,
    searchResults: input.searchResults,
    detailIdsByItemId: input.detailIdsByItemId,
  });
  return {
    keywordId: input.keyword.keywordId,
    keyword: input.keyword.keyword,
    status: input.keyword.status,
    searchUrl: input.searchResults[0]?.searchUrl ?? null,
    dirPath: keywordDir,
    dirRef: toPackageRelativePath(input.layout.packageRootPath, keywordDir),
    summaryPath,
    summaryRef: toPackageRelativePath(input.layout.packageRootPath, summaryPath),
    searchResultsPath,
    searchResultsRef: toPackageRelativePath(input.layout.packageRootPath, searchResultsPath),
    searchResultsCsvPath,
    searchResultsCsvRef: toPackageRelativePath(input.layout.packageRootPath, searchResultsCsvPath),
    rawVisibleTextPath,
    rawVisibleTextRef: toPackageRelativePath(input.layout.packageRootPath, rawVisibleTextPath),
    itemIds: input.searchResults.map((item) => item.itemId),
    linkedDetailIds,
    sponsoredCount,
    organicCount,
    topProducts,
    exceptionIds,
  };
};

export const writeKeywordEvidenceArtifacts = (input: {
  layout: AmazonPackageLayout;
  keywords: readonly AmazonKeywordRecord[];
  searchResultsByKeyword: Map<string, AmazonSearchResultItem[]>;
  detailIdsByItemId: Map<string, string[]>;
  exceptionIdsByScopeId: Map<string, string[]>;
}): AmazonPackageKeywordEvidence[] =>
  input.keywords.map((keyword) => createKeywordEvidenceArtifact({
    layout: input.layout,
    keyword,
    searchResults: input.searchResultsByKeyword.get(keyword.keywordId) ?? [],
    detailIdsByItemId: input.detailIdsByItemId,
    exceptionIdsByScopeId: input.exceptionIdsByScopeId,
  }));