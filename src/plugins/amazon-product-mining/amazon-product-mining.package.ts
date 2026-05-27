import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  createAmazonPackageLayout,
  type AmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
import {
  writeKeywordEvidenceArtifacts,
  writeProductEvidenceArtifacts,
  writeReviewEvidenceArtifacts,
  type AmazonPackageKeywordEvidence,
  type AmazonPackageProductEvidence,
  type AmazonPackageReviewEvidence,
} from "./amazon-product-mining.package-evidence-sections.js";
import {
  writeJsonFile,
  type AmazonExceptionRecord,
  type AmazonKeywordRecord,
  type AmazonProductDetail,
  type AmazonReviewRecord,
  type AmazonSearchResultItem,
  type AmazonTaskRecord,
} from "./amazon-product-mining.package-artifact-builders.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type AmazonPackageResult = {
  packageRootPath: string;
  packageJsonPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  imageEvidenceIndexPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  masterReportHtmlPath: string;
  handoffRecordPath: string;
  integrityStatus: "pass" | "failed";
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  searchResultCount: number;
};

type AmazonPackageBuildInput = {
  taskId: string;
  dataDir: string;
  storage: AmazonMiningStorage;
  reviewMaxPages?: number;
};

type AmazonAiKeywordRunRecord = ReturnType<AmazonMiningStorage["getAiKeywordRunsForTask"]>[number];
type AmazonSearchResultProductLink = ReturnType<AmazonMiningStorage["getSearchResultProductLinksForTask"]>[number];

type PackageStatusItem = {
  scope: string;
  scopeId: string | null;
  status: string;
  reason: string | null;
  exceptionRefs: string[];
};

type PackageArtifactRef = {
  artifactId: string;
  type: string;
  category: string;
  fileRef: string;
};

type PackageIntegrityReport = {
  taskId: string;
  status: "pass" | "failed";
  checks: Array<{ checkId: string; status: "pass" | "failed"; detail: string }>;
  failures: Array<{ checkId: string; detail: string }>;
};

const toPackageRelativePath = (packageRootPath: string, filePath: string): string =>
  relative(packageRootPath, filePath).split("\\").join("/");

const writeTextFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
};

const buildExceptionScopeMap = (exceptions: readonly AmazonExceptionRecord[]): Map<string, string[]> => {
  const scopeMap = new Map<string, string[]>();
  for (const exception of exceptions) {
    if (!exception.scopeId) continue;
    const ids = scopeMap.get(exception.scopeId) ?? [];
    ids.push(exception.exceptionId);
    scopeMap.set(exception.scopeId, ids);
  }
  return scopeMap;
};

const buildLinkedSearchItemsByDetailId = (
  allSearchResults: readonly AmazonSearchResultItem[],
  links: readonly AmazonSearchResultProductLink[],
): Map<string, AmazonSearchResultItem[]> => {
  const itemsById = new Map(allSearchResults.map((item) => [item.itemId, item]));
  const linkedSearchItems = new Map<string, AmazonSearchResultItem[]>();

  for (const link of links) {
    const item = itemsById.get(link.itemId);
    if (!item) continue;
    const rows = linkedSearchItems.get(link.detailId) ?? [];
    rows.push(item);
    linkedSearchItems.set(link.detailId, rows);
  }

  for (const rows of linkedSearchItems.values()) {
    rows.sort((left, right) => left.rankPosition - right.rankPosition);
  }

  return linkedSearchItems;
};

const writeAiKeywordRunArtifacts = (input: {
  layout: AmazonPackageLayout;
  aiKeywordRuns: readonly AmazonAiKeywordRunRecord[];
}) =>
  input.aiKeywordRuns.map((run) => {
    const runDir = join(input.layout.aiKeywordRunsDir, `run-${run.runId}`);
    mkdirSync(runDir, { recursive: true });
    writeTextFile(join(runDir, "prompt.txt"), run.promptText);
    writeTextFile(join(runDir, "raw-response.txt"), run.rawResponse);
    return {
      runId: run.runId,
      promptTextRef: toPackageRelativePath(input.layout.packageRootPath, join(runDir, "prompt.txt")),
      rawResponseRef: toPackageRelativePath(input.layout.packageRootPath, join(runDir, "raw-response.txt")),
      parsedKeywords: run.parsedKeywords,
      dedupedKeywords: run.dedupedKeywords,
      status: run.status,
      failureReason: run.failureReason,
      createdAt: run.createdAt,
    };
  });

