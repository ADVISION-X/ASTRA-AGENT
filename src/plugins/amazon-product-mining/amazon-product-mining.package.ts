import {
  createAmazonPackageLayout,
  type AmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
import {
  buildCompletenessReport,
  buildImageEvidenceIndex,
  buildStatusItems,
} from "./amazon-product-mining.package-completeness.js";
import {
  buildExceptionScopeMap,
  buildLinkedSearchItemsByDetailId,
  writeAiKeywordRunArtifacts,
} from "./amazon-product-mining.package-build-support.js";
import {
  buildEvidenceIndex,
  buildManifestArtifact,
  buildPackageFileHashes,
  buildPackageIntegrityReport,
  buildPackageSchemaArtifact,
  type PackageArtifactRef,
} from "./amazon-product-mining.package-manifest.js";
import { toPackageRelativePath } from "./amazon-product-mining.package-evidence-shared.js";
import {
  writeKeywordEvidenceArtifacts,
  type AmazonPackageKeywordEvidence,
} from "./amazon-product-mining.package-keyword-evidence.js";
import {
  writeProductEvidenceArtifacts,
  type AmazonPackageProductEvidence,
} from "./amazon-product-mining.package-product-evidence.js";
import {
  writeReviewEvidenceArtifacts,
  type AmazonPackageReviewEvidence,
} from "./amazon-product-mining.package-review-evidence.js";
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