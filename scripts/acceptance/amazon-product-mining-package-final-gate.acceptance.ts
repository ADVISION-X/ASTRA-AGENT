import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackageIntegrityReport } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-manifest.js";
import { createAmazonPackageLayout } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-layout.js";

const taskId = "task-final-gate";
const dataDir = mkdtempSync(join(tmpdir(), "amazon-mining-final-gate-"));
const layout = createAmazonPackageLayout({ dataDir, taskId });

const writeRequiredFiles = (html: string): void => {
  for (const filePath of [
    layout.packageJsonPath,
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
    layout.packageIntegrityReportPath,
    layout.aiReadingContractPath,
    layout.aiHandoffPromptPath,
    layout.handoffRecordPath,
  ]) {
    writeFileSync(filePath, filePath === layout.masterReportHtmlPath ? html : "{}\n", "utf8");
  }
};

const keywordArtifact = {
  keywordId: "kw-final",
  keyword: "final gate keyword",
  status: "completed",
  searchUrl: "https://www.amazon.ae/s?k=final+gate",
  dirPath: "",
  dirRef: "",
  summaryPath: "",
  summaryRef: "02-keyword-search-evidence/keyword-kw-final/keyword-summary.json",
  searchResultsPath: "",
  searchResultsRef: "02-keyword-search-evidence/keyword-kw-final/search-page-results.json",
  searchResultsCsvPath: "",
  searchResultsCsvRef: "02-keyword-search-evidence/keyword-kw-final/search-page-results.csv",
  rawVisibleTextPath: "",
  rawVisibleTextRef: "02-keyword-search-evidence/keyword-kw-final/search-page-raw-visible-text.txt",
  itemIds: ["item-final"],
  linkedDetailIds: ["detail-final"],
  sponsoredCount: 0,
  organicCount: 1,
  topProducts: [],
  exceptionIds: [],
};

const productArtifact = {
  detailId: "detail-final",
  asin: "B0FINALGATE",
  title: "Final Gate Product",
  dirPath: "",
  dirRef: "",
  summaryPath: "",
  summaryRef: "03-product-detail-evidence/product-detail-final/product-summary.json",
  detailPath: "",
  detailRef: "03-product-detail-evidence/product-detail-final/product-detail.json",
  rawVisibleTextPath: "",
  rawVisibleTextRef: "03-product-detail-evidence/product-detail-final/product-detail-raw-visible-text.txt",
  imagesIndexPath: "",
  imagesIndexRef: "03-product-detail-evidence/product-detail-final/product-images-index.json",
  sourceKeywordsPath: "",
  sourceKeywordsRef: "03-product-detail-evidence/product-detail-final/product-source-keywords.json",
  sourceKeywords: [{ itemId: "item-final", keywordId: "kw-final", keyword: "final gate keyword", rankPosition: 1, isSponsored: false, searchUrl: "https://www.amazon.ae/s?k=final+gate", productUrl: "https://www.amazon.ae/dp/B0FINALGATE", asinIfAvailable: "B0FINALGATE", title: "Final Gate Product" }],
  sourceItemIds: ["item-final"],
  missingFields: [],
  notPresentFields: [],
  blockedFields: [],
  unsupportedFields: [],
  manualRequiredFields: [],
  failedFields: [],
  extractorMissingFields: [],
  completenessScore: 100,
  warnings: [],
  exceptionIds: [],
};

const reviewArtifact = {
  detailId: "detail-final",
  asin: "B0FINALGATE",
  dirPath: "",
  dirRef: "",
  reviewsJsonlPath: "",
  reviewsJsonlRef: "04-review-evidence/product-detail-final/reviews.jsonl",
  reviewsSummaryPath: "",
  reviewsSummaryRef: "04-review-evidence/product-detail-final/reviews-summary.json",
  reviewPagesIndexPath: "",
  reviewPagesIndexRef: "04-review-evidence/product-detail-final/review-pages-index.json",
  capturedReviewCount: 1,
  pagesVisited: 1,
  hasImages: false,
  hasVideos: false,
  reviewStatus: "completed",
  warnings: [],
  representativeSamples: { positive: [], negative: [], withImages: [] },
};

const buildIntegrity = (input: {
  html: string;
  extractorMissingFields?: string[];
  keywordItemIds?: string[];
  keywordLinkedDetailIds?: string[];
  reviewArtifacts?: Array<typeof reviewArtifact>;
  imageEvidenceImages?: Array<{
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
  }>;
}) => {
  writeRequiredFiles(input.html);
  return buildPackageIntegrityReport({
    taskId,
    layout,
    taskScope: { status: "package_completed" },
    packageType: "amazon-product-mining-master-evidence-package",
    keywordArtifacts: [{ ...keywordArtifact, itemIds: input.keywordItemIds ?? keywordArtifact.itemIds, linkedDetailIds: input.keywordLinkedDetailIds ?? keywordArtifact.linkedDetailIds }],
    productArtifacts: [{ ...productArtifact, extractorMissingFields: input.extractorMissingFields ?? [] }],
    reviewArtifacts: input.reviewArtifacts ?? [reviewArtifact],
    reviewsByDetailId: new Map([["detail-final", []]]),
    exceptions: [],
    searchResults: [],
    products: [],
    imageEvidenceIndex: {
      taskId,
      mode: "url_only",
      warning: "Images are URL evidence unless localFileRef is present.",
      images: input.imageEvidenceImages ?? [{
        imageId: "image-final",
        imageType: "search_main_image",
        source: "search_result",
        taskId,
        keywordId: "kw-final",
        itemId: "item-final",
        detailId: null,
        reviewId: null,
        asin: "B0FINALGATE",
        url: "https://images.example.com/final.jpg",
        localFileRef: null,
        hash: null,
        caption: "Final Gate Product",
        appearsInMasterReport: true,
      }],
    },
    artifactRefs: [],
  });
};

const passingHtml = "Amazon Product Mining Master Evidence Report Chapter 6. Keyword Search Evidence kw-final item-final detail-final 04-review-evidence/product-detail-final/reviews.jsonl image-final";
assert.equal(buildIntegrity({ html: passingHtml }).status, "pass");

const brokenReport = buildIntegrity({ html: "Amazon Product Mining Master Evidence Report Chapter 6. Keyword Search Evidence kw-final" });
assert.equal(brokenReport.status, "failed");
assert.equal(brokenReport.failures.some((failure) => failure.checkId === "master_report_chain_readability"), true);

const brokenKeyword = buildIntegrity({ html: passingHtml, keywordLinkedDetailIds: [] });
assert.equal(brokenKeyword.status, "failed");
assert.equal(brokenKeyword.failures.some((failure) => failure.checkId === "keyword_evidence_chain_closure"), true);

const brokenKeywordReviews = buildIntegrity({ html: passingHtml, reviewArtifacts: [] });
assert.equal(brokenKeywordReviews.status, "failed");
assert.equal(brokenKeywordReviews.failures.some((failure) => failure.checkId === "keyword_evidence_chain_closure"), true);

const brokenKeywordImages = buildIntegrity({ html: passingHtml, imageEvidenceImages: [] });
assert.equal(brokenKeywordImages.status, "failed");
assert.equal(brokenKeywordImages.failures.some((failure) => failure.checkId === "keyword_evidence_chain_closure"), true);

const extractorMissing = buildIntegrity({ html: passingHtml, extractorMissingFields: ["starDistribution"] });
assert.equal(extractorMissing.status, "failed");
assert.equal(extractorMissing.failures.some((failure) => failure.checkId === "extractor_missing_zero_tolerance"), true);

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-package-final-gate\n");
