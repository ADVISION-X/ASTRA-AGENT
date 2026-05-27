import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { AMAZON_PRODUCT_MINING_ARTIFACTS_DIR } from "./amazon-product-mining.storage-schema.js";

export const AMAZON_PACKAGE_DIR_NAMES = {
  masterReport: "00-master-report",
  manifest: "01-manifest",
  keywordSearchEvidence: "02-keyword-search-evidence",
  productDetailEvidence: "03-product-detail-evidence",
  reviewEvidence: "04-review-evidence",
  aiHandoff: "05-ai-handoff",
  exceptionAndCompleteness: "06-exception-and-completeness",
} as const;

const AMAZON_PACKAGE_CORE_FILE_NAMES = {
  packageJson: "amazon-product-mining-package.json",
  manifest: "manifest.json",
  taskScope: "task-scope.json",
  packageSchema: "package-schema.json",
  pdfReport: "Amazon-Product-Mining-Master-Evidence-Report.pdf",
  evidenceIndex: "evidence-index.json",
  exceptionSummary: "exception-summary.json",
  manualRequired: "manual-required.json",
  failedItems: "failed-items.json",
  handoffRecord: "handoff-record.json",
  masterReportHtml: "Amazon-Product-Mining-Master-Evidence-Report.html",
  imageEvidenceIndex: "image-evidence-index.json",
  packageFileHashes: "package-file-hashes.json",
  dataCompletenessReport: "data-completeness-report.json",
  packageIntegrityReport: "package-integrity-report.json",
} as const;

const AMAZON_PACKAGE_EVIDENCE_FILE_NAMES = {
  keywordSearchEvidence: "keyword-search-evidence.json",
  productDetailEvidence: "product-detail-evidence.json",
  reviewEvidenceJsonl: "reviews.jsonl",
  keywordSummary: "keyword-summary.json",
  searchPageResults: "search-page-results.json",
  searchPageResultsCsv: "search-page-results.csv",
  searchPageRawVisibleText: "search-page-raw-visible-text.txt",
  productSummary: "product-summary.json",
  productDetail: "product-detail.json",
  productDetailRawVisibleText: "product-detail-raw-visible-text.txt",
  productImagesIndex: "product-images-index.json",
  productSourceKeywords: "product-source-keywords.json",
  reviewsSummary: "reviews-summary.json",
  reviewPagesIndex: "review-pages-index.json",
} as const;

const AMAZON_PACKAGE_HANDOFF_FILE_NAMES = {
  aiReadingContract: "ai-reading-contract.md",
  aiHandoffPrompt: "ai-handoff-prompt.md",
  businessBoundaryNotice: "business-boundary-notice.md",
} as const;

export const AMAZON_PACKAGE_FILE_NAMES = {
  ...AMAZON_PACKAGE_CORE_FILE_NAMES,
  ...AMAZON_PACKAGE_EVIDENCE_FILE_NAMES,
  ...AMAZON_PACKAGE_HANDOFF_FILE_NAMES,
} as const;

export type AmazonPackageLayout = {
  artifactsDir: string;
  packageRootPath: string;
  masterReportDir: string;
  manifestDir: string;
  aiKeywordRunsDir: string;
  keywordSearchEvidenceDir: string;
  productDetailEvidenceDir: string;
  reviewEvidenceDir: string;
  aiHandoffDir: string;
  exceptionAndCompletenessDir: string;
  packageJsonPath: string;
  manifestPath: string;
  taskScopePath: string;
  packageSchemaPath: string;
  pdfReportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  manualRequiredPath: string;
  failedItemsPath: string;
  handoffRecordPath: string;
  masterReportHtmlPath: string;
  imageEvidenceIndexPath: string;
  packageFileHashesPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  keywordSearchEvidencePath: string;
  productDetailEvidencePath: string;
  aiReadingContractPath: string;
  aiHandoffPromptPath: string;
  businessBoundaryNoticePath: string;
};

const resolveTaskArtifactsDir = (input: { dataDir: string; taskId: string }): string =>
  resolve(input.dataDir, AMAZON_PRODUCT_MINING_ARTIFACTS_DIR, input.taskId);

export const resolveAmazonPackageRootPath = (input: { dataDir: string; taskId: string }): string =>
  join(resolveTaskArtifactsDir(input), `amazon-product-mining-package-${input.taskId}`);

export const resolveAmazonPackageZipPath = (input: { dataDir: string; taskId: string }): string =>
  join(resolveTaskArtifactsDir(input), `amazon-product-mining-package-${input.taskId}.zip`);

export const createAmazonPackageLayout = (input: { dataDir: string; taskId: string }): AmazonPackageLayout => {
  const artifactsDir = resolveTaskArtifactsDir(input);
  const packageRootPath = resolveAmazonPackageRootPath(input);
  const masterReportDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.masterReport);
  const manifestDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.manifest);
  const aiKeywordRunsDir = join(manifestDir, "ai-keyword-runs");
  const keywordSearchEvidenceDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.keywordSearchEvidence);
  const productDetailEvidenceDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.productDetailEvidence);
  const reviewEvidenceDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.reviewEvidence);
  const aiHandoffDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.aiHandoff);
  const exceptionAndCompletenessDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.exceptionAndCompleteness);

  const layout: AmazonPackageLayout = {
    artifactsDir,
    packageRootPath,
    masterReportDir,
    manifestDir,
    aiKeywordRunsDir,
    keywordSearchEvidenceDir,
    productDetailEvidenceDir,
    reviewEvidenceDir,
    aiHandoffDir,
    exceptionAndCompletenessDir,
    packageJsonPath: join(packageRootPath, AMAZON_PACKAGE_FILE_NAMES.packageJson),
    manifestPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.manifest),
    taskScopePath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.taskScope),
    packageSchemaPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.packageSchema),
    pdfReportPath: join(masterReportDir, AMAZON_PACKAGE_FILE_NAMES.pdfReport),
    evidenceIndexPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.evidenceIndex),
    exceptionSummaryPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.exceptionSummary),
    manualRequiredPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.manualRequired),
    failedItemsPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.failedItems),
    handoffRecordPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.handoffRecord),
    masterReportHtmlPath: join(masterReportDir, AMAZON_PACKAGE_FILE_NAMES.masterReportHtml),
    imageEvidenceIndexPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.imageEvidenceIndex),
    packageFileHashesPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.packageFileHashes),
    dataCompletenessReportPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.dataCompletenessReport),
    packageIntegrityReportPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.packageIntegrityReport),
    keywordSearchEvidencePath: join(keywordSearchEvidenceDir, AMAZON_PACKAGE_FILE_NAMES.keywordSearchEvidence),
    productDetailEvidencePath: join(productDetailEvidenceDir, AMAZON_PACKAGE_FILE_NAMES.productDetailEvidence),
    aiReadingContractPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.aiReadingContract),
    aiHandoffPromptPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.aiHandoffPrompt),
    businessBoundaryNoticePath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.businessBoundaryNotice),
  };

  for (const dirPath of [
    artifactsDir,
    packageRootPath,
    masterReportDir,
    manifestDir,
    aiKeywordRunsDir,
    keywordSearchEvidenceDir,
    productDetailEvidenceDir,
    reviewEvidenceDir,
    aiHandoffDir,
    exceptionAndCompletenessDir,
  ]) {
    mkdirSync(dirPath, { recursive: true });
  }

  return layout;
};