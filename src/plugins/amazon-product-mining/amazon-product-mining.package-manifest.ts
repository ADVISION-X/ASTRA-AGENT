import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type {
  AmazonExceptionRecord,
  AmazonProductDetail,
  AmazonReviewRecord,
  AmazonSearchResultItem,
  AmazonTaskRecord,
} from "./amazon-product-mining.package-artifact-builders.js";
import { toPackageRelativePath } from "./amazon-product-mining.package-evidence-shared.js";
import type { AmazonPackageKeywordEvidence } from "./amazon-product-mining.package-keyword-evidence.js";
import type { AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import type { AmazonPackageProductEvidence } from "./amazon-product-mining.package-product-evidence.js";
import type { AmazonPackageReviewEvidence } from "./amazon-product-mining.package-review-evidence.js";
import type { PackageImageEvidenceIndex } from "./amazon-product-mining.package-completeness.js";

export type PackageArtifactRef = {
  artifactId: string;
  type: string;
  category: string;
  fileRef: string;
};

export type PackageIntegrityReport = {
  taskId: string;
  status: "pass" | "failed";
  checks: Array<{ checkId: string; status: "pass" | "failed"; detail: string }>;
  failures: Array<{ checkId: string; detail: string }>;
};

type IntegrityCheckItem = PackageIntegrityReport["checks"][number];

export const buildPackageSchemaArtifact = () => ({
  schemaVersion: "2.0.0",
  packageType: "amazon-product-mining-master-evidence-package",
  requiredTopLevelKeys: [
    "schemaVersion",
    "packageType",
    "task",
    "aiKeywordRuns",
    "keywords",
    "searchResults",
    "searchResultProductLinks",
    "products",
    "reviewsIndex",
    "exceptions",
    "completeness",
    "artifacts",
    "handoff",
  ],
  packageSections: {
    manifest: [
      "manifest.json",
      "task-scope.json",
      "package-schema.json",
      "evidence-index.json",
      "image-evidence-index.json",
      "package-file-hashes.json",
      "business-boundary-notice.md",
    ],
    keywordEvidence: [
      "keyword-summary.json",
      "search-page-results.json",
      "search-page-results.csv",
      "search-page-raw-visible-text.txt",
    ],
    productEvidence: [
      "product-summary.json",
      "product-detail.json",
      "product-detail-raw-visible-text.txt",
      "product-images-index.json",
      "product-source-keywords.json",
    ],
    reviewEvidence: ["reviews.jsonl", "reviews-summary.json", "review-pages-index.json"],
    exceptionAndCompleteness: [
      "exception-summary.json",
      "manual-required.json",
      "failed-items.json",
      "data-completeness-report.json",
      "package-integrity-report.json",
    ],
  },
  gates: [
    "P0-1 Schema Gate",
    "P0-2 Reference Gate",
    "P0-3 Traceability Gate",
    "P0-4 Raw Evidence Gate",
    "P0-5 Image Evidence Gate",
    "P0-6 Completeness Gate",
    "P0-7 Review Limit Gate",
    "P0-8 AI Boundary Gate",
    "P0-9 Integrity Gate",
    "P0-10 Human Misuse Gate",
  ],
});

export const buildManifestArtifact = (input: {
  layout: AmazonPackageLayout;
  task: AmazonTaskRecord | null;
  keywordCount: number;
  searchResultCount: number;
  productCount: number;
  reviewCount: number;
  exceptionCount: number;
}) => ({
  schemaVersion: "2.0.0",
  packageType: "amazon-product-mining-master-evidence-package",
  taskId: input.task?.taskId ?? "unknown",
  generatedAt: new Date().toISOString(),
  packageRootRef: ".",
  taskScopeRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.taskScopePath),
  packageSchemaRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.packageSchemaPath),
  evidenceIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.evidenceIndexPath),
  imageEvidenceIndexRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.imageEvidenceIndexPath),
  packageFileHashesRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.packageFileHashesPath),
  businessBoundaryNoticeRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.businessBoundaryNoticePath),
  masterReport: {
    htmlRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.masterReportHtmlPath),
    pdfRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.pdfReportPath),
  },
  aiHandoff: {
    aiReadingContractRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.aiReadingContractPath),
    aiHandoffPromptRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.aiHandoffPromptPath),
    handoffRecordRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.handoffRecordPath),
  },
  exceptionAndCompleteness: {
    exceptionSummaryRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.exceptionSummaryPath),
    manualRequiredRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.manualRequiredPath),
    failedItemsRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.failedItemsPath),
    dataCompletenessReportRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.dataCompletenessReportPath),
    packageIntegrityReportRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.packageIntegrityReportPath),
  },
  counts: {
    keywords: input.keywordCount,
    searchResults: input.searchResultCount,
    products: input.productCount,
    reviews: input.reviewCount,
    exceptions: input.exceptionCount,
  },
});

