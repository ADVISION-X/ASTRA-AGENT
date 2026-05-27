import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { AMAZON_PACKAGE_FILE_NAMES } from "./amazon-product-mining.package-layout.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";

export type AmazonTaskRecord = NonNullable<ReturnType<AmazonMiningStorage["getTask"]>>;
export type AmazonKeywordRecord = ReturnType<AmazonMiningStorage["getKeywordsForTask"]>[number];
export type AmazonSearchResultItem = ReturnType<AmazonMiningStorage["getSearchResultsForKeyword"]>[number];
export type AmazonProductDetail = ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>[number];
export type AmazonReviewRecord = ReturnType<AmazonMiningStorage["getReviewsForProduct"]>[number];
export type AmazonExceptionRecord = ReturnType<AmazonMiningStorage["getExceptionsForTask"]>[number];

export type ArtifactCatalogEntry = {
  kind: string;
  path: string;
  description: string;
  exists: boolean;
};

export const writeJsonFile = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeJsonlFile = (filePath: string, rows: readonly unknown[]): void => {
  const content = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(filePath, rows.length > 0 ? `${content}\n` : "", "utf8");
};

const toEvidenceDirName = (value: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized.length > 0 ? normalized : "unknown";
};

const createArtifactHash = (filePath: string): string | null =>
  existsSync(filePath) ? createHash("sha256").update(readFileSync(filePath)).digest("hex") : null;

export const buildProductMissingFields = (product: AmazonProductDetail): string[] => {
  const missingFields: string[] = [];
  if (!product.currentPrice) missingFields.push("currentPrice");
  if (!product.rating) missingFields.push("rating");
  if (!product.reviewCount) missingFields.push("reviewCount");
  if (!product.rawVisibleTextSnapshot) missingFields.push("rawVisibleTextSnapshot");
  return missingFields;
};

export const createSearchItemMatcher = (allSearchResults: readonly AmazonSearchResultItem[]) => {
  const byItemId = new Map<string, AmazonSearchResultItem>();
  const byAsin = new Map<string, AmazonSearchResultItem[]>();
  const byProductUrl = new Map<string, AmazonSearchResultItem[]>();

  for (const item of allSearchResults) {
    byItemId.set(item.itemId, item);
    if (item.asinIfAvailable) {
      const byAsinRows = byAsin.get(item.asinIfAvailable) ?? [];
      byAsinRows.push(item);
      byAsin.set(item.asinIfAvailable, byAsinRows);
    }
    const byUrlRows = byProductUrl.get(item.productUrl) ?? [];
    byUrlRows.push(item);
    byProductUrl.set(item.productUrl, byUrlRows);
  }

  return (product: AmazonProductDetail): AmazonSearchResultItem[] => {
    const matches = new Map<string, AmazonSearchResultItem>();
    const direct = byItemId.get(product.detailId);
    if (direct) matches.set(direct.itemId, direct);
    if (product.asin) {
      for (const item of byAsin.get(product.asin) ?? []) {
        matches.set(item.itemId, item);
      }
    }
    for (const item of byProductUrl.get(product.productUrl) ?? []) {
      matches.set(item.itemId, item);
    }
    return [...matches.values()].sort((left, right) => left.rankPosition - right.rankPosition);
  };
};

export const buildReviewEvidenceFiles = (input: {
  reviewEvidenceDir: string;
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}) => {
  const reviewEvidenceFiles = new Map<string, { path: string; reviewCount: number }>();

  for (const product of input.products) {
    const reviewRows = input.reviewsByDetailId.get(product.detailId) ?? [];
    const reviewDir = join(input.reviewEvidenceDir, toEvidenceDirName(product.asin ?? product.detailId));
    mkdirSync(reviewDir, { recursive: true });
    const reviewJsonlPath = join(reviewDir, AMAZON_PACKAGE_FILE_NAMES.reviewEvidenceJsonl);
    writeJsonlFile(reviewJsonlPath, reviewRows.map((review) => ({
      reviewId: review.reviewId,
      detailId: review.detailId,
      taskId: review.taskId,
      asin: review.asin,
      pageIndex: review.pageIndex,
      reviewIdIfAvailable: review.reviewIdIfAvailable,
      reviewerName: review.reviewerName,
      rating: review.rating,
      reviewTitle: review.reviewTitle,
      reviewBody: review.reviewBody,
      reviewDate: review.reviewDate,
      verifiedPurchase: review.verifiedPurchase,
      variant: review.variant,
      helpfulCountIfVisible: review.helpfulCountIfVisible,
      reviewImagesIfVisible: review.reviewImagesIfVisible,
      reviewVideosIfVisible: review.reviewVideosIfVisible,
      reviewLanguage: review.reviewLanguage,
      reviewRegionIfVisible: review.reviewRegionIfVisible,
      rawReviewTextSnapshot: review.rawReviewTextSnapshot,
      createdAt: review.createdAt,
    })));
    reviewEvidenceFiles.set(product.detailId, {
      path: reviewJsonlPath,
      reviewCount: reviewRows.length,
    });
  }

  return reviewEvidenceFiles;
};

export const buildImageEvidenceIndex = (input: {
  taskId: string;
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
}) => {
  const entries: Array<{
    scope: string;
    referenceId: string;
    url: string;
    role: string;
    taskId: string;
    keywordId?: string | null;
    detailId?: string | null;
    reviewId?: string | null;
  }> = [];
  const seen = new Set<string>();

  const pushEntry = (entry: {
    scope: string;
    referenceId: string;
    url: string | null | undefined;
    role: string;
    taskId: string;
    keywordId?: string | null;
    detailId?: string | null;
    reviewId?: string | null;
  }) => {
    if (!entry.url) return;
    const key = [entry.scope, entry.referenceId, entry.role, entry.url].join("::");
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      scope: entry.scope,
      referenceId: entry.referenceId,
      url: entry.url,
      role: entry.role,
      taskId: entry.taskId,
      keywordId: entry.keywordId ?? null,
      detailId: entry.detailId ?? null,
      reviewId: entry.reviewId ?? null,
    });
  };

  for (const item of input.searchResults) {
    pushEntry({
      scope: "search_result",
      referenceId: item.itemId,
      url: item.mainImageUrl,
      role: "main_image",
      taskId: input.taskId,
      keywordId: item.keywordId,
      detailId: item.itemId,
    });
  }

  for (const product of input.products) {
    pushEntry({
      scope: "product_detail",
      referenceId: product.detailId,
      url: product.mainImage,
      role: "main_image",
      taskId: input.taskId,
      detailId: product.detailId,
    });
    for (const imageUrl of product.allVisibleImages) {
      pushEntry({
        scope: "product_detail",
        referenceId: product.detailId,
        url: imageUrl,
        role: "visible_image",
        taskId: input.taskId,
        detailId: product.detailId,
      });
    }
  }

  for (const [detailId, reviews] of input.reviewsByDetailId.entries()) {
    for (const review of reviews) {
      for (const imageUrl of review.reviewImagesIfVisible) {
        pushEntry({
          scope: "review",
          referenceId: review.reviewId,
          url: imageUrl,
          role: "review_image",
          taskId: input.taskId,
          detailId,
          reviewId: review.reviewId,
        });
      }
    }
  }

  return {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    mode: "url_only",
    image_count: entries.length,
    images: entries,
  };
};

export const buildExceptionSummary = (input: {
  taskId: string;
  exceptions: readonly AmazonExceptionRecord[];
}) => ({
  generated_at: new Date().toISOString(),
  task_id: input.taskId,
  total_exceptions: input.exceptions.length,
  exceptions: input.exceptions.map((exception) => ({
    exceptionId: exception.exceptionId,
    scope: exception.scope,
    scopeId: exception.scopeId,
    exceptionKind: exception.exceptionKind,
    message: exception.message,
    createdAt: exception.createdAt,
  })),
});

export const buildCompletenessReport = (input: {
  taskId: string;
  task: AmazonTaskRecord | null;
  keywords: readonly AmazonKeywordRecord[];
  searchResults: readonly AmazonSearchResultItem[];
  products: readonly AmazonProductDetail[];
  reviewsByDetailId: Map<string, AmazonReviewRecord[]>;
  exceptions: readonly AmazonExceptionRecord[];
}) => {
  const keywordStatusCounts = {
    pending: input.keywords.filter((keyword) => keyword.status === "pending").length,
    searching: input.keywords.filter((keyword) => keyword.status === "searching").length,
    searchCompleted: input.keywords.filter((keyword) => keyword.status === "search_completed").length,
    completed: input.keywords.filter((keyword) => keyword.status === "completed").length,
    completedWithErrors: input.keywords.filter((keyword) => keyword.status === "completed_with_errors").length,
    failed: input.keywords.filter((keyword) => keyword.status === "failed").length,
    manualRequired: input.keywords.filter((keyword) => keyword.status === "manual_required").length,
  };
  const productStatusCounts = {
    detailCompleted: input.products.filter((product) => product.status === "detail_completed").length,
    reviewExtracting: input.products.filter((product) => product.status === "review_extracting").length,
    completed: input.products.filter((product) => product.status === "completed").length,
    failed: input.products.filter((product) => product.status === "failed").length,
    manualRequired: input.products.filter((product) => product.status === "manual_required").length,
  };
  const incompleteProducts = input.products
    .map((product) => {
      const missingFields = buildProductMissingFields(product);
      const reviewRowCount = input.reviewsByDetailId.get(product.detailId)?.length ?? 0;
      if (missingFields.length === 0 && product.status === "completed") {
        return null;
      }
      return {
        detailId: product.detailId,
        asin: product.asin,
        title: product.title,
        status: product.status,
        failureReason: product.failureReason,
        missingFields,
        reviewRowCount,
      };
    })
    .filter((product): product is NonNullable<typeof product> => product !== null);

  return {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    task_status: input.task?.status ?? null,
    handoff_status: input.task?.handoffStatus ?? null,
    counts: {
      keywords: {
        total: input.keywords.length,
        ...keywordStatusCounts,
      },
      search_results: {
        total: input.searchResults.length,
      },
      products: {
        total: input.products.length,
        missingCurrentPrice: input.products.filter((product) => !product.currentPrice).length,
        missingRating: input.products.filter((product) => !product.rating).length,
        missingReviewCount: input.products.filter((product) => !product.reviewCount).length,
        missingRawVisibleTextSnapshot: input.products.filter((product) => !product.rawVisibleTextSnapshot).length,
        ...productStatusCounts,
      },
      reviews: {
        total: [...input.reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0),
        coveredProducts: [...input.reviewsByDetailId.values()].filter((reviews) => reviews.length > 0).length,
      },
      exceptions: {
        total: input.exceptions.length,
      },
    },
    incomplete_products: incompleteProducts,
    task_failure_reason: input.task?.failureReason ?? null,
  };
};

export const buildArtifactCatalog = (input: {
  packageJsonPath: string;
  evidenceIndexPath: string;
  pdfReportPath: string;
  exceptionSummaryPath: string;
  masterReportHtmlPath: string;
  imageEvidenceIndexPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  keywordSearchEvidencePath: string;
  productDetailEvidencePath: string;
  aiReadingContractPath: string;
  aiHandoffPromptPath: string;
  businessBoundaryNoticePath: string;
  handoffRecordPath: string;
  reviewEvidencePaths: readonly string[];
}) => {
  const entries: ArtifactCatalogEntry[] = [
    {
      kind: "data_package_json",
      path: input.packageJsonPath,
      description: "Advanced-AI-readable package manifest",
      exists: existsSync(input.packageJsonPath),
    },
    {
      kind: "pdf_report_pdf",
      path: input.pdfReportPath,
      description: "Fixed final PDF report artifact",
      exists: existsSync(input.pdfReportPath),
    },
    {
      kind: "evidence_index_json",
      path: input.evidenceIndexPath,
      description: "Package-wide evidence catalog",
      exists: existsSync(input.evidenceIndexPath),
    },
    {
      kind: "exception_summary_json",
      path: input.exceptionSummaryPath,
      description: "Structured exception and blockage disclosure",
      exists: existsSync(input.exceptionSummaryPath),
    },
    {
      kind: "master_report_html",
      path: input.masterReportHtmlPath,
      description: "Master HTML report for operator and downstream AI reading",
      exists: existsSync(input.masterReportHtmlPath),
    },
    {
      kind: "image_evidence_index_json",
      path: input.imageEvidenceIndexPath,
      description: "Image evidence index in mode url_only",
      exists: existsSync(input.imageEvidenceIndexPath),
    },
    {
      kind: "data_completeness_report_json",
      path: input.dataCompletenessReportPath,
      description: "Completeness disclosure for keywords, products, reviews, and exceptions",
      exists: existsSync(input.dataCompletenessReportPath),
    },
    {
      kind: "package_integrity_report_json",
      path: input.packageIntegrityReportPath,
      description: "Artifact presence and hash coverage report",
      exists: existsSync(input.packageIntegrityReportPath),
    },
    {
      kind: "keyword_search_evidence_json",
      path: input.keywordSearchEvidencePath,
      description: "Keyword-to-search-result evidence bundle",
      exists: existsSync(input.keywordSearchEvidencePath),
    },
    {
      kind: "product_detail_evidence_json",
      path: input.productDetailEvidencePath,
      description: "Product detail evidence bundle",
      exists: existsSync(input.productDetailEvidencePath),
    },
    {
      kind: "ai_reading_contract_md",
      path: input.aiReadingContractPath,
      description: "Downstream AI reading contract",
      exists: existsSync(input.aiReadingContractPath),
    },
    {
      kind: "ai_handoff_prompt_md",
      path: input.aiHandoffPromptPath,
      description: "Downstream AI handoff prompt scaffold",
      exists: existsSync(input.aiHandoffPromptPath),
    },
    {
      kind: "business_boundary_notice_md",
      path: input.businessBoundaryNoticePath,
      description: "Boundary notice forbidding agent-side final adjudication",
      exists: existsSync(input.businessBoundaryNoticePath),
    },
    {
      kind: "handoff_record_json",
      path: input.handoffRecordPath,
      description: "Advanced AI handoff record",
      exists: existsSync(input.handoffRecordPath),
    },
  ];

  for (const reviewEvidencePath of input.reviewEvidencePaths) {
    entries.push({
      kind: "review_evidence_jsonl",
      path: reviewEvidencePath,
      description: "Per-product review evidence JSONL",
      exists: existsSync(reviewEvidencePath),
    });
  }

  return entries;
};

export const buildEvidenceIndex = (input: {
  taskId: string;
  packageRootPath: string;
  keywordCount: number;
  searchResultCount: number;
  productCount: number;
  reviewCount: number;
  artifactCatalog: readonly ArtifactCatalogEntry[];
}) => ({
  generated_at: new Date().toISOString(),
  task_id: input.taskId,
  package_root_path: input.packageRootPath,
  artifact_count: input.artifactCatalog.length,
  artifacts: input.artifactCatalog,
  counts: {
    keywords: input.keywordCount,
    searchResults: input.searchResultCount,
    products: input.productCount,
    reviews: input.reviewCount,
  },
});

export const buildPackageIntegrityReport = (input: {
  taskId: string;
  packageIntegrityReportPath: string;
  artifactCatalog: readonly ArtifactCatalogEntry[];
}) => {
  const requiredArtifacts = input.artifactCatalog.map((artifact) => ({
    kind: artifact.kind,
    path: artifact.path,
    exists: artifact.exists,
    sha256: artifact.path === input.packageIntegrityReportPath ? null : createArtifactHash(artifact.path),
    description: artifact.description,
  }));
  const missingRequiredArtifacts = requiredArtifacts.filter((artifact) => !artifact.exists).map((artifact) => artifact.path);

  return {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    integrity_status: missingRequiredArtifacts.length === 0 ? "ready" : "manual_required",
    missing_required_artifacts: missingRequiredArtifacts,
    required_artifacts: requiredArtifacts,
    self_path: input.packageIntegrityReportPath,
  };
};