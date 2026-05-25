import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

export const buildAmazonProductMiningPackage = async (input: {
  taskId: string;
  dataDir: string;
  storage: AmazonMiningStorage;
}): Promise<AmazonPackageResult> => {
  const artifactsDir = resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);
  mkdirSync(artifactsDir, { recursive: true });

  const task = input.storage.getTask(input.taskId);
  const keywords = input.storage.getKeywordsForTask(input.taskId);
  const products = input.storage.getProductDetailsForTask(input.taskId);
  const exceptions = input.storage.getExceptionsForTask(input.taskId);

  // Build traceability: keyword → search results → product details → reviews
  const productPackages = await Promise.all(
    products.map(async (product) => {
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
        reviews: reviews.map((r) => ({
          rating: r.rating,
          reviewTitle: r.reviewTitle,
          reviewBody: r.reviewBody,
          reviewDate: r.reviewDate,
          verifiedPurchase: r.verifiedPurchase,
          helpfulCountIfVisible: r.helpfulCountIfVisible,
          reviewerName: r.reviewerName,
          pageIndex: r.pageIndex,
        })),
      };
    }),
  );

  const totalReviews = productPackages.reduce((sum, p) => sum + p.reviews.length, 0);

  const dataPackage = {
    schema_version: "1.0.0",
    task_id: input.taskId,
    generated_at: new Date().toISOString(),
    task: task
      ? {
          amazonMarketplace: task.amazonMarketplace,
          targetMarket: task.targetMarket,
          productDirection: task.productDirection,
          requestedKeywordCount: task.requestedKeywordCount,
          languagePreference: task.languagePreference,
          status: task.status,
          createdAt: task.createdAt,
        }
      : null,
    keyword_count: keywords.length,
    product_count: products.length,
    review_count: totalReviews,
    keywords: keywords.map((k) => ({
      keyword: k.keyword,
      source: k.source,
      status: k.status,
    })),
    products: productPackages,
    exception_count: exceptions.length,
  };

  const packageJsonPath = join(artifactsDir, "data-package.json");
  writeFileSync(packageJsonPath, JSON.stringify(dataPackage, null, 2), "utf8");

  // Evidence index
  const evidenceIndex = {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    artifacts: [
      {
        kind: "data_package_json",
        path: packageJsonPath,
        description: "Full structured data package with products and reviews",
      },
    ],
    product_count: products.length,
    keyword_count: keywords.length,
    review_count: totalReviews,
  };

  const evidenceIndexPath = join(artifactsDir, "evidence-index.json");
  writeFileSync(evidenceIndexPath, JSON.stringify(evidenceIndex, null, 2), "utf8");

  // Exception summary
  const exceptionSummary = {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    total_exceptions: exceptions.length,
    exceptions: exceptions.map((e) => ({
      exceptionId: e.exceptionId,
      scope: e.scope,
      scopeId: e.scopeId,
      exceptionKind: e.exceptionKind,
      message: e.message,
      createdAt: e.createdAt,
    })),
  };

  const exceptionSummaryPath = join(artifactsDir, "exception-summary.json");
  writeFileSync(exceptionSummaryPath, JSON.stringify(exceptionSummary, null, 2), "utf8");

  return {
    packageJsonPath,
    evidenceIndexPath,
    exceptionSummaryPath,
    productCount: products.length,
    reviewCount: totalReviews,
    keywordCount: keywords.length,
  };
};