const collectPackageFiles = (directoryPath: string): string[] =>
  readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directoryPath, entry.name);
      return entry.isDirectory() ? collectPackageFiles(fullPath) : [fullPath];
    })
    .sort((left, right) => left.localeCompare(right));

export const buildPackageFileHashes = (input: {
  taskId: string;
  layout: AmazonPackageLayout;
}) => {
  const files = collectPackageFiles(input.layout.packageRootPath)
    .filter((filePath) => filePath !== input.layout.packageFileHashesPath)
    .map((filePath) => ({
      fileRef: toPackageRelativePath(input.layout.packageRootPath, filePath),
      sha256: createHash("sha256").update(readFileSync(filePath)).digest("hex"),
      sizeBytes: statSync(filePath).size,
    }));
  return {
    taskId: input.taskId,
    algorithm: "sha256",
    selfHashIncluded: false,
    files: [
      ...files,
      {
        fileRef: toPackageRelativePath(input.layout.packageRootPath, input.layout.packageFileHashesPath),
        sha256: null,
        sizeBytes: null,
      },
    ],
  };
};

export const buildEvidenceIndex = (input: {
  taskId: string;
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  imageEvidenceIndex: PackageImageEvidenceIndex;
  artifactRefs: readonly PackageArtifactRef[];
}) => ({
  taskId: input.taskId,
  keywords: input.keywordArtifacts.map((keyword) => ({
    keywordId: keyword.keywordId,
    keyword: keyword.keyword,
    searchEvidenceRef: keyword.summaryRef,
    searchResultsRef: keyword.searchResultsRef,
    rawVisibleTextRef: keyword.rawVisibleTextRef,
    searchResultRefs: keyword.itemIds,
    productDetailRefs: keyword.linkedDetailIds,
    reviewRefs: collectKeywordReviewRefs({ keyword, reviewArtifacts: input.reviewArtifacts }),
    imageRefs: collectKeywordImageRefs({ keyword, imageEvidenceIndex: input.imageEvidenceIndex }),
    exceptionRefs: keyword.exceptionIds,
  })),
  products: input.productArtifacts.map((product) => ({
    detailId: product.detailId,
    asin: product.asin,
    productSummaryRef: product.summaryRef,
    productDetailRef: product.detailRef,
    rawVisibleTextRef: product.rawVisibleTextRef,
    imageEvidenceRef: product.imagesIndexRef,
    sourceKeywordIds: [...new Set(product.sourceKeywords.map((keyword) => keyword.keywordId))],
    sourceSearchItemRefs: product.sourceItemIds,
    reviewRefs: {
      reviewsJsonlRef: input.reviewArtifacts.find((artifact) => artifact.detailId === product.detailId)?.reviewsJsonlRef ?? null,
      reviewsSummaryRef: input.reviewArtifacts.find((artifact) => artifact.detailId === product.detailId)?.reviewsSummaryRef ?? null,
      reviewPagesIndexRef: input.reviewArtifacts.find((artifact) => artifact.detailId === product.detailId)?.reviewPagesIndexRef ?? null,
    },
    exceptionRefs: product.exceptionIds,
  })),
  reviews: input.reviewArtifacts.map((review) => ({
    detailId: review.detailId,
    reviewsJsonlRef: review.reviewsJsonlRef,
    reviewsSummaryRef: review.reviewsSummaryRef,
    reviewPagesIndexRef: review.reviewPagesIndexRef,
    capturedReviewCount: review.capturedReviewCount,
    pagesVisited: review.pagesVisited,
    reviewIds: (input.reviewsByDetailId.get(review.detailId) ?? []).map((row) => row.reviewId),
  })),
  artifacts: input.artifactRefs,
});

