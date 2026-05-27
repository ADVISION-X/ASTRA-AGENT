import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type {
  AmazonExceptionRecord,
  AmazonReviewRecord,
  AmazonTaskRecord,
} from "./amazon-product-mining.package-artifact-builders.js";
import { toPackageRelativePath } from "./amazon-product-mining.package-evidence-shared.js";
import type { AmazonPackageKeywordEvidence } from "./amazon-product-mining.package-keyword-evidence.js";
import type { AmazonPackageLayout } from "./amazon-product-mining.package-layout.js";
import type { AmazonPackageProductEvidence } from "./amazon-product-mining.package-product-evidence.js";
import type { AmazonPackageReviewEvidence } from "./amazon-product-mining.package-review-evidence.js";
import type { PackageImageEvidenceIndex } from "./amazon-product-mining.package-completeness.js";
export { buildPackageIntegrityReport } from "./amazon-product-mining.package-integrity.js";
export type { PackageIntegrityReport } from "./amazon-product-mining.package-integrity.js";

export type PackageArtifactRef = {
  artifactId: string;
  type: string;
  category: string;
  fileRef: string;
};

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

export const collectKeywordReviewRefs = (input: {
  keyword: AmazonPackageKeywordEvidence;
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
}): string[] => {
  const linkedDetailIds = new Set(input.keyword.linkedDetailIds);
  return input.reviewArtifacts
    .filter((artifact) => linkedDetailIds.has(artifact.detailId))
    .flatMap((artifact) => [artifact.reviewsJsonlRef, artifact.reviewsSummaryRef, artifact.reviewPagesIndexRef]);
};

export const collectKeywordImageRefs = (input: {
  keyword: AmazonPackageKeywordEvidence;
  imageEvidenceIndex: PackageImageEvidenceIndex;
}): string[] => {
  const linkedDetailIds = new Set(input.keyword.linkedDetailIds);
  return input.imageEvidenceIndex.images
    .filter((image) => image.keywordId === input.keyword.keywordId || (image.detailId !== null && linkedDetailIds.has(image.detailId)))
    .map((image) => image.imageId);
};
