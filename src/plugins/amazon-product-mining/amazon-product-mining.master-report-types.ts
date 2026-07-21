type ReportTask = {
  taskId?: string;
  amazonMarketplace?: string;
  targetMarket?: string;
  productDirection?: string;
  languagePreference?: string;
  keywordHistoryPolicy?: string;
  status?: string;
  handoffStatus?: string;
  failureReason?: string | null;
};

type ReportKeywordRun = {
  runId?: string;
  status?: string;
  failureReason?: string | null;
  promptTextRef?: string;
  rawResponseRef?: string;
  parsedKeywords?: string[];
  dedupedKeywords?: string[];
};

type ReportKeyword = {
  keywordId?: string;
  keyword?: string;
  status?: string;
  searchUrl?: string | null;
  searchResultCount?: number;
  sponsoredCount?: number;
  organicCount?: number;
  topProducts?: Array<{
    detailId?: string | null;
    asinIfAvailable?: string | null;
    title?: string | null;
    rankPosition?: number;
    productUrl?: string;
  }>;
  exceptionRefs?: string[];
};

type ReportProduct = {
  detailId?: string;
  asin?: string | null;
  identity?: {
    title?: string | null;
    brand?: string | null;
    sellerOrStoreIfVisible?: string | null;
  };
  images?: {
    mainImageUrl?: string | null;
    galleryImageUrls?: string[];
    aPlusImageUrls?: string[];
  };
  commerce?: {
    currentPrice?: string | null;
    rating?: string | null;
    reviewCount?: string | null;
    boughtInPastMonthIfVisible?: string | null;
    starDistribution?: string | null;
    bestSellersRankIfVisible?: string | null;
    categoryPathIfVisible?: string | null;
  };
  listing?: {
    bulletPoints?: string[];
    aboutThisItem?: string | null;
    productDescription?: string | null;
    aPlusContentIfVisible?: string | null;
    aPlusImageUrls?: string[];
  };
  parameters?: {
    variationOptions?: string | null;
    colorSizeStyleOptions?: string | null;
    productInformation?: string | null;
    technicalDetails?: string | null;
    additionalInformation?: string | null;
  };
  relatedModules?: {
    qaContentIfVisible?: string | null;
    frequentlyBoughtTogetherIfVisible?: string | null;
    customersAlsoBoughtIfVisible?: string | null;
    compareWithSimilarItemsIfVisible?: string | null;
  };
  sourceKeywords?: Array<{
    keyword?: string;
    rankPosition?: number;
    isSponsored?: boolean;
    searchUrl?: string;
  }>;
  reviews?: {
    capturedReviewCount?: number;
    pagesVisited?: number;
    summaryRef?: string;
    jsonlRef?: string;
    reviewPagesIndexRef?: string;
  };
  completeness?: {
    score?: number;
    missingFields?: string[];
    notPresentFields?: string[];
    blockedFields?: string[];
    unsupportedFields?: string[];
    manualRequiredFields?: string[];
    failedFields?: string[];
    extractorMissingFields?: string[];
    warnings?: string[];
    fieldDisclosures?: Record<string, unknown>;
    detailStatus?: string;
    reviewStatus?: string;
  };
  rawVisibleTextRef?: string;
  exceptions?: string[];
};

type ReportReviewIndex = {
  detailId?: string;
  asin?: string | null;
  capturedReviewCount?: number;
  pagesVisited?: number;
  hasImages?: boolean;
  hasVideos?: boolean;
  reviewsJsonlRef?: string;
  reviewsSummaryRef?: string;
  reviewPagesIndexRef?: string;
};

type ReportException = {
  exceptionId?: string;
  scope?: string;
  scopeId?: string | null;
  exceptionKind?: string;
  message?: string;
};

type ReportEvidenceIndex = {
  keywords?: Array<{
    keywordId?: string;
    keyword?: string;
    searchEvidenceRef?: string;
    rawVisibleTextRef?: string;
    searchResultRefs?: string[];
    productDetailRefs?: string[];
    reviewRefs?: string[];
    imageRefs?: string[];
    exceptionRefs?: string[];
  }>;
  products?: Array<{
    detailId?: string;
    asin?: string | null;
    productDetailRef?: string;
    rawVisibleTextRef?: string;
    sourceKeywordIds?: string[];
    sourceSearchItemRefs?: string[];
    reviewRefs?: {
      reviewsJsonlRef?: string | null;
      reviewsSummaryRef?: string | null;
      reviewPagesIndexRef?: string | null;
    };
    imageEvidenceRef?: string;
    exceptionRefs?: string[];
  }>;
  reviews?: Array<{
    detailId?: string;
    reviewsJsonlRef?: string;
    reviewsSummaryRef?: string;
    reviewPagesIndexRef?: string;
    capturedReviewCount?: number;
    pagesVisited?: number;
  }>;
  artifacts?: Array<{
    artifactId?: string;
    type?: string;
    fileRef?: string;
  }>;
};

type ReportCompleteness = {
  summary?: {
    keywordCountRequested?: number;
    keywordCountGenerated?: number;
    keywordCountCompleted?: number;
    searchResultCount?: number;
    uniqueProductDetailCount?: number;
    reviewCount?: number;
    exceptionCount?: number;
    manualRequiredCount?: number;
    failedCount?: number;
    packageCompletenessStatus?: string;
    reviewMaxPagesConfigured?: number | null;
  };
  products?: Array<{
    detailId?: string;
    asin?: string | null;
    detailStatus?: string;
    reviewStatus?: string;
    reviewPagesVisited?: number;
    reviewMaxPagesConfigured?: number | null;
    reviewRestriction?: string | null;
    missingFields?: string[];
    notPresentFields?: string[];
    blockedFields?: string[];
    unsupportedFields?: string[];
    manualRequiredFields?: string[];
    failedFields?: string[];
    extractorMissingFields?: string[];
    dataCompletenessScore?: number;
    warnings?: string[];
  }>;
};

type ReportIntegrity = {
  status?: string;
  checks?: Array<{
    checkId?: string;
    status?: string;
    detail?: string;
  }>;
  failures?: Array<{
    checkId?: string;
    detail?: string;
  }>;
};

type ReportPackage = {
  schemaVersion?: string;
  generatedAt?: string;
  task?: ReportTask;
  aiKeywordRuns?: ReportKeywordRun[];
  keywords?: ReportKeyword[];
  products?: ReportProduct[];
  reviewsIndex?: ReportReviewIndex[];
  exceptions?: ReportException[];
};

export type AmazonMasterReportInput = {
  packageData: ReportPackage | null;
  evidenceIndex: ReportEvidenceIndex | null;
  completenessReport: ReportCompleteness | null;
  integrityReport: ReportIntegrity | null;
  exceptionSummary: { exceptions?: ReportException[] } | null;
  aiReadingContractText: string | null;
  businessBoundaryNoticeText: string | null;
  generatedAt: string;
};