const collectKeywordReviewRefs = (input: {
  keyword: AmazonPackageKeywordEvidence;
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
}): string[] => {
  const linkedDetailIds = new Set(input.keyword.linkedDetailIds);
  return input.reviewArtifacts
    .filter((artifact) => linkedDetailIds.has(artifact.detailId))
    .flatMap((artifact) => [artifact.reviewsJsonlRef, artifact.reviewsSummaryRef, artifact.reviewPagesIndexRef]);
};

const collectKeywordImageRefs = (input: {
  keyword: AmazonPackageKeywordEvidence;
  imageEvidenceIndex: PackageImageEvidenceIndex;
}): string[] => {
  const linkedDetailIds = new Set(input.keyword.linkedDetailIds);
  return input.imageEvidenceIndex.images
    .filter((image) => image.keywordId === input.keyword.keywordId || (image.detailId !== null && linkedDetailIds.has(image.detailId)))
    .map((image) => image.imageId);
};

const collectMissingImageUrls = (input: {
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  imageEvidenceIndex: PackageImageEvidenceIndex;
}): string[] => {
  const indexedImageUrls = new Set(input.imageEvidenceIndex.images.map((image) => image.url));
  const expectedImageUrls = [
	    ...input.searchResults.map((item) => item.mainImageUrl).filter((url): url is string => Boolean(url)),
	    ...input.products.flatMap((product) => [product.mainImage, ...product.allVisibleImages]).filter((url): url is string => Boolean(url)),
	    ...[...input.reviewsByDetailId.values()].flatMap((reviews) => reviews.flatMap((review) => review.reviewImagesIfVisible)),
	    ...[...input.reviewsByDetailId.values()].flatMap((reviews) => reviews.flatMap((review) => review.reviewVideosIfVisible)),
	  ];
	  return [...new Set(expectedImageUrls.filter((url) => !indexedImageUrls.has(url)))];
	};

const buildIntegrityReportRefs = (layout: AmazonPackageLayout): string[] => [
  layout.manifestPath,
  layout.taskScopePath,
  layout.packageSchemaPath,
  layout.evidenceIndexPath,
  layout.imageEvidenceIndexPath,
  layout.packageFileHashesPath,
  layout.businessBoundaryNoticePath,
  layout.masterReportHtmlPath,
  layout.pdfReportPath,
  layout.exceptionSummaryPath,
  layout.manualRequiredPath,
  layout.failedItemsPath,
	  layout.dataCompletenessReportPath,
	  layout.aiReadingContractPath,
	  layout.aiHandoffPromptPath,
	  layout.handoffRecordPath,
	].map((filePath) => toPackageRelativePath(layout.packageRootPath, filePath));

const collectMissingProductTrace = (input: {
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
}): string[] =>
  input.productArtifacts
	    .filter((product) => product.sourceKeywords.length === 0 || product.sourceItemIds.length === 0 || !input.reviewArtifacts.some((review) => review.detailId === product.detailId))
	    .map((product) => product.detailId);

const collectExtractorMissingProductFields = (products: readonly AmazonPackageProductEvidence[]): string[] =>
  products.flatMap((product) => product.extractorMissingFields.map((fieldName) => `${product.detailId}:${fieldName}`));

const collectBrokenKeywordEvidenceChains = (input: {
  keywords: readonly AmazonPackageKeywordEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  imageEvidenceIndex: PackageImageEvidenceIndex;
}): string[] =>
  input.keywords
    .filter((keyword) => keyword.itemIds.length > 0 && (
      keyword.linkedDetailIds.length === 0
      || keyword.searchResultsRef.length === 0
      || keyword.rawVisibleTextRef.length === 0
      || collectKeywordReviewRefs({ keyword, reviewArtifacts: input.reviewArtifacts }).length === 0
      || collectKeywordImageRefs({ keyword, imageEvidenceIndex: input.imageEvidenceIndex }).length === 0
    ))
    .map((keyword) => keyword.keywordId);

const collectMasterReportChainFailures = (input: {
  layout: AmazonPackageLayout;
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  imageEvidenceIndex: PackageImageEvidenceIndex;
}): string[] => {
  if (!existsSync(input.layout.masterReportHtmlPath)) {
    return ["master_report_html_missing"];
  }
  const html = readFileSync(input.layout.masterReportHtmlPath, "utf8");
  const failures: string[] = [];
  if (!html.includes("Amazon Product Mining Master Evidence Report") || !html.includes("Chapter 6. Keyword Search Evidence")) {
    failures.push("master_report_primary_entry_missing");
  }
  for (const keyword of input.keywordArtifacts) {
    const firstItemId = keyword.itemIds[0];
    const firstDetailId = keyword.linkedDetailIds[0];
    const firstReviewRef = collectKeywordReviewRefs({ keyword, reviewArtifacts: input.reviewArtifacts })[0];
    const firstImageRef = collectKeywordImageRefs({ keyword, imageEvidenceIndex: input.imageEvidenceIndex })[0];
    if (!firstItemId || !firstDetailId) {
      continue;
    }
    if (
      !html.includes(keyword.keywordId)
      || !html.includes(firstItemId)
      || !html.includes(firstDetailId)
      || (firstReviewRef !== undefined && !html.includes(firstReviewRef))
      || (firstImageRef !== undefined && !html.includes(firstImageRef))
    ) {
      failures.push(keyword.keywordId);
    }
  }
  return failures;
};

const collectOrphanReviewIds = (input: {
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  products: readonly AmazonProductDetail[];
}): string[] => {
  const detailIds = new Set(input.products.map((product) => product.detailId));
  return [...input.reviewsByDetailId.entries()]
    .filter(([detailId]) => !detailIds.has(detailId))
    .flatMap(([, reviews]) => reviews.map((review) => review.reviewId));
};

const collectInvalidExceptionIds = (input: {
  taskId: string;
  exceptions: readonly AmazonExceptionRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}): string[] => {
  const itemIds = new Set(input.searchResults.map((item) => item.itemId));
  const detailIds = new Set(input.products.map((product) => product.detailId));
  const reviewIds = new Set([...input.reviewsByDetailId.values()].flatMap((reviews) => reviews.map((review) => review.reviewId)));
  return input.exceptions
    .filter((exception) => exception.scopeId && !itemIds.has(exception.scopeId) && !detailIds.has(exception.scopeId) && !reviewIds.has(exception.scopeId) && exception.scopeId !== input.taskId)
    .map((exception) => exception.exceptionId);
};

const buildManifestRefsCheck = (missingManifestRefs: readonly string[]): IntegrityCheckItem => ({
  checkId: "manifest_refs_exist",
  status: missingManifestRefs.length === 0 ? "pass" : "failed",
  detail: missingManifestRefs.length === 0
    ? "All manifest, report, exception, completeness, and boundary refs exist."
    : `Missing: ${missingManifestRefs.join(", ")}`,
});

const buildEvidenceRefsCheck = (missingArtifactRefs: readonly string[]): IntegrityCheckItem => ({
  checkId: "evidence_index_refs_exist",
  status: missingArtifactRefs.length === 0 ? "pass" : "failed",
  detail: missingArtifactRefs.length === 0
    ? "All evidence-index refs resolve to files."
    : `Missing: ${missingArtifactRefs.join(", ")}`,
});

const buildProductTraceCheck = (missingProductTrace: readonly string[]): IntegrityCheckItem => ({
  checkId: "product_traceability",
  status: missingProductTrace.length === 0 ? "pass" : "failed",
  detail: missingProductTrace.length === 0
    ? "Every product traces to keyword, search result item, detail, and review evidence."
    : `Missing trace: ${missingProductTrace.join(", ")}`,
});

const buildReviewTraceCheck = (orphanReviews: readonly string[]): IntegrityCheckItem => ({
  checkId: "review_traceability",
  status: orphanReviews.length === 0 ? "pass" : "failed",
  detail: orphanReviews.length === 0
    ? "Every review traces to a product detail."
    : `Orphan reviews: ${orphanReviews.join(", ")}`,
});

const buildExceptionTraceCheck = (invalidExceptions: readonly string[]): IntegrityCheckItem => ({
  checkId: "exception_traceability",
  status: invalidExceptions.length === 0 ? "pass" : "failed",
  detail: invalidExceptions.length === 0
    ? "Every exception scope resolves to task, search item, detail, or review."
    : `Unresolved exceptions: ${invalidExceptions.join(", ")}`,
});

const buildImageCoverageCheck = (missingImageUrls: readonly string[]): IntegrityCheckItem => ({
  checkId: "image_evidence_coverage",
  status: missingImageUrls.length === 0 ? "pass" : "failed",
  detail: missingImageUrls.length === 0
    ? "All image and review video URLs are registered in image-evidence-index."
    : `Missing image or review video URLs: ${missingImageUrls.join(", ")}`,
});

const buildKeywordChainCheck = (brokenKeywordEvidenceChains: readonly string[]): IntegrityCheckItem => ({
  checkId: "keyword_evidence_chain_closure",
  status: brokenKeywordEvidenceChains.length === 0 ? "pass" : "failed",
  detail: brokenKeywordEvidenceChains.length === 0
    ? "Every mined keyword with search results links to search evidence, raw evidence, product detail refs, review refs, and image refs."
    : `Broken keyword chains: ${brokenKeywordEvidenceChains.join(", ")}`,
});

const buildMasterReportChainCheck = (masterReportChainFailures: readonly string[]): IntegrityCheckItem => ({
  checkId: "master_report_chain_readability",
  status: masterReportChainFailures.length === 0 ? "pass" : "failed",
  detail: masterReportChainFailures.length === 0
    ? "Master Evidence Report exposes keyword -> search result -> product detail -> reviews -> images evidence refs."
    : `Master report chain gaps: ${masterReportChainFailures.join(", ")}`,
});

const buildExtractorCoverageCheck = (extractorMissingProductFields: readonly string[]): IntegrityCheckItem => ({
  checkId: "extractor_missing_zero_tolerance",
  status: extractorMissingProductFields.length === 0 ? "pass" : "failed",
  detail: extractorMissingProductFields.length === 0
    ? "No product field is marked extractor_missing."
    : `Extractor missing fields: ${extractorMissingProductFields.join(", ")}`,
});

const buildStructuredPackageCheck = (input: {
  layout: AmazonPackageLayout;
  packageType: string;
  taskScope: Record<string, unknown>;
}): IntegrityCheckItem => ({
  checkId: "structured_package_primary",
  status: existsSync(input.layout.packageJsonPath) && input.packageType === "amazon-product-mining-master-evidence-package" ? "pass" : "failed",
  detail: existsSync(input.layout.packageJsonPath)
    ? `Structured package exists with taskStatus=${String(input.taskScope["status"] ?? "unknown")}.`
    : "Structured package is missing.",
});

const buildIntegrityChecks = (input: {
  layout: AmazonPackageLayout;
  packageType: string;
  taskScope: Record<string, unknown>;
  missingManifestRefs: readonly string[];
  missingArtifactRefs: readonly string[];
	  missingProductTrace: readonly string[];
	  orphanReviews: readonly string[];
	  invalidExceptions: readonly string[];
	  missingImageUrls: readonly string[];
	  brokenKeywordEvidenceChains: readonly string[];
	  masterReportChainFailures: readonly string[];
	  extractorMissingProductFields: readonly string[];
	}): PackageIntegrityReport["checks"] => [
	  buildManifestRefsCheck(input.missingManifestRefs),
	  buildEvidenceRefsCheck(input.missingArtifactRefs),
	  buildKeywordChainCheck(input.brokenKeywordEvidenceChains),
	  buildProductTraceCheck(input.missingProductTrace),
	  buildReviewTraceCheck(input.orphanReviews),
	  buildExceptionTraceCheck(input.invalidExceptions),
	  buildImageCoverageCheck(input.missingImageUrls),
	  buildMasterReportChainCheck(input.masterReportChainFailures),
	  buildExtractorCoverageCheck(input.extractorMissingProductFields),
	  buildStructuredPackageCheck(input),
	];

export const buildPackageIntegrityReport = (input: {
  taskId: string;
  layout: AmazonPackageLayout;
  taskScope: Record<string, unknown>;
	  packageType: string;
	  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
	  productArtifacts: readonly AmazonPackageProductEvidence[];
	  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptions: readonly AmazonExceptionRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  imageEvidenceIndex: PackageImageEvidenceIndex;
  artifactRefs: readonly PackageArtifactRef[];
}): PackageIntegrityReport => {
  const fileExists = (fileRef: string): boolean => existsSync(join(input.layout.packageRootPath, fileRef));
  const missingImageUrls = collectMissingImageUrls(input);
  const reportRefs = buildIntegrityReportRefs(input.layout);
  const missingManifestRefs = reportRefs.filter((fileRef) => !fileExists(fileRef));
  const integritySelfRef = toPackageRelativePath(input.layout.packageRootPath, input.layout.packageIntegrityReportPath);
  const missingArtifactRefs = input.artifactRefs.map((artifact) => artifact.fileRef).filter((fileRef) => fileRef !== integritySelfRef).filter((fileRef) => !fileExists(fileRef));
	  const missingProductTrace = collectMissingProductTrace(input);
	  const orphanReviews = collectOrphanReviewIds(input);
	  const invalidExceptions = collectInvalidExceptionIds(input);
	  const brokenKeywordEvidenceChains = collectBrokenKeywordEvidenceChains({
	    keywords: input.keywordArtifacts,
	    reviewArtifacts: input.reviewArtifacts,
	    imageEvidenceIndex: input.imageEvidenceIndex,
	  });
	  const masterReportChainFailures = collectMasterReportChainFailures({
	    layout: input.layout,
	    keywordArtifacts: input.keywordArtifacts,
	    reviewArtifacts: input.reviewArtifacts,
	    imageEvidenceIndex: input.imageEvidenceIndex,
	  });
	  const extractorMissingProductFields = collectExtractorMissingProductFields(input.productArtifacts);
	  const checks = buildIntegrityChecks({
	    layout: input.layout,
	    packageType: input.packageType,
    taskScope: input.taskScope,
    missingManifestRefs,
    missingArtifactRefs,
    missingProductTrace,
	    orphanReviews,
	    invalidExceptions,
	    missingImageUrls,
	    brokenKeywordEvidenceChains,
	    masterReportChainFailures,
	    extractorMissingProductFields,
	  });
  const failures = checks.filter((check) => check.status === "failed").map((check) => ({ checkId: check.checkId, detail: check.detail }));
  return {
    taskId: input.taskId,
    status: failures.length === 0 ? "pass" : "failed",
    checks,
    failures,
  };
};
