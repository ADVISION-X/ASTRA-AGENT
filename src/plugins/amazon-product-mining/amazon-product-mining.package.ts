import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { resolveAmazonHandoffRecordPath } from "./amazon-product-mining.handoff.js";
import type { AmazonMiningStorage } from "./amazon-product-mining.storage.js";
import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";

export type AmazonPackageResult = {
  packageJsonPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
};

type AmazonPackageBuildInput = {
  taskId: string;
  dataDir: string;
  storage: AmazonMiningStorage;
};

const createArtifactsDir = (input: AmazonPackageBuildInput): string => {
  const artifactsDir = resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);
  mkdirSync(artifactsDir, { recursive: true });
  return artifactsDir;
};

const buildProductPackages = (
  input: AmazonPackageBuildInput,
  products: ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>,
) => products.map((product) => {
  const reviews = input.storage.getReviewsForProduct(product.detailId);
  return {
    detailId: product.detailId,
    asin: product.asin,
    title: product.title,
    brand: product.brand,
    currentPrice: product.currentPrice,
    rating: product.rating,
    reviewCount: product.reviewCount,
    sellerOrStoreIfVisible: product.sellerOrStoreIfVisible,
    bulletPoints: product.bulletPoints,
    productDescription: product.productDescription,
    technicalDetails: product.technicalDetails,
    bestSellersRankIfVisible: product.bestSellersRankIfVisible,
    deliveryInformation: product.deliveryInformation,
    status: product.status,
    reviews: reviews.map((review) => ({
      rating: review.rating,
      reviewTitle: review.reviewTitle,
      reviewBody: review.reviewBody,
      reviewDate: review.reviewDate,
      verifiedPurchase: review.verifiedPurchase,
      helpfulCountIfVisible: review.helpfulCountIfVisible,
      reviewerName: review.reviewerName,
      pageIndex: review.pageIndex,
    })),
  };
});

const buildDataPackage = (input: {
  taskId: string;
  task: ReturnType<AmazonMiningStorage["getTask"]>;
  keywords: ReturnType<AmazonMiningStorage["getKeywordsForTask"]>;
  products: ReturnType<AmazonMiningStorage["getProductDetailsForTask"]>;
  productPackages: ReturnType<typeof buildProductPackages>;
  totalReviews: number;
  exceptions: ReturnType<AmazonMiningStorage["getExceptionsForTask"]>;
}) => ({
  schema_version: "1.0.0",
  task_id: input.taskId,
  generated_at: new Date().toISOString(),
  task: input.task
    ? {
        amazonMarketplace: input.task.amazonMarketplace,
        targetMarket: input.task.targetMarket,
        productDirection: input.task.productDirection,
        requestedKeywordCount: input.task.requestedKeywordCount,
        languagePreference: input.task.languagePreference,
        status: input.task.status,
        createdAt: input.task.createdAt,
      }
    : null,
  keyword_count: input.keywords.length,
  product_count: input.products.length,
  review_count: input.totalReviews,
  keywords: input.keywords.map((keyword) => ({
    keyword: keyword.keyword,
    source: keyword.source,
    status: keyword.status,
  })),
  products: input.productPackages,
  exception_count: input.exceptions.length,
  exceptions: input.exceptions.map((exception) => ({
    scope: exception.scope,
    scopeId: exception.scopeId,
    exceptionKind: exception.exceptionKind,
    message: exception.message,
    createdAt: exception.createdAt,
  })),
  data_completeness_statistics: {
    keywordCount: input.keywords.length,
    completedKeywordCount: input.keywords.filter((keyword) => keyword.status === "completed").length,
    failedKeywordCount: input.keywords.filter((keyword) => keyword.status === "failed").length,
    manualRequiredKeywordCount: input.keywords.filter((keyword) => keyword.status === "manual_required").length,
    productCount: input.products.length,
    reviewCount: input.totalReviews,
    exceptionCount: input.exceptions.length,
  },
});

const buildEvidenceIndex = (input: {
  taskId: string;
  packageJsonPath: string;
  pdfReportPath: string | null;
  exceptionSummaryPath: string;
  handoffRecordPath: string;
  productCount: number;
  keywordCount: number;
  reviewCount: number;
}) => ({
  generated_at: new Date().toISOString(),
  task_id: input.taskId,
  artifacts: [
    {
      kind: "data_package_json",
      path: input.packageJsonPath,
      description: "Full structured data package with products and reviews",
    },
    ...(input.pdfReportPath
      ? [
          {
            kind: "pdf_report_pdf",
            path: input.pdfReportPath,
            description: "PDF report for advanced AI or operator review",
          },
        ]
      : []),
    {
      kind: "exception_summary_json",
      path: input.exceptionSummaryPath,
      description: "Structured exception summary for blocked or incomplete stages",
    },
    ...(existsSync(input.handoffRecordPath)
      ? [
          {
            kind: "handoff_record_json",
            path: input.handoffRecordPath,
            description: "Advanced AI handoff record with package, PDF, and exception refs",
          },
        ]
      : []),
  ],
  product_count: input.productCount,
  keyword_count: input.keywordCount,
  review_count: input.reviewCount,
});

const buildExceptionSummary = (input: {
  taskId: string;
  exceptions: ReturnType<AmazonMiningStorage["getExceptionsForTask"]>;
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

export const buildAmazonProductMiningPackage = async (input: AmazonPackageBuildInput): Promise<AmazonPackageResult> => {
  const artifactsDir = createArtifactsDir(input);

  const task = input.storage.getTask(input.taskId);
  const keywords = input.storage.getKeywordsForTask(input.taskId);
  const products = input.storage.getProductDetailsForTask(input.taskId);
  const exceptions = input.storage.getExceptionsForTask(input.taskId);

  const productPackages = buildProductPackages(input, products);

  const totalReviews = productPackages.reduce((sum, productPackage) => sum + productPackage.reviews.length, 0);

  const dataPackage = buildDataPackage({
    taskId: input.taskId,
    task,
    keywords,
    products,
    productPackages,
    totalReviews,
    exceptions,
  });

  const packageJsonPath = join(artifactsDir, "amazon-product-mining-package.json");
  writeFileSync(packageJsonPath, JSON.stringify(dataPackage, null, 2), "utf8");

  const exceptionSummary = buildExceptionSummary({
    taskId: input.taskId,
    exceptions,
  });

  const exceptionSummaryPath = join(artifactsDir, "amazon-product-mining-exception-summary.json");
  writeFileSync(exceptionSummaryPath, JSON.stringify(exceptionSummary, null, 2), "utf8");

  const evidenceIndex = buildEvidenceIndex({
    taskId: input.taskId,
    packageJsonPath,
    pdfReportPath: task?.pdfReportPath ?? null,
    exceptionSummaryPath,
    handoffRecordPath: resolveAmazonHandoffRecordPath({ dataDir: input.dataDir, taskId: input.taskId }),
    productCount: products.length,
    keywordCount: keywords.length,
    reviewCount: totalReviews,
  });

  const evidenceIndexPath = join(artifactsDir, "amazon-product-mining-evidence-index.json");
  writeFileSync(evidenceIndexPath, JSON.stringify(evidenceIndex, null, 2), "utf8");

  return {
    packageJsonPath,
    evidenceIndexPath,
    exceptionSummaryPath,
    productCount: products.length,
    reviewCount: totalReviews,
    keywordCount: keywords.length,
  };
};