const buildImageEvidenceIndex = (input: {
  taskId: string;
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}) => {
  const images: Array<{
    imageId: string;
    imageType: string;
    source: string;
    taskId: string;
    keywordId: string | null;
    itemId: string | null;
    detailId: string | null;
    reviewId: string | null;
    asin: string | null;
    url: string;
    localFileRef: null;
    hash: null;
    caption: string;
    appearsInMasterReport: true;
  }> = [];

  const pushImage = (entry: Omit<(typeof images)[number], "imageId">) => {
    images.push({ imageId: `image-${images.length + 1}`, ...entry });
  };

  for (const item of input.searchResults) {
    if (!item.mainImageUrl) continue;
    pushImage({
      imageType: "search_main_image",
      source: "search_result",
      taskId: input.taskId,
      keywordId: item.keywordId,
      itemId: item.itemId,
      detailId: null,
      reviewId: null,
      asin: item.asinIfAvailable,
      url: item.mainImageUrl,
      localFileRef: null,
      hash: null,
      caption: item.title ?? item.keyword,
      appearsInMasterReport: true,
    });
  }

  for (const product of input.products) {
    if (product.mainImage) {
      pushImage({
        imageType: "product_main_image",
        source: "product_detail",
        taskId: input.taskId,
        keywordId: null,
        itemId: null,
        detailId: product.detailId,
        reviewId: null,
        asin: product.asin,
        url: product.mainImage,
        localFileRef: null,
        hash: null,
        caption: product.title ?? product.asin ?? product.detailId,
        appearsInMasterReport: true,
      });
    }
    for (const imageUrl of product.allVisibleImages) {
      pushImage({
        imageType: "product_gallery_image",
        source: "product_detail",
        taskId: input.taskId,
        keywordId: null,
        itemId: null,
        detailId: product.detailId,
        reviewId: null,
        asin: product.asin,
        url: imageUrl,
        localFileRef: null,
        hash: null,
        caption: product.title ?? product.asin ?? product.detailId,
        appearsInMasterReport: true,
      });
    }
  }

  for (const [detailId, reviews] of input.reviewsByDetailId.entries()) {
    for (const review of reviews) {
      for (const imageUrl of review.reviewImagesIfVisible) {
        pushImage({
          imageType: "review_image",
          source: "review",
          taskId: input.taskId,
          keywordId: null,
          itemId: null,
          detailId,
          reviewId: review.reviewId,
          asin: review.asin,
          url: imageUrl,
          localFileRef: null,
          hash: null,
          caption: review.reviewTitle ?? review.reviewId,
          appearsInMasterReport: true,
        });
      }
    }
  }

  return {
    taskId: input.taskId,
    mode: "url_only",
    warning: "Images are URL evidence unless localFileRef is present.",
    images,
  };
};

const buildStatusItems = (input: {
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  products: readonly AmazonProductDetail[];
  exceptions: readonly AmazonExceptionRecord[];
  status: "manual_required" | "failed";
}): { taskId: string; count: number; items: PackageStatusItem[] } => {
  const items: PackageStatusItem[] = [];
  const seen = new Set<string>();
  const exceptionScopeMap = buildExceptionScopeMap(input.exceptions);
  const manualRegex = /(manual|required|captcha|login|blocked|restricted)/i;

  const pushItem = (item: PackageStatusItem) => {
    const key = `${item.scope}:${item.scopeId ?? "task"}:${item.status}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  if (input.task && input.task.status === input.status) {
    pushItem({
      scope: "task",
      scopeId: input.task.taskId,
      status: input.task.status,
      reason: input.task.failureReason,
      exceptionRefs: [],
    });
  }

  for (const keyword of input.keywords) {
    if (keyword.status !== input.status) continue;
    pushItem({
      scope: "keyword",
      scopeId: keyword.keywordId,
      status: keyword.status,
      reason: keyword.reason,
      exceptionRefs: exceptionScopeMap.get(keyword.keywordId) ?? [],
    });
  }

  for (const product of input.products) {
    if (product.status !== input.status) continue;
    pushItem({
      scope: "product",
      scopeId: product.detailId,
      status: product.status,
      reason: product.failureReason,
      exceptionRefs: exceptionScopeMap.get(product.detailId) ?? [],
    });
  }

  for (const exception of input.exceptions) {
    const isManualException = manualRegex.test(exception.exceptionKind) || manualRegex.test(exception.message);
    if ((input.status === "manual_required" && !isManualException) || (input.status === "failed" && isManualException)) {
      continue;
    }
    pushItem({
      scope: exception.scope,
      scopeId: exception.scopeId,
      status: input.status,
      reason: exception.message,
      exceptionRefs: [exception.exceptionId],
    });
  }

  return {
    taskId: input.task?.taskId ?? input.keywords[0]?.taskId ?? input.products[0]?.taskId ?? "unknown",
    count: items.length,
    items,
  };
};

const buildCompletenessReport = (input: {
  taskId: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  exceptions: readonly AmazonExceptionRecord[];
  manualRequiredItems: { count: number };
  failedItems: { count: number };
  reviewMaxPages?: number;
}) => {
  const reviewArtifactsByDetailId = new Map(input.reviewArtifacts.map((artifact) => [artifact.detailId, artifact]));
  const productArtifactsByDetailId = new Map(input.productArtifacts.map((artifact) => [artifact.detailId, artifact]));

  return {
    taskId: input.taskId,
    summary: {
      keywordCountRequested: input.task?.requestedKeywordCount ?? input.keywords.length,
      keywordCountGenerated: input.keywords.length,
      keywordCountCompleted: input.keywords.filter((keyword) => keyword.status === "completed" || keyword.status === "completed_with_errors").length,
      searchResultCount: input.searchResults.length,
      uniqueProductDetailCount: input.products.length,
      reviewCount: [...input.reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0),
      exceptionCount: input.exceptions.length,
      manualRequiredCount: input.manualRequiredItems.count,
      failedCount: input.failedItems.count,
      packageCompletenessStatus: input.manualRequiredItems.count === 0 && input.failedItems.count === 0 ? "complete" : "incomplete",
      reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
    },
    products: input.products.map((product) => {
      const reviewRows = input.reviewsByDetailId.get(product.detailId) ?? [];
      const productArtifact = productArtifactsByDetailId.get(product.detailId);
      const reviewArtifact = reviewArtifactsByDetailId.get(product.detailId);
      const hasReviewRawText = reviewRows.some((review) => Boolean(review.rawReviewTextSnapshot));
      const reviewRestriction = reviewArtifact?.warnings.some((warning) => warning.includes("maxPages"))
        ? "max_pages_limit"
        : product.status === "manual_required" ? "manual_required" : null;
      return {
        detailId: product.detailId,
        asin: product.asin,
        detailStatus: product.status,
        reviewStatus: reviewArtifact?.reviewStatus ?? product.status,
        reviewPagesVisited: reviewArtifact?.pagesVisited ?? 0,
        reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
        reviewRestriction,
        manualRequired: product.status === "manual_required",
        hasRawDetailText: Boolean(product.rawVisibleTextSnapshot),
        hasMainImage: Boolean(product.mainImage),
        hasGalleryImages: product.allVisibleImages.length > 0,
        hasBulletPoints: product.bulletPoints.length > 0,
        hasDescription: Boolean(product.productDescription || product.aboutThisItem),
        hasTechnicalDetails: Boolean(product.technicalDetails || product.productInformation),
        hasReviews: reviewRows.length > 0,
        hasReviewRawText,
        missingFields: productArtifact?.missingFields ?? [],
        dataCompletenessScore: productArtifact?.completenessScore ?? 0,
        warnings: [
          ...(productArtifact?.warnings ?? []),
          ...(reviewArtifact?.warnings ?? []),
        ],
      };
    }),
  };
};

const buildPackageSchemaArtifact = () => ({
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
    reviewEvidence: [
      "reviews.jsonl",
      "reviews-summary.json",
      "review-pages-index.json",
    ],
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

const buildManifestArtifact = (input: {
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

const buildPackageFileHashes = (input: {
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

const buildEvidenceIndex = (input: {
  taskId: string;
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
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

const buildPackageIntegrityReport = (input: {
  taskId: string;
  layout: AmazonPackageLayout;
  taskScope: Record<string, unknown>;
  packageType: string;
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptions: readonly AmazonExceptionRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  imageEvidenceIndex: { images: Array<{ url: string }> };
  artifactRefs: readonly PackageArtifactRef[];
}): PackageIntegrityReport => {
  const fileExists = (fileRef: string): boolean => existsSync(join(input.layout.packageRootPath, fileRef));
  const itemIds = new Set(input.searchResults.map((item) => item.itemId));
  const detailIds = new Set(input.products.map((product) => product.detailId));
  const reviewIds = new Set([...input.reviewsByDetailId.values()].flatMap((reviews) => reviews.map((review) => review.reviewId)));
  const indexedImageUrls = new Set(input.imageEvidenceIndex.images.map((image) => image.url));
  const allExpectedImageUrls = [
    ...input.searchResults.map((item) => item.mainImageUrl).filter((url): url is string => Boolean(url)),
    ...input.products.flatMap((product) => [product.mainImage, ...product.allVisibleImages]).filter((url): url is string => Boolean(url)),
    ...[...input.reviewsByDetailId.values()].flatMap((reviews) => reviews.flatMap((review) => review.reviewImagesIfVisible)),
  ];
  const missingImageUrls = [...new Set(allExpectedImageUrls.filter((url) => !indexedImageUrls.has(url)))];
  const reportRefs = [
    toPackageRelativePath(input.layout.packageRootPath, input.layout.manifestPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.taskScopePath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.packageSchemaPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.evidenceIndexPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.imageEvidenceIndexPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.packageFileHashesPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.businessBoundaryNoticePath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.masterReportHtmlPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.pdfReportPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.exceptionSummaryPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.manualRequiredPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.failedItemsPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.dataCompletenessReportPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.aiReadingContractPath),
    toPackageRelativePath(input.layout.packageRootPath, input.layout.aiHandoffPromptPath),
  ];
  const missingManifestRefs = reportRefs.filter((fileRef) => !fileExists(fileRef));
  const integritySelfRef = toPackageRelativePath(input.layout.packageRootPath, input.layout.packageIntegrityReportPath);
  const missingArtifactRefs = input.artifactRefs
    .map((artifact) => artifact.fileRef)
    .filter((fileRef) => fileRef !== integritySelfRef)
    .filter((fileRef) => !fileExists(fileRef));
  const missingProductTrace = input.productArtifacts
    .filter((product) => product.sourceKeywords.length === 0 || product.sourceItemIds.length === 0 || !input.reviewArtifacts.some((review) => review.detailId === product.detailId))
    .map((product) => product.detailId);
  const orphanReviews = [...input.reviewsByDetailId.entries()]
    .filter(([detailId]) => !detailIds.has(detailId))
    .flatMap(([, reviews]) => reviews.map((review) => review.reviewId));
  const invalidExceptions = input.exceptions
    .filter((exception) => {
      if (!exception.scopeId) return false;
      return !itemIds.has(exception.scopeId)
        && !detailIds.has(exception.scopeId)
        && !reviewIds.has(exception.scopeId)
        && exception.scopeId !== input.taskId;
    })
    .map((exception) => exception.exceptionId);
  const checks: PackageIntegrityReport["checks"] = [
    {
      checkId: "manifest_refs_exist",
      status: missingManifestRefs.length === 0 ? "pass" : "failed",
      detail: missingManifestRefs.length === 0 ? "All manifest, report, exception, completeness, and boundary refs exist." : `Missing: ${missingManifestRefs.join(", ")}`,
    },
    {
      checkId: "evidence_index_refs_exist",
      status: missingArtifactRefs.length === 0 ? "pass" : "failed",
      detail: missingArtifactRefs.length === 0 ? "All evidence-index refs resolve to files." : `Missing: ${missingArtifactRefs.join(", ")}`,
    },
    {
      checkId: "product_traceability",
      status: missingProductTrace.length === 0 ? "pass" : "failed",
      detail: missingProductTrace.length === 0 ? "Every product traces to keyword, search result item, detail, and review evidence." : `Missing trace: ${missingProductTrace.join(", ")}`,
    },
    {
      checkId: "review_traceability",
      status: orphanReviews.length === 0 ? "pass" : "failed",
      detail: orphanReviews.length === 0 ? "Every review traces to a product detail." : `Orphan reviews: ${orphanReviews.join(", ")}`,
    },
    {
      checkId: "exception_traceability",
      status: invalidExceptions.length === 0 ? "pass" : "failed",
      detail: invalidExceptions.length === 0 ? "Every exception scope resolves to task, search item, detail, or review." : `Unresolved exceptions: ${invalidExceptions.join(", ")}`,
    },
    {
      checkId: "image_evidence_coverage",
      status: missingImageUrls.length === 0 ? "pass" : "failed",
      detail: missingImageUrls.length === 0 ? "All image URLs are registered in image-evidence-index." : `Missing image URLs: ${missingImageUrls.join(", ")}`,
    },
    {
      checkId: "structured_package_primary",
      status: existsSync(input.layout.packageJsonPath) && input.packageType === "amazon-product-mining-master-evidence-package" ? "pass" : "failed",
      detail: existsSync(input.layout.packageJsonPath)
        ? `Structured package exists with taskStatus=${String(input.taskScope["status"] ?? "unknown")}.`
        : "Structured package is missing.",
    },
  ];
  const failures = checks
    .filter((check) => check.status === "failed")
    .map((check) => ({ checkId: check.checkId, detail: check.detail }));
  return {
    taskId: input.taskId,
    status: failures.length === 0 ? "pass" : "failed",
    checks,
    failures,
  };
};

export const buildAmazonProductMiningPackage = async (input: AmazonPackageBuildInput): Promise<AmazonPackageResult> => {
  const layout = createAmazonPackageLayout({ dataDir: input.dataDir, taskId: input.taskId });
  const generatedAt = new Date().toISOString();
  const task = input.storage.getTask(input.taskId);
  const keywords = input.storage.getKeywordsForTask(input.taskId);
  const aiKeywordRuns = input.storage.getAiKeywordRunsForTask(input.taskId);
  const exceptions = input.storage.getExceptionsForTask(input.taskId);
  const links = input.storage.getSearchResultProductLinksForTask(input.taskId);
  const searchResultsByKeyword = new Map<string, AmazonSearchResultItem[]>();
  for (const keyword of keywords) {
    searchResultsByKeyword.set(keyword.keywordId, input.storage.getSearchResultsForKeyword(keyword.keywordId));
  }
  const allSearchResults = [...searchResultsByKeyword.values()].flat();
  const products = input.storage.getProductDetailsForTask(input.taskId);
  const reviewsByDetailId = new Map<string, AmazonReviewRecord[]>();
  for (const product of products) {
    reviewsByDetailId.set(product.detailId, input.storage.getReviewsForProduct(product.detailId));
  }
  const totalReviews = [...reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0);
  const detailIdsByItemId = new Map<string, string[]>();
  for (const link of links) {
    const detailIds = detailIdsByItemId.get(link.itemId) ?? [];
    detailIds.push(link.detailId);
    detailIdsByItemId.set(link.itemId, detailIds);
  }
  const exceptionIdsByScopeId = buildExceptionScopeMap(exceptions);
  const linkedSearchItemsByDetailId = buildLinkedSearchItemsByDetailId(allSearchResults, links);

  const keywordArtifacts = writeKeywordEvidenceArtifacts({
    layout,
    keywords,
    searchResultsByKeyword,
    detailIdsByItemId,
    exceptionIdsByScopeId,
  });
  const reviewArtifacts = writeReviewEvidenceArtifacts({
    layout,
    products,
    reviewsByDetailId,
    ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
  });
  const reviewArtifactsByDetailId = new Map(reviewArtifacts.map((artifact) => [artifact.detailId, artifact]));
  const productArtifacts = writeProductEvidenceArtifacts({
    layout,
    products,
    linkedSearchItemsByDetailId,
    reviewArtifactsByDetailId,
    reviewsByDetailId,
    exceptionIdsByScopeId,
  });
  const aiKeywordRunArtifacts = writeAiKeywordRunArtifacts({ layout, aiKeywordRuns });

  const manualRequiredItems = buildStatusItems({
    task,
    keywords,
    products,
    exceptions,
    status: "manual_required",
  });
  const failedItems = buildStatusItems({
    task,
    keywords,
    products,
    exceptions,
    status: "failed",
  });
  const completenessReport = buildCompletenessReport({
    taskId: input.taskId,
    task,
    keywords,
    searchResults: allSearchResults,
    products,
    reviewsByDetailId,
    productArtifacts,
    reviewArtifacts,
    exceptions,
    manualRequiredItems,
    failedItems,
    ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
  });
  const imageEvidenceIndex = buildImageEvidenceIndex({
    taskId: input.taskId,
    searchResults: allSearchResults,
    products,
    reviewsByDetailId,
  });
  const taskScope = {
    taskId: task?.taskId ?? input.taskId,
    amazonMarketplace: task?.amazonMarketplace ?? "unknown",
    targetMarket: task?.targetMarket ?? "unknown",
    productDirection: task?.productDirection ?? "unknown",
    requestedKeywordCount: task?.requestedKeywordCount ?? keywords.length,
    languagePreference: task?.languagePreference ?? "en",
    status: task?.status ?? "unknown",
    failureReason: task?.failureReason ?? null,
    handoffStatus: task?.handoffStatus ?? "not_started",
    reviewMaxPagesConfigured: input.reviewMaxPages ?? null,
    createdAt: task?.createdAt ?? generatedAt,
    updatedAt: task?.updatedAt ?? null,
  };
  const exceptionSummary = {
    taskId: input.taskId,
    totalExceptions: exceptions.length,
    manualRequiredCount: manualRequiredItems.count,
    failedCount: failedItems.count,
    exceptions,
  };

  writeJsonFile(layout.taskScopePath, taskScope);
  writeJsonFile(layout.imageEvidenceIndexPath, imageEvidenceIndex);
  writeJsonFile(layout.exceptionSummaryPath, exceptionSummary);
  writeJsonFile(layout.manualRequiredPath, manualRequiredItems);
  writeJsonFile(layout.failedItemsPath, failedItems);
  writeJsonFile(layout.dataCompletenessReportPath, completenessReport);
  writeJsonFile(layout.packageSchemaPath, buildPackageSchemaArtifact());

  const packageArtifacts = {
    rootPackageRef: toPackageRelativePath(layout.packageRootPath, layout.packageJsonPath),
    manifestRef: toPackageRelativePath(layout.packageRootPath, layout.manifestPath),
    taskScopeRef: toPackageRelativePath(layout.packageRootPath, layout.taskScopePath),
    packageSchemaRef: toPackageRelativePath(layout.packageRootPath, layout.packageSchemaPath),
    evidenceIndexRef: toPackageRelativePath(layout.packageRootPath, layout.evidenceIndexPath),
    imageEvidenceIndexRef: toPackageRelativePath(layout.packageRootPath, layout.imageEvidenceIndexPath),
    packageFileHashesRef: toPackageRelativePath(layout.packageRootPath, layout.packageFileHashesPath),
    businessBoundaryNoticeRef: toPackageRelativePath(layout.packageRootPath, layout.businessBoundaryNoticePath),
    masterReport: {
      htmlRef: toPackageRelativePath(layout.packageRootPath, layout.masterReportHtmlPath),
      pdfRef: toPackageRelativePath(layout.packageRootPath, layout.pdfReportPath),
    },
    exceptionSummaryRef: toPackageRelativePath(layout.packageRootPath, layout.exceptionSummaryPath),
    manualRequiredRef: toPackageRelativePath(layout.packageRootPath, layout.manualRequiredPath),
    failedItemsRef: toPackageRelativePath(layout.packageRootPath, layout.failedItemsPath),
    dataCompletenessReportRef: toPackageRelativePath(layout.packageRootPath, layout.dataCompletenessReportPath),
    packageIntegrityReportRef: toPackageRelativePath(layout.packageRootPath, layout.packageIntegrityReportPath),
    aiHandoff: {
      aiReadingContractRef: toPackageRelativePath(layout.packageRootPath, layout.aiReadingContractPath),
      aiHandoffPromptRef: toPackageRelativePath(layout.packageRootPath, layout.aiHandoffPromptPath),
      handoffRecordRef: toPackageRelativePath(layout.packageRootPath, layout.handoffRecordPath),
    },
  };

  const keywordById = new Map(keywords.map((keyword) => [keyword.keywordId, keyword]));
  const packageJson = {
    schemaVersion: "2.0.0",
    packageType: "amazon-product-mining-master-evidence-package",
    generatedAt,
    task: taskScope,
    aiKeywordRuns: aiKeywordRunArtifacts,
    keywords: keywordArtifacts.map((keyword) => ({
      keywordId: keyword.keywordId,
      keyword: keyword.keyword,
      source: "ai_generated",
      aiRunId: keywordById.get(keyword.keywordId)?.aiRunId ?? null,
      reason: keywordById.get(keyword.keywordId)?.reason ?? null,
      status: keyword.status,
      searchUrl: keyword.searchUrl,
      searchResultCount: keyword.itemIds.length,
      sponsoredCount: keyword.sponsoredCount,
      organicCount: keyword.organicCount,
      searchEvidenceRef: keyword.summaryRef,
      searchResultsRef: keyword.searchResultsRef,
      searchResultsCsvRef: keyword.searchResultsCsvRef,
      rawVisibleTextRef: keyword.rawVisibleTextRef,
      topProducts: keyword.topProducts,
      exceptionRefs: keyword.exceptionIds,
    })),
    searchResults: allSearchResults.map((item) => ({
      itemId: item.itemId,
      keywordId: item.keywordId,
      keyword: item.keyword,
      searchUrl: item.searchUrl,
      rankPosition: item.rankPosition,
      isSponsored: item.isSponsored,
      title: item.title,
      productUrl: item.productUrl,
      asinIfAvailable: item.asinIfAvailable,
      mainImageUrl: item.mainImageUrl,
      price: item.price,
      rating: item.rating,
      reviewCount: item.reviewCount,
      primeOrFbaFlagIfVisible: item.primeOrFbaFlagIfVisible,
      couponTextIfVisible: item.couponTextIfVisible,
      deliveryTextIfVisible: item.deliveryTextIfVisible,
      detailRefs: detailIdsByItemId.get(item.itemId) ?? [],
      rawVisibleTextRef: keywordArtifacts.find((keyword) => keyword.keywordId === item.keywordId)?.rawVisibleTextRef ?? null,
      createdAt: item.createdAt,
    })),
    searchResultProductLinks: links.map((link) => ({
      itemId: link.itemId,
      detailId: link.detailId,
    })),
    products: products.map((product) => {
      const productArtifact = productArtifacts.find((artifact) => artifact.detailId === product.detailId);
      const reviewArtifact = reviewArtifacts.find((artifact) => artifact.detailId === product.detailId);
      return {
        detailId: product.detailId,
        asin: product.asin,
        productUrl: product.productUrl,
        identity: {
          title: product.title,
          brand: product.brand,
          sellerOrStoreIfVisible: product.sellerOrStoreIfVisible,
        },
        images: {
          mode: "url_only",
          mainImageUrl: product.mainImage,
          galleryImageUrls: product.allVisibleImages,
          visibleVideoInfo: product.visibleVideoInfo,
          productImagesIndexRef: productArtifact?.imagesIndexRef ?? null,
        },
        commerce: {
          currentPrice: product.currentPrice,
          originalPriceDiscountCouponIfVisible: product.originalPriceDiscountCouponIfVisible,
          rating: product.rating,
          reviewCount: product.reviewCount,
          bestSellersRankIfVisible: product.bestSellersRankIfVisible,
          categoryPathIfVisible: product.categoryPathIfVisible,
          deliveryInformation: product.deliveryInformation,
          returnInformation: product.returnInformation,
        },
        listing: {
          bulletPoints: product.bulletPoints,
          aboutThisItem: product.aboutThisItem,
          productDescription: product.productDescription,
          aPlusContentIfVisible: product.aPlusContentIfVisible,
        },
        parameters: {
          variationOptions: product.variationOptions,
          colorSizeStyleOptions: product.colorSizeStyleOptions,
          productInformation: product.productInformation,
          technicalDetails: product.technicalDetails,
          additionalInformation: product.additionalInformation,
          allOtherVisibleProductParameters: product.allOtherVisibleProductParameters,
        },
        relatedModules: {
          qaContentIfVisible: product.qaContentIfVisible,
          frequentlyBoughtTogetherIfVisible: product.frequentlyBoughtTogetherIfVisible,
          customersAlsoBoughtIfVisible: product.customersAlsoBoughtIfVisible,
          compareWithSimilarItemsIfVisible: product.compareWithSimilarItemsIfVisible,
        },
        sourceKeywords: productArtifact?.sourceKeywords ?? [],
        reviews: {
          summaryRef: reviewArtifact?.reviewsSummaryRef ?? null,
          jsonlRef: reviewArtifact?.reviewsJsonlRef ?? null,
          reviewPagesIndexRef: reviewArtifact?.reviewPagesIndexRef ?? null,
          capturedReviewCount: reviewArtifact?.capturedReviewCount ?? 0,
          pagesVisited: reviewArtifact?.pagesVisited ?? 0,
          hasImages: reviewArtifact?.hasImages ?? false,
          hasVideos: reviewArtifact?.hasVideos ?? false,
        },
        rawVisibleTextRef: productArtifact?.rawVisibleTextRef ?? null,
        completeness: {
          score: productArtifact?.completenessScore ?? 0,
          missingFields: productArtifact?.missingFields ?? [],
          warnings: productArtifact?.warnings ?? [],
          detailStatus: product.status,
          reviewStatus: reviewArtifact?.reviewStatus ?? product.status,
        },
        exceptions: productArtifact?.exceptionIds ?? [],
      };
    }),
    reviewsIndex: reviewArtifacts.map((review) => ({
      detailId: review.detailId,
      asin: review.asin,
      reviewsJsonlRef: review.reviewsJsonlRef,
      reviewsSummaryRef: review.reviewsSummaryRef,
      reviewPagesIndexRef: review.reviewPagesIndexRef,
      capturedReviewCount: review.capturedReviewCount,
      pagesVisited: review.pagesVisited,
      hasImages: review.hasImages,
      hasVideos: review.hasVideos,
    })),
    exceptions,
    completeness: {
      reportRef: packageArtifacts.dataCompletenessReportRef,
      summary: completenessReport.summary,
    },
    artifacts: packageArtifacts,
    handoff: {
      status: task?.handoffStatus ?? "not_started",
      aiReadingContractRef: packageArtifacts.aiHandoff.aiReadingContractRef,
      aiHandoffPromptRef: packageArtifacts.aiHandoff.aiHandoffPromptRef,
      handoffRecordRef: packageArtifacts.aiHandoff.handoffRecordRef,
      analysisBoundary: "external_advanced_ai_only",
    },
  };

  writeJsonFile(layout.packageJsonPath, packageJson);
  writeJsonFile(
    layout.manifestPath,
    buildManifestArtifact({
      layout,
      task,
      keywordCount: keywords.length,
      searchResultCount: allSearchResults.length,
      productCount: products.length,
      reviewCount: totalReviews,
      exceptionCount: exceptions.length,
    }),
  );

  const artifactRefs: PackageArtifactRef[] = [
    { artifactId: "root-package", type: "structured-package", category: "structured", fileRef: packageArtifacts.rootPackageRef },
    { artifactId: "manifest", type: "manifest", category: "manifest", fileRef: packageArtifacts.manifestRef },
    { artifactId: "task-scope", type: "task-scope", category: "manifest", fileRef: packageArtifacts.taskScopeRef },
    { artifactId: "package-schema", type: "package-schema", category: "manifest", fileRef: packageArtifacts.packageSchemaRef },
    { artifactId: "evidence-index", type: "evidence-index", category: "manifest", fileRef: packageArtifacts.evidenceIndexRef },
    { artifactId: "image-evidence-index", type: "image-evidence-index", category: "image", fileRef: packageArtifacts.imageEvidenceIndexRef },
    { artifactId: "package-file-hashes", type: "package-file-hashes", category: "manifest", fileRef: packageArtifacts.packageFileHashesRef },
    { artifactId: "business-boundary-notice", type: "business-boundary-notice", category: "boundary", fileRef: packageArtifacts.businessBoundaryNoticeRef },
    { artifactId: "master-report-html", type: "master-report-html", category: "master-report", fileRef: packageArtifacts.masterReport.htmlRef },
    { artifactId: "master-report-pdf", type: "master-report-pdf", category: "master-report", fileRef: packageArtifacts.masterReport.pdfRef },
    { artifactId: "exception-summary", type: "exception-summary", category: "exception", fileRef: packageArtifacts.exceptionSummaryRef },
    { artifactId: "manual-required", type: "manual-required", category: "exception", fileRef: packageArtifacts.manualRequiredRef },
    { artifactId: "failed-items", type: "failed-items", category: "exception", fileRef: packageArtifacts.failedItemsRef },
    { artifactId: "data-completeness-report", type: "data-completeness-report", category: "integrity", fileRef: packageArtifacts.dataCompletenessReportRef },
    { artifactId: "package-integrity-report", type: "package-integrity-report", category: "integrity", fileRef: packageArtifacts.packageIntegrityReportRef },
    { artifactId: "ai-reading-contract", type: "ai-reading-contract", category: "handoff", fileRef: packageArtifacts.aiHandoff.aiReadingContractRef },
    { artifactId: "ai-handoff-prompt", type: "ai-handoff-prompt", category: "handoff", fileRef: packageArtifacts.aiHandoff.aiHandoffPromptRef },
    { artifactId: "handoff-record", type: "handoff-record", category: "handoff", fileRef: packageArtifacts.aiHandoff.handoffRecordRef },
    ...keywordArtifacts.map((artifact) => ({ artifactId: `keyword-${artifact.keywordId}`, type: "keyword-summary", category: "structured", fileRef: artifact.summaryRef })),
    ...productArtifacts.map((artifact) => ({ artifactId: `product-${artifact.detailId}`, type: "product-detail", category: "structured", fileRef: artifact.detailRef })),
    ...reviewArtifacts.map((artifact) => ({ artifactId: `review-${artifact.detailId}`, type: "reviews-jsonl", category: "review", fileRef: artifact.reviewsJsonlRef })),
  ];

  writeJsonFile(
    layout.evidenceIndexPath,
    buildEvidenceIndex({
      taskId: input.taskId,
      keywordArtifacts,
      productArtifacts,
      reviewArtifacts,
      reviewsByDetailId,
      artifactRefs,
    }),
  );
  writeJsonFile(layout.packageFileHashesPath, buildPackageFileHashes({ taskId: input.taskId, layout }));
  const integrityReport = buildPackageIntegrityReport({
    taskId: input.taskId,
    layout,
    taskScope,
    packageType: packageJson.packageType,
    productArtifacts,
    reviewArtifacts,
    reviewsByDetailId,
    exceptions,
    searchResults: allSearchResults,
    products,
    imageEvidenceIndex,
    artifactRefs,
  });
  writeJsonFile(layout.packageIntegrityReportPath, integrityReport);

  return {
    packageRootPath: layout.packageRootPath,
    packageJsonPath: layout.packageJsonPath,
    evidenceIndexPath: layout.evidenceIndexPath,
    exceptionSummaryPath: layout.exceptionSummaryPath,
    imageEvidenceIndexPath: layout.imageEvidenceIndexPath,
    dataCompletenessReportPath: layout.dataCompletenessReportPath,
    packageIntegrityReportPath: layout.packageIntegrityReportPath,
    masterReportHtmlPath: layout.masterReportHtmlPath,
    handoffRecordPath: layout.handoffRecordPath,
    integrityStatus: integrityReport.status,
    productCount: products.length,
    reviewCount: totalReviews,
    keywordCount: keywords.length,
    searchResultCount: allSearchResults.length,
  };
};