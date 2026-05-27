import {
  createAmazonPackageLayout,
  type AmazonPackageLayout,
} from "./amazon-product-mining.package-layout.js";
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
import {
  buildExceptionSummaryArtifact,
  buildPackageEvidenceState,
  buildTaskScopeArtifact,
  loadPackageRuntimeState,
  writePackageSideArtifacts,
  type PackageEvidenceState,
  type PackageRuntimeState,
} from "./amazon-product-mining.package-runtime-state.js";

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

const buildPackageArtifactsContract = (layout: AmazonPackageLayout) => ({
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
});

const buildPackageKeywordEntries = (input: {
  keywords: readonly AmazonKeywordRecord[];
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
}) => {
  const keywordById = new Map(input.keywords.map((keyword) => [keyword.keywordId, keyword]));
  return input.keywordArtifacts.map((keyword) => ({
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
  }));
};

const buildPackageSearchResultEntries = (input: {
  allSearchResults: readonly AmazonSearchResultItem[];
  detailIdsByItemId: Map<string, string[]>;
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
}) => {
  const rawVisibleTextByKeywordId = new Map(input.keywordArtifacts.map((artifact) => [artifact.keywordId, artifact.rawVisibleTextRef]));
  return input.allSearchResults.map((item) => ({
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
    detailRefs: input.detailIdsByItemId.get(item.itemId) ?? [],
    rawVisibleTextRef: rawVisibleTextByKeywordId.get(item.keywordId) ?? null,
    createdAt: item.createdAt,
  }));
};

const buildPackageProductImages = (
  product: AmazonProductDetail,
  productArtifact: AmazonPackageProductEvidence | undefined,
) => ({
  mode: "url_only",
  mainImageUrl: product.mainImage,
  galleryImageUrls: product.allVisibleImages,
  aPlusImageUrls: product.aPlusImageUrls,
  visibleVideoInfo: product.visibleVideoInfo,
  productImagesIndexRef: productArtifact?.imagesIndexRef ?? null,
});

const buildPackageProductCommerce = (product: AmazonProductDetail) => ({
  currentPrice: product.currentPrice,
  originalPriceDiscountCouponIfVisible: product.originalPriceDiscountCouponIfVisible,
  rating: product.rating,
  reviewCount: product.reviewCount,
  bestSellersRankIfVisible: product.bestSellersRankIfVisible,
  categoryPathIfVisible: product.categoryPathIfVisible,
  deliveryInformation: product.deliveryInformation,
  returnInformation: product.returnInformation,
});

const buildPackageProductReviews = (reviewArtifact: AmazonPackageReviewEvidence | undefined) => ({
  summaryRef: reviewArtifact?.reviewsSummaryRef ?? null,
  jsonlRef: reviewArtifact?.reviewsJsonlRef ?? null,
  reviewPagesIndexRef: reviewArtifact?.reviewPagesIndexRef ?? null,
  capturedReviewCount: reviewArtifact?.capturedReviewCount ?? 0,
  pagesVisited: reviewArtifact?.pagesVisited ?? 0,
  hasImages: reviewArtifact?.hasImages ?? false,
  hasVideos: reviewArtifact?.hasVideos ?? false,
});

const buildPackageProductCompleteness = (input: {
  product: AmazonProductDetail;
  productArtifact: AmazonPackageProductEvidence | undefined;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
}) => ({
  score: input.productArtifact?.completenessScore ?? 0,
  missingFields: input.productArtifact?.missingFields ?? [],
  notPresentFields: input.productArtifact?.notPresentFields ?? [],
  blockedFields: input.productArtifact?.blockedFields ?? [],
  unsupportedFields: input.productArtifact?.unsupportedFields ?? [],
  manualRequiredFields: input.productArtifact?.manualRequiredFields ?? [],
  failedFields: input.productArtifact?.failedFields ?? [],
  extractorMissingFields: input.productArtifact?.extractorMissingFields ?? [],
  warnings: input.productArtifact?.warnings ?? [],
  fieldDisclosures: input.product.fieldDisclosureMap,
  detailStatus: input.product.status,
  reviewStatus: input.reviewArtifact?.reviewStatus ?? input.product.status,
});

const buildPackageProductEntry = (input: {
  product: AmazonProductDetail;
  productArtifact: AmazonPackageProductEvidence | undefined;
  reviewArtifact: AmazonPackageReviewEvidence | undefined;
}) => ({
  detailId: input.product.detailId,
  asin: input.product.asin,
  productUrl: input.product.productUrl,
  identity: {
    title: input.product.title,
    brand: input.product.brand,
    sellerOrStoreIfVisible: input.product.sellerOrStoreIfVisible,
  },
  images: buildPackageProductImages(input.product, input.productArtifact),
  commerce: buildPackageProductCommerce(input.product),
  listing: {
    bulletPoints: input.product.bulletPoints,
    aboutThisItem: input.product.aboutThisItem,
    productDescription: input.product.productDescription,
    aPlusContentIfVisible: input.product.aPlusContentIfVisible,
    aPlusImageUrls: input.product.aPlusImageUrls,
  },
  parameters: {
    variationOptions: input.product.variationOptions,
    colorSizeStyleOptions: input.product.colorSizeStyleOptions,
    productInformation: input.product.productInformation,
    technicalDetails: input.product.technicalDetails,
    additionalInformation: input.product.additionalInformation,
    allOtherVisibleProductParameters: input.product.allOtherVisibleProductParameters,
  },
  relatedModules: {
    qaContentIfVisible: input.product.qaContentIfVisible,
    frequentlyBoughtTogetherIfVisible: input.product.frequentlyBoughtTogetherIfVisible,
    customersAlsoBoughtIfVisible: input.product.customersAlsoBoughtIfVisible,
    compareWithSimilarItemsIfVisible: input.product.compareWithSimilarItemsIfVisible,
  },
  sourceKeywords: input.productArtifact?.sourceKeywords ?? [],
  reviews: buildPackageProductReviews(input.reviewArtifact),
  rawVisibleTextRef: input.productArtifact?.rawVisibleTextRef ?? null,
  completeness: buildPackageProductCompleteness(input),
  exceptions: input.productArtifact?.exceptionIds ?? [],
});

const buildPackageProductEntries = (input: {
  products: readonly AmazonProductDetail[];
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
}) => {
  const productArtifactsByDetailId = new Map(input.productArtifacts.map((artifact) => [artifact.detailId, artifact]));
  const reviewArtifactsByDetailId = new Map(input.reviewArtifacts.map((artifact) => [artifact.detailId, artifact]));
  return input.products.map((product) => {
    const productArtifact = productArtifactsByDetailId.get(product.detailId);
    const reviewArtifact = reviewArtifactsByDetailId.get(product.detailId);
    return buildPackageProductEntry({ product, productArtifact, reviewArtifact });
  });
};

const buildPackageJsonArtifact = (input: {
  taskId: string;
  generatedAt: string;
  taskScope: Record<string, unknown>;
  packageArtifacts: ReturnType<typeof buildPackageArtifactsContract>;
  runtime: PackageRuntimeState;
  evidence: PackageEvidenceState;
}) => ({
  schemaVersion: "2.0.0",
  packageType: "amazon-product-mining-master-evidence-package",
  generatedAt: input.generatedAt,
  task: input.taskScope,
  aiKeywordRuns: input.evidence.aiKeywordRunArtifacts,
  keywords: buildPackageKeywordEntries({ keywords: input.runtime.keywords, keywordArtifacts: input.evidence.keywordArtifacts }),
  searchResults: buildPackageSearchResultEntries({
    allSearchResults: input.runtime.allSearchResults,
    detailIdsByItemId: input.runtime.detailIdsByItemId,
    keywordArtifacts: input.evidence.keywordArtifacts,
  }),
  searchResultProductLinks: input.runtime.links.map((link) => ({ itemId: link.itemId, detailId: link.detailId })),
  products: buildPackageProductEntries({
    products: input.runtime.products,
    productArtifacts: input.evidence.productArtifacts,
    reviewArtifacts: input.evidence.reviewArtifacts,
  }),
  reviewsIndex: input.evidence.reviewArtifacts.map((review) => ({
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
  exceptions: input.runtime.exceptions,
  completeness: { reportRef: input.packageArtifacts.dataCompletenessReportRef, summary: input.evidence.completenessReport.summary },
  artifacts: input.packageArtifacts,
  handoff: {
    status: input.runtime.task?.handoffStatus ?? "not_started",
    aiReadingContractRef: input.packageArtifacts.aiHandoff.aiReadingContractRef,
    aiHandoffPromptRef: input.packageArtifacts.aiHandoff.aiHandoffPromptRef,
    handoffRecordRef: input.packageArtifacts.aiHandoff.handoffRecordRef,
    analysisBoundary: "external_advanced_ai_only",
  },
});

const buildPackageArtifactRefs = (input: {
  packageArtifacts: ReturnType<typeof buildPackageArtifactsContract>;
  keywordArtifacts: readonly AmazonPackageKeywordEvidence[];
  productArtifacts: readonly AmazonPackageProductEvidence[];
  reviewArtifacts: readonly AmazonPackageReviewEvidence[];
}): PackageArtifactRef[] => [
  { artifactId: "root-package", type: "structured-package", category: "structured", fileRef: input.packageArtifacts.rootPackageRef },
  { artifactId: "manifest", type: "manifest", category: "manifest", fileRef: input.packageArtifacts.manifestRef },
  { artifactId: "task-scope", type: "task-scope", category: "manifest", fileRef: input.packageArtifacts.taskScopeRef },
  { artifactId: "package-schema", type: "package-schema", category: "manifest", fileRef: input.packageArtifacts.packageSchemaRef },
  { artifactId: "evidence-index", type: "evidence-index", category: "manifest", fileRef: input.packageArtifacts.evidenceIndexRef },
  { artifactId: "image-evidence-index", type: "image-evidence-index", category: "image", fileRef: input.packageArtifacts.imageEvidenceIndexRef },
  { artifactId: "package-file-hashes", type: "package-file-hashes", category: "manifest", fileRef: input.packageArtifacts.packageFileHashesRef },
  { artifactId: "business-boundary-notice", type: "business-boundary-notice", category: "boundary", fileRef: input.packageArtifacts.businessBoundaryNoticeRef },
  { artifactId: "master-report-html", type: "master-report-html", category: "master-report", fileRef: input.packageArtifacts.masterReport.htmlRef },
  { artifactId: "master-report-pdf", type: "master-report-pdf", category: "master-report", fileRef: input.packageArtifacts.masterReport.pdfRef },
  { artifactId: "exception-summary", type: "exception-summary", category: "exception", fileRef: input.packageArtifacts.exceptionSummaryRef },
  { artifactId: "manual-required", type: "manual-required", category: "exception", fileRef: input.packageArtifacts.manualRequiredRef },
  { artifactId: "failed-items", type: "failed-items", category: "exception", fileRef: input.packageArtifacts.failedItemsRef },
  { artifactId: "data-completeness-report", type: "data-completeness-report", category: "integrity", fileRef: input.packageArtifacts.dataCompletenessReportRef },
  { artifactId: "package-integrity-report", type: "package-integrity-report", category: "integrity", fileRef: input.packageArtifacts.packageIntegrityReportRef },
  { artifactId: "ai-reading-contract", type: "ai-reading-contract", category: "handoff", fileRef: input.packageArtifacts.aiHandoff.aiReadingContractRef },
  { artifactId: "ai-handoff-prompt", type: "ai-handoff-prompt", category: "handoff", fileRef: input.packageArtifacts.aiHandoff.aiHandoffPromptRef },
  { artifactId: "handoff-record", type: "handoff-record", category: "handoff", fileRef: input.packageArtifacts.aiHandoff.handoffRecordRef },
  ...input.keywordArtifacts.map((artifact) => ({ artifactId: `keyword-${artifact.keywordId}`, type: "keyword-summary", category: "structured", fileRef: artifact.summaryRef })),
  ...input.productArtifacts.map((artifact) => ({ artifactId: `product-${artifact.detailId}`, type: "product-detail", category: "structured", fileRef: artifact.detailRef })),
  ...input.reviewArtifacts.map((artifact) => ({ artifactId: `review-${artifact.detailId}`, type: "reviews-jsonl", category: "review", fileRef: artifact.reviewsJsonlRef })),
];

const writeManifestAndIntegrityArtifacts = (input: {
  taskId: string;
  layout: AmazonPackageLayout;
  task: AmazonTaskRecord | null;
  runtime: PackageRuntimeState;
  evidence: PackageEvidenceState;
  taskScope: Record<string, unknown>;
  packageJson: ReturnType<typeof buildPackageJsonArtifact>;
  artifactRefs: readonly PackageArtifactRef[];
}): ReturnType<typeof buildPackageIntegrityReport> => {
  writeJsonFile(input.layout.manifestPath, buildManifestArtifact({
    layout: input.layout,
    task: input.task,
    keywordCount: input.runtime.keywords.length,
    searchResultCount: input.runtime.allSearchResults.length,
    productCount: input.runtime.products.length,
    reviewCount: input.runtime.totalReviews,
    exceptionCount: input.runtime.exceptions.length,
  }));
  writeJsonFile(input.layout.evidenceIndexPath, buildEvidenceIndex({
    taskId: input.taskId,
    keywordArtifacts: input.evidence.keywordArtifacts,
    productArtifacts: input.evidence.productArtifacts,
    reviewArtifacts: input.evidence.reviewArtifacts,
    reviewsByDetailId: input.runtime.reviewsByDetailId,
    imageEvidenceIndex: input.evidence.imageEvidenceIndex,
    artifactRefs: input.artifactRefs,
  }));
  const integrityReport = buildPackageIntegrityReport({
    taskId: input.taskId,
    layout: input.layout,
	    taskScope: input.taskScope,
	    packageType: input.packageJson.packageType,
	    keywordArtifacts: input.evidence.keywordArtifacts,
	    productArtifacts: input.evidence.productArtifacts,
    reviewArtifacts: input.evidence.reviewArtifacts,
    reviewsByDetailId: input.runtime.reviewsByDetailId,
    exceptions: input.runtime.exceptions,
    searchResults: input.runtime.allSearchResults,
    products: input.runtime.products,
    imageEvidenceIndex: input.evidence.imageEvidenceIndex,
    artifactRefs: input.artifactRefs,
  });
  writeJsonFile(input.layout.packageIntegrityReportPath, integrityReport);
  writeJsonFile(input.layout.packageFileHashesPath, buildPackageFileHashes({ taskId: input.taskId, layout: input.layout }));
  return integrityReport;
};

const buildPackageResult = (input: {
  layout: AmazonPackageLayout;
  integrityStatus: "pass" | "failed";
  runtime: PackageRuntimeState;
}): AmazonPackageResult => ({
  packageRootPath: input.layout.packageRootPath,
  packageJsonPath: input.layout.packageJsonPath,
  evidenceIndexPath: input.layout.evidenceIndexPath,
  exceptionSummaryPath: input.layout.exceptionSummaryPath,
  imageEvidenceIndexPath: input.layout.imageEvidenceIndexPath,
  dataCompletenessReportPath: input.layout.dataCompletenessReportPath,
  packageIntegrityReportPath: input.layout.packageIntegrityReportPath,
  masterReportHtmlPath: input.layout.masterReportHtmlPath,
  handoffRecordPath: input.layout.handoffRecordPath,
  integrityStatus: input.integrityStatus,
  productCount: input.runtime.products.length,
  reviewCount: input.runtime.totalReviews,
  keywordCount: input.runtime.keywords.length,
  searchResultCount: input.runtime.allSearchResults.length,
});

export const buildAmazonProductMiningPackage = async (input: AmazonPackageBuildInput): Promise<AmazonPackageResult> => {
  const layout = createAmazonPackageLayout({ dataDir: input.dataDir, taskId: input.taskId });
  const runtime = loadPackageRuntimeState({ taskId: input.taskId, storage: input.storage });
  const evidence = buildPackageEvidenceState({
    layout,
    runtime,
    ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
  });
  const taskScope = buildTaskScopeArtifact({
    taskId: input.taskId,
    task: runtime.task,
    keywords: runtime.keywords,
    ...(input.reviewMaxPages !== undefined ? { reviewMaxPages: input.reviewMaxPages } : {}),
    generatedAt: runtime.generatedAt,
  });
  const exceptionSummary = buildExceptionSummaryArtifact({
    taskId: input.taskId,
    exceptions: runtime.exceptions,
    manualRequiredItems: evidence.manualRequiredItems,
    failedItems: evidence.failedItems,
  });
  writePackageSideArtifacts({
    layout,
    taskScope,
    imageEvidenceIndex: evidence.imageEvidenceIndex,
    exceptionSummary,
    manualRequiredItems: evidence.manualRequiredItems,
    failedItems: evidence.failedItems,
    completenessReport: evidence.completenessReport,
  });
  const packageArtifacts = buildPackageArtifactsContract(layout);
  const packageJson = buildPackageJsonArtifact({
    taskId: input.taskId,
    generatedAt: runtime.generatedAt,
    taskScope,
    packageArtifacts,
    runtime,
    evidence,
  });
  writeJsonFile(layout.packageJsonPath, packageJson);
  const artifactRefs = buildPackageArtifactRefs({
    packageArtifacts,
    keywordArtifacts: evidence.keywordArtifacts,
    productArtifacts: evidence.productArtifacts,
    reviewArtifacts: evidence.reviewArtifacts,
  });
  const integrityReport = writeManifestAndIntegrityArtifacts({
    taskId: input.taskId,
    layout,
    task: runtime.task,
    runtime,
    evidence,
    taskScope,
    packageJson,
    artifactRefs,
  });
  return buildPackageResult({ layout, integrityStatus: integrityReport.status, runtime });
};
