import {
  createAmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
import {
  buildArtifactCatalog,
  buildCompletenessReport,
  buildEvidenceIndex,
  buildExceptionSummary,
  buildImageEvidenceIndex,
  buildPackageIntegrityReport,
  buildProductMissingFields,
  buildReviewEvidenceFiles,
  createSearchItemMatcher,
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
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  searchResultCount: number;
};

type AmazonPackageBuildInput = {
  taskId: string;
  dataDir: string;
  storage: AmazonMiningStorage;
};

export const buildAmazonProductMiningPackage = async (input: AmazonPackageBuildInput): Promise<AmazonPackageResult> => {
  const layout = createAmazonPackageLayout({ dataDir: input.dataDir, taskId: input.taskId });
  const task = input.storage.getTask(input.taskId);
  const keywords = input.storage.getKeywordsForTask(input.taskId);
  const exceptions = input.storage.getExceptionsForTask(input.taskId);
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
  const reviewEvidenceFiles = buildReviewEvidenceFiles({
    reviewEvidenceDir: layout.reviewEvidenceDir,
    products,
    reviewsByDetailId,
  });
  const totalReviews = [...reviewsByDetailId.values()].reduce((sum, reviews) => sum + reviews.length, 0);
  const matchSearchItemsForProduct = createSearchItemMatcher(allSearchResults);

  const keywordSearchEvidence = {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    keywords: keywords.map((keyword) => {
      const searchResults = searchResultsByKeyword.get(keyword.keywordId) ?? [];
      return {
        keywordId: keyword.keywordId,
        keyword: keyword.keyword,
        source: keyword.source,
        aiRunId: keyword.aiRunId,
        status: keyword.status,
        createdAt: keyword.createdAt,
        searchUrl: searchResults[0]?.searchUrl ?? null,
        searchResultCount: searchResults.length,
        items: searchResults.map((item) => ({
          itemId: item.itemId,
          rankPosition: item.rankPosition,
          isSponsored: item.isSponsored,
          title: item.title,
          productUrl: item.productUrl,
          asinIfAvailable: item.asinIfAvailable,
          mainImageUrl: item.mainImageUrl,
          price: item.price,
          originalPriceOrDiscountIfVisible: item.originalPriceOrDiscountIfVisible,
          rating: item.rating,
          reviewCount: item.reviewCount,
          primeOrFbaFlagIfVisible: item.primeOrFbaFlagIfVisible,
          couponTextIfVisible: item.couponTextIfVisible,
          deliveryTextIfVisible: item.deliveryTextIfVisible,
          rawVisibleTextSnapshot: item.rawVisibleTextSnapshot,
          createdAt: item.createdAt,
        })),
      };
    }),
  };
  writeJsonFile(layout.keywordSearchEvidencePath, keywordSearchEvidence);

  const productDetailEvidence = {
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    products: products.map((product) => {
      const linkedSearchItems = matchSearchItemsForProduct(product);
      const linkedKeywords = linkedSearchItems.map((item) => ({
        keywordId: item.keywordId,
        keyword: item.keyword,
        rankPosition: item.rankPosition,
      }));
      const reviewEvidence = reviewEvidenceFiles.get(product.detailId);
      return {
        detailId: product.detailId,
        asin: product.asin,
        productUrl: product.productUrl,
        title: product.title,
        brand: product.brand,
        sellerOrStoreIfVisible: product.sellerOrStoreIfVisible,
        currentPrice: product.currentPrice,
        originalPriceDiscountCouponIfVisible: product.originalPriceDiscountCouponIfVisible,
        mainImage: product.mainImage,
        allVisibleImages: product.allVisibleImages,
        visibleVideoInfo: product.visibleVideoInfo,
        bulletPoints: product.bulletPoints,
        aboutThisItem: product.aboutThisItem,
        productDescription: product.productDescription,
        aPlusContentIfVisible: product.aPlusContentIfVisible,
        variationOptions: product.variationOptions,
        colorSizeStyleOptions: product.colorSizeStyleOptions,
        productInformation: product.productInformation,
        technicalDetails: product.technicalDetails,
        additionalInformation: product.additionalInformation,
        bestSellersRankIfVisible: product.bestSellersRankIfVisible,
        categoryPathIfVisible: product.categoryPathIfVisible,
        rating: product.rating,
        reviewCount: product.reviewCount,
        starDistribution: product.starDistribution,
        qaContentIfVisible: product.qaContentIfVisible,
        frequentlyBoughtTogetherIfVisible: product.frequentlyBoughtTogetherIfVisible,
        customersAlsoBoughtIfVisible: product.customersAlsoBoughtIfVisible,
        compareWithSimilarItemsIfVisible: product.compareWithSimilarItemsIfVisible,
        deliveryInformation: product.deliveryInformation,
        returnInformation: product.returnInformation,
        allOtherVisibleProductParameters: product.allOtherVisibleProductParameters,
        rawVisibleTextSnapshot: product.rawVisibleTextSnapshot,
        status: product.status,
        failureReason: product.failureReason,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        linkedKeywords,
        missingFields: buildProductMissingFields(product),
        reviewEvidencePath: reviewEvidence?.path ?? null,
        reviewRecordCount: reviewEvidence?.reviewCount ?? 0,
      };
    }),
  };
  writeJsonFile(layout.productDetailEvidencePath, productDetailEvidence);

  const imageEvidenceIndex = buildImageEvidenceIndex({
    taskId: input.taskId,
    searchResults: allSearchResults,
    products,
    reviewsByDetailId,
  });
  writeJsonFile(layout.imageEvidenceIndexPath, imageEvidenceIndex);

  const exceptionSummary = buildExceptionSummary({ taskId: input.taskId, exceptions });
  writeJsonFile(layout.exceptionSummaryPath, exceptionSummary);

  const completenessReport = buildCompletenessReport({
    taskId: input.taskId,
    task,
    keywords,
    searchResults: allSearchResults,
    products,
    reviewsByDetailId,
    exceptions,
  });
  writeJsonFile(layout.dataCompletenessReportPath, completenessReport);

  const packageManifest = {
    schema_version: "2.0.0",
    package_kind: "amazon-product-mining-advanced-ai-package",
    generated_at: new Date().toISOString(),
    task_id: input.taskId,
    package_root_path: layout.packageRootPath,
    task_scope: task
      ? {
          amazonMarketplace: task.amazonMarketplace,
          targetMarket: task.targetMarket,
          productDirection: task.productDirection,
          requestedKeywordCount: task.requestedKeywordCount,
          languagePreference: task.languagePreference,
          status: task.status,
          handoffStatus: task.handoffStatus,
          createdAt: task.createdAt,
          completedAt: task.updatedAt,
          failureReason: task.failureReason,
        }
      : null,
    counts: {
      keywords: keywords.length,
      searchResults: allSearchResults.length,
      products: products.length,
      reviews: totalReviews,
      exceptions: exceptions.length,
    },
    sections: {
      masterReportHtmlPath: layout.masterReportHtmlPath,
      pdfReportPath: layout.pdfReportPath,
      evidenceIndexPath: layout.evidenceIndexPath,
      imageEvidenceIndexPath: layout.imageEvidenceIndexPath,
      keywordSearchEvidencePath: layout.keywordSearchEvidencePath,
      productDetailEvidencePath: layout.productDetailEvidencePath,
      reviewEvidenceDir: layout.reviewEvidenceDir,
      aiHandoffDir: layout.aiHandoffDir,
      exceptionSummaryPath: layout.exceptionSummaryPath,
      dataCompletenessReportPath: layout.dataCompletenessReportPath,
      packageIntegrityReportPath: layout.packageIntegrityReportPath,
    },
    keywords: keywords.map((keyword) => {
      const searchResults = searchResultsByKeyword.get(keyword.keywordId) ?? [];
      const linkedProducts = searchResults
        .map((item) => products.find((product) => product.detailId === item.itemId))
        .filter((product): product is AmazonProductDetail => product !== undefined);
      return {
        keywordId: keyword.keywordId,
        keyword: keyword.keyword,
        status: keyword.status,
        source: keyword.source,
        aiRunId: keyword.aiRunId,
        searchResultCount: searchResults.length,
        completedProductCount: linkedProducts.filter((product) => product.status === "completed").length,
        failedProductCount: linkedProducts.filter((product) => product.status === "failed").length,
        manualRequiredProductCount: linkedProducts.filter((product) => product.status === "manual_required").length,
        searchEvidencePath: layout.keywordSearchEvidencePath,
      };
    }),
    products: products.map((product) => {
      const linkedSearchItems = matchSearchItemsForProduct(product);
      const reviewEvidence = reviewEvidenceFiles.get(product.detailId);
      return {
        detailId: product.detailId,
        asin: product.asin,
        title: product.title,
        status: product.status,
        currentPrice: product.currentPrice,
        rating: product.rating,
        reviewCount: product.reviewCount,
        reviewRecordCount: reviewEvidence?.reviewCount ?? 0,
        missingFields: buildProductMissingFields(product),
        linkedKeywords: linkedSearchItems.map((item) => ({ keywordId: item.keywordId, keyword: item.keyword })),
        productEvidencePath: layout.productDetailEvidencePath,
        reviewEvidencePath: reviewEvidence?.path ?? null,
      };
    }),
  };
  writeJsonFile(layout.packageJsonPath, packageManifest);

  const artifactCatalog = buildArtifactCatalog({
    packageJsonPath: layout.packageJsonPath,
    evidenceIndexPath: layout.evidenceIndexPath,
    pdfReportPath: layout.pdfReportPath,
    exceptionSummaryPath: layout.exceptionSummaryPath,
    masterReportHtmlPath: layout.masterReportHtmlPath,
    imageEvidenceIndexPath: layout.imageEvidenceIndexPath,
    dataCompletenessReportPath: layout.dataCompletenessReportPath,
    packageIntegrityReportPath: layout.packageIntegrityReportPath,
    keywordSearchEvidencePath: layout.keywordSearchEvidencePath,
    productDetailEvidencePath: layout.productDetailEvidencePath,
    aiReadingContractPath: layout.aiReadingContractPath,
    aiHandoffPromptPath: layout.aiHandoffPromptPath,
    businessBoundaryNoticePath: layout.businessBoundaryNoticePath,
    handoffRecordPath: layout.handoffRecordPath,
    reviewEvidencePaths: [...reviewEvidenceFiles.values()].map((entry) => entry.path),
  });

  const evidenceIndex = buildEvidenceIndex({
    taskId: input.taskId,
    packageRootPath: layout.packageRootPath,
    keywordCount: keywords.length,
    searchResultCount: allSearchResults.length,
    productCount: products.length,
    reviewCount: totalReviews,
    artifactCatalog,
  });
  writeJsonFile(layout.evidenceIndexPath, evidenceIndex);

  const packageIntegrityReport = buildPackageIntegrityReport({
    taskId: input.taskId,
    packageIntegrityReportPath: layout.packageIntegrityReportPath,
    artifactCatalog: buildArtifactCatalog({
      packageJsonPath: layout.packageJsonPath,
      evidenceIndexPath: layout.evidenceIndexPath,
      pdfReportPath: layout.pdfReportPath,
      exceptionSummaryPath: layout.exceptionSummaryPath,
      masterReportHtmlPath: layout.masterReportHtmlPath,
      imageEvidenceIndexPath: layout.imageEvidenceIndexPath,
      dataCompletenessReportPath: layout.dataCompletenessReportPath,
      packageIntegrityReportPath: layout.packageIntegrityReportPath,
      keywordSearchEvidencePath: layout.keywordSearchEvidencePath,
      productDetailEvidencePath: layout.productDetailEvidencePath,
      aiReadingContractPath: layout.aiReadingContractPath,
      aiHandoffPromptPath: layout.aiHandoffPromptPath,
      businessBoundaryNoticePath: layout.businessBoundaryNoticePath,
      handoffRecordPath: layout.handoffRecordPath,
      reviewEvidencePaths: [...reviewEvidenceFiles.values()].map((entry) => entry.path),
    }),
  });
  writeJsonFile(layout.packageIntegrityReportPath, packageIntegrityReport);

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
    productCount: products.length,
    reviewCount: totalReviews,
    keywordCount: keywords.length,
    searchResultCount: allSearchResults.length,
  };
};
