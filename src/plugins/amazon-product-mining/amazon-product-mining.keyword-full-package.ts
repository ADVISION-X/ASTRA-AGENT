import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";
import type { AmazonKeywordRecord } from "./amazon-product-mining.schema.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import {
  buildKeywordEvidenceSlice,
  type KeywordReviewSlice,
} from "./amazon-product-mining.keyword-review-support.js";

type SearchItem = ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>[number];
type ProductDetail = ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>[number];
type ReviewRecord = ReturnType<AmazonMiningStorage["getReviewsForProduct"]>[number];
type ExceptionRecord = ReturnType<AmazonMiningStorage["getExceptionsForTask"]>[number];

export type KeywordFullPackageArtifacts = {
  packageRootPath: string;
  packageZipPath: string;
  manifestPath: string;
  masterReportPath: string;
  searchResultsPath: string;
  productDetailsPath: string;
  reviewsJsonlPath: string;
  reviewsSummaryPath: string;
  reviewPagesIndexPath: string;
  imageEvidenceIndexPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  exceptionSummaryPath: string;
  aiReadingContractPath: string;
  promptPath: string;
  responsePath: string;
  inlineNavigationPath: string;
  uploadFileRefs: Array<{ id: string; filePath: string; kind: string; mimeType: string; summary: string }>;
  integrityStatus: "pass" | "failed";
};

type KeywordPackageState = {
  evidenceNavigation: KeywordReviewSlice;
  exceptions: ExceptionRecord[];
  linkedProducts: ProductDetail[];
  reviews: ReviewRecord[];
  searchResults: SearchItem[];
};

const KEYWORD_FULL_PACKAGE_DIR_NAMES = {
  masterReport: "00-keyword-master-report",
  searchResults: "01-search-results",
  productDetails: "02-product-details",
  reviews: "03-reviews",
  images: "04-images",
  completeness: "05-completeness",
  exceptions: "06-exceptions",
  aiHandoff: "07-ai-handoff",
} as const;

const writeJson = (filePath: string, data: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const writeText = (filePath: string, text: string): void => {
  writeFileSync(filePath, `${text.trimEnd()}\n`, "utf8");
};

const hashFile = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const collectUniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (value) unique.add(value);
  }
  return [...unique];
};

const buildDetailIdsByItemId = (links: Array<{ itemId: string; detailId: string }>): Map<string, string[]> => {
  const detailIdsByItemId = new Map<string, string[]>();
  for (const link of links) {
    const existing = detailIdsByItemId.get(link.itemId) ?? [];
    existing.push(link.detailId);
    detailIdsByItemId.set(link.itemId, existing);
  }
  return detailIdsByItemId;
};

const resolveKeywordFullPackagePaths = (input: { dataDir: string; taskId: string; keywordId: string }) => {
  const packageRootPath = resolve(
    input.dataDir,
    AMAZON_PRODUCT_MINING_ARTIFACTS_DIR,
    input.taskId,
    `keyword-${input.keywordId}-full-evidence-package`,
  );
  const dirs = {
    masterReport: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.masterReport),
    searchResults: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.searchResults),
    productDetails: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.productDetails),
    reviews: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.reviews),
    images: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.images),
    completeness: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.completeness),
    exceptions: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.exceptions),
    aiHandoff: join(packageRootPath, KEYWORD_FULL_PACKAGE_DIR_NAMES.aiHandoff),
  };
  for (const dirPath of [packageRootPath, ...Object.values(dirs)]) {
    mkdirSync(dirPath, { recursive: true });
  }
  return {
    packageRootPath,
    packageZipPath: join(dirname(packageRootPath), `keyword-${input.keywordId}-full-evidence-package.zip`),
    manifestPath: join(packageRootPath, "manifest.json"),
    masterReportPath: join(dirs.masterReport, "keyword-master-report.md"),
    searchResultsPath: join(dirs.searchResults, "search-results.json"),
    productDetailsPath: join(dirs.productDetails, "product-details.json"),
    reviewsJsonlPath: join(dirs.reviews, "reviews.jsonl"),
    reviewsSummaryPath: join(dirs.reviews, "reviews-summary.json"),
    reviewPagesIndexPath: join(dirs.reviews, "review-pages-index.json"),
    imageEvidenceIndexPath: join(dirs.images, "image-evidence-index.json"),
    dataCompletenessReportPath: join(dirs.completeness, "data-completeness-report.json"),
    packageIntegrityReportPath: join(dirs.completeness, "package-integrity-report.json"),
    exceptionSummaryPath: join(dirs.exceptions, "exception-summary.json"),
    aiReadingContractPath: join(dirs.aiHandoff, "ai-reading-contract.md"),
    promptPath: join(dirs.aiHandoff, "keyword-opportunity-review-prompt.md"),
    responsePath: join(dirs.aiHandoff, "keyword-opportunity-review-response.json"),
    inlineNavigationPath: join(dirs.aiHandoff, "inline-evidence-navigation.json"),
  };
};

const loadKeywordPackageState = (input: {
  storage: AmazonMiningStorage;
  taskId: string;
  keyword: AmazonKeywordRecord;
}): KeywordPackageState => {
  const searchResults = input.storage.getSearchResultsForKeyword(input.keyword.keywordId);
  const links = input.storage.getSearchResultProductLinksForTask(input.taskId);
  const detailIdsByItemId = buildDetailIdsByItemId(links);
  const linkedDetailIds = collectUniqueStrings(searchResults.flatMap((item) => detailIdsByItemId.get(item.itemId) ?? []));
  const linkedProducts = input.storage.getProductDetailsForTask(input.taskId)
    .filter((product) => linkedDetailIds.includes(product.detailId));
  const reviews = linkedProducts.flatMap((product) => input.storage.getReviewsForProduct(product.detailId));
  const exceptions = input.storage.getExceptionsForTask(input.taskId).filter((exception) =>
    exception.scopeId === input.keyword.keywordId
    || searchResults.some((item) => item.itemId === exception.scopeId)
    || linkedProducts.some((product) => product.detailId === exception.scopeId),
  );
  return {
    evidenceNavigation: buildKeywordEvidenceSlice(input),
    exceptions,
    linkedProducts,
    reviews,
    searchResults,
  };
};

const buildImageIndex = (state: KeywordPackageState) => ({
  mode: "url_only",
  images: collectUniqueStrings([
    ...state.searchResults.map((item) => item.mainImageUrl),
    ...state.linkedProducts.flatMap((product) => [product.mainImage, ...product.allVisibleImages, ...product.aPlusImageUrls]),
    ...state.reviews.flatMap((review) => [...review.reviewImagesIfVisible, ...review.reviewVideosIfVisible]),
  ]).map((url, index) => ({ imageId: `keyword-image-${index + 1}`, url })),
});

const buildReviewsSummary = (state: KeywordPackageState) => ({
  totalReviews: state.reviews.length,
  productsWithReviews: new Set(state.reviews.map((review) => review.detailId)).size,
  reviewsWithImages: state.reviews.filter((review) => review.reviewImagesIfVisible.length > 0).length,
  reviewsWithVideos: state.reviews.filter((review) => review.reviewVideosIfVisible.length > 0).length,
  languages: collectUniqueStrings(state.reviews.map((review) => review.reviewLanguage)),
  regions: collectUniqueStrings(state.reviews.map((review) => review.reviewRegionIfVisible)),
});

const buildReviewPagesIndex = (state: KeywordPackageState) =>
  state.reviews.map((review) => ({
    detailId: review.detailId,
    asin: review.asin,
    pageIndex: review.pageIndex,
    reviewId: review.reviewId,
    reviewIdIfAvailable: review.reviewIdIfAvailable,
  }));

const buildCompletenessReport = (state: KeywordPackageState) => ({
  status: state.searchResults.length > 0 && state.linkedProducts.length > 0 ? "extracted" : "failed",
  counts: {
    searchResults: state.searchResults.length,
    productDetails: state.linkedProducts.length,
    reviews: state.reviews.length,
    images: buildImageIndex(state).images.length,
    exceptions: state.exceptions.length,
  },
  missingEvidence: state.evidenceNavigation.completeness.missingEvidence,
});

const buildMasterReport = (input: {
  keyword: AmazonKeywordRecord;
  state: KeywordPackageState;
  packageRootPath: string;
}): string => `# Master Evidence Report

Keyword: ${input.keyword.keyword}
Keyword ID: ${input.keyword.keywordId}
Package root: ${input.packageRootPath}

## Evidence Counts

- Search results: ${input.state.searchResults.length}
- Linked product details: ${input.state.linkedProducts.length}
- Full accessible reviews: ${input.state.reviews.length}
- Image/video URLs: ${buildImageIndex(input.state).images.length}
- Exceptions: ${input.state.exceptions.length}

## Required Reading Order

1. manifest.json
2. 00-keyword-master-report/keyword-master-report.md
3. 01-search-results/search-results.json
4. 02-product-details/product-details.json
5. 03-reviews/reviews.jsonl
6. 04-images/image-evidence-index.json
7. 05-completeness/data-completeness-report.json
8. 06-exceptions/exception-summary.json

This package is evidence for keyword candidate screening only. It is not final product selection, procurement, profit, inventory, launch, or ad guidance.`;

const buildAiReadingContract = (): string => `# AI Reading Contract

You must base the keyword opportunity review on the attached keyword full evidence package archive.
The archive is only a transport wrapper; the package files inside it are the evidence source.
The inline navigation is only a table of contents and cannot be the sole evidence source.
If the package files are unavailable or unreadable, return INSUFFICIENT_DATA with concrete missing evidence refs.
Do not output final product selection, procurement advice, inventory advice, advertising advice, profit conclusions, or deterministic marketing claims.`;

export const buildKeywordFullPackagePrompt = (input: {
  keyword: AmazonKeywordRecord;
  artifacts: Pick<KeywordFullPackageArtifacts, "packageRootPath" | "inlineNavigationPath" | "packageIntegrityReportPath">;
}): string => `# Keyword Opportunity Review Prompt

Review unit: keywordId ${input.keyword.keywordId}
Review target: keyword product pool candidate screening, not final product selection.

You must read the uploaded keyword full evidence package archive before deciding.
The archive is a transport wrapper over the full package directory, not a second truth source.
The inline navigation file is only a reading map: ${input.artifacts.inlineNavigationPath}
Package integrity report: ${input.artifacts.packageIntegrityReportPath}
Package root: ${input.artifacts.packageRootPath}

This is a pre-human-validation screening gate. Only AI-accepted keyword product pools enter human product finding, product comparison, and later calculation work.
PASS is conservative: use it only when demandSignal and dataConfidence are at least medium, the evidence gives humans a workable validation path, and no core blocker dominates.
REJECT is mandatory when the readable full package gives enough evidence that the keyword product pool is not worth human validation.
Use REJECT for non-workable pools with weak or insufficient demand, bad review health without actionable improvement, an unworkable price ceiling, closed competition, or weak improvement opportunity.
Do not choose WATCH to be polite when the evidence is sufficient for REJECT.
Use WATCH only for mixed signals that justify mining related keywords or collecting more data.
Use INSUFFICIENT_DATA only when the package is unreadable, core search/detail/review evidence is missing, or dataConfidence is insufficient.

Return JSON only:
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
}`;

const buildManifest = (input: {
  keyword: AmazonKeywordRecord;
  state: KeywordPackageState;
  generatedAt: string;
  files: Record<string, string>;
}) => ({
  packageType: "amazon-product-mining-keyword-full-evidence-package",
  generatedAt: input.generatedAt,
  keywordId: input.keyword.keywordId,
  keyword: input.keyword.keyword,
  evidenceCounts: {
    searchResults: input.state.searchResults.length,
    productDetails: input.state.linkedProducts.length,
    reviews: input.state.reviews.length,
    images: buildImageIndex(input.state).images.length,
    exceptions: input.state.exceptions.length,
  },
  files: input.files,
});

const writeKeywordPackageFiles = (input: {
  keyword: AmazonKeywordRecord;
  paths: ReturnType<typeof resolveKeywordFullPackagePaths>;
  state: KeywordPackageState;
  generatedAt: string;
}): void => {
  writeJson(input.paths.searchResultsPath, input.state.searchResults);
  writeJson(input.paths.productDetailsPath, input.state.linkedProducts);
  writeText(input.paths.reviewsJsonlPath, input.state.reviews.map((review) => JSON.stringify(review)).join("\n"));
  writeJson(input.paths.reviewsSummaryPath, buildReviewsSummary(input.state));
  writeJson(input.paths.reviewPagesIndexPath, buildReviewPagesIndex(input.state));
  writeJson(input.paths.imageEvidenceIndexPath, buildImageIndex(input.state));
  writeJson(input.paths.dataCompletenessReportPath, buildCompletenessReport(input.state));
  writeJson(input.paths.exceptionSummaryPath, input.state.exceptions);
  writeJson(input.paths.inlineNavigationPath, input.state.evidenceNavigation);
  writeText(input.paths.masterReportPath, buildMasterReport({
    keyword: input.keyword,
    state: input.state,
    packageRootPath: input.paths.packageRootPath,
  }));
  writeText(input.paths.aiReadingContractPath, buildAiReadingContract());
  writeText(input.paths.promptPath, buildKeywordFullPackagePrompt({
    keyword: input.keyword,
    artifacts: input.paths,
  }));
};

const buildIntegrityReport = (input: {
  paths: ReturnType<typeof resolveKeywordFullPackagePaths>;
  requiredFiles: string[];
}) => {
  const missingFiles = input.requiredFiles.filter((filePath) => !existsSync(filePath));
  return {
    status: missingFiles.length === 0 ? "pass" as const : "failed" as const,
    missingFiles,
    fileHashes: input.requiredFiles
      .filter((filePath) => existsSync(filePath))
      .map((filePath) => ({ filePath, sha256: hashFile(filePath) })),
  };
};

const buildUploadRefs = (
  paths: ReturnType<typeof resolveKeywordFullPackagePaths>,
): KeywordFullPackageArtifacts["uploadFileRefs"] => [
  { id: "keyword-full-evidence-package-zip", kind: "keyword-full-package-zip", filePath: paths.packageZipPath, mimeType: "application/zip", summary: "Transport archive containing the complete keyword full evidence package directory." },
];

const writeKeywordPackageZip = (paths: ReturnType<typeof resolveKeywordFullPackagePaths>): void => {
  rmSync(paths.packageZipPath, { force: true });
  execFileSync(
    "zip",
    ["-qr", paths.packageZipPath, basename(paths.packageRootPath)],
    { cwd: dirname(paths.packageRootPath) },
  );
};

export const buildKeywordFullEvidencePackage = (input: {
  dataDir: string;
  taskId: string;
  keyword: AmazonKeywordRecord;
  storage: AmazonMiningStorage;
}): KeywordFullPackageArtifacts => {
  const generatedAt = new Date().toISOString();
  const paths = resolveKeywordFullPackagePaths({
    dataDir: input.dataDir,
    taskId: input.taskId,
    keywordId: input.keyword.keywordId,
  });
  const state = loadKeywordPackageState(input);
  writeKeywordPackageFiles({ keyword: input.keyword, paths, state, generatedAt });
  const requiredFiles = [
    paths.masterReportPath,
    paths.searchResultsPath,
    paths.productDetailsPath,
    paths.reviewsJsonlPath,
    paths.reviewsSummaryPath,
    paths.reviewPagesIndexPath,
    paths.imageEvidenceIndexPath,
    paths.dataCompletenessReportPath,
    paths.exceptionSummaryPath,
    paths.aiReadingContractPath,
    paths.promptPath,
    paths.inlineNavigationPath,
  ];
  writeJson(paths.manifestPath, buildManifest({ keyword: input.keyword, state, generatedAt, files: Object.fromEntries(requiredFiles.map((filePath) => [filePath, filePath])) }));
  const integrityReport = buildIntegrityReport({ paths, requiredFiles: [paths.manifestPath, ...requiredFiles] });
  writeJson(paths.packageIntegrityReportPath, integrityReport);
  writeKeywordPackageZip(paths);
  return {
    ...paths,
    uploadFileRefs: buildUploadRefs(paths),
    integrityStatus: integrityReport.status,
  };
};
