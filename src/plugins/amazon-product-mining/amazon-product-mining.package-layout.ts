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

export const AMAZON_PACKAGE_FILE_NAMES = {
  packageJson: "amazon-product-mining-package.json",
  pdfReport: "amazon-product-mining-report.pdf",
  evidenceIndex: "amazon-product-mining-evidence-index.json",
  exceptionSummary: "amazon-product-mining-exception-summary.json",
  handoffRecord: "amazon-product-mining-handoff-record.json",
  masterReportHtml: "master-report.html",
  imageEvidenceIndex: "image-evidence-index.json",
  dataCompletenessReport: "data-completeness-report.json",
  packageIntegrityReport: "package-integrity-report.json",
  keywordSearchEvidence: "keyword-search-evidence.json",
  productDetailEvidence: "product-detail-evidence.json",
  aiReadingContract: "ai-reading-contract.md",
  aiHandoffPrompt: "ai-handoff-prompt.md",
  businessBoundaryNotice: "business-boundary-notice.md",
  reviewEvidenceJsonl: "reviews.jsonl",
} as const;

export type AmazonPackageLayout = {
  artifactsDir: string;
  packageRootPath: string;
  masterReportDir: string;
  manifestDir: string;
  keywordSearchEvidenceDir: string;
  productDetailEvidenceDir: string;
  reviewEvidenceDir: string;
  aiHandoffDir: string;
  exceptionAndCompletenessDir: string;
  packageJsonPath: string;
  pdfReportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  handoffRecordPath: string;
  masterReportHtmlPath: string;
  imageEvidenceIndexPath: string;
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

export const createAmazonPackageLayout = (input: { dataDir: string; taskId: string }): AmazonPackageLayout => {
  const artifactsDir = resolveTaskArtifactsDir(input);
  const packageRootPath = resolveAmazonPackageRootPath(input);
  const masterReportDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.masterReport);
  const manifestDir = join(packageRootPath, AMAZON_PACKAGE_DIR_NAMES.manifest);
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
    keywordSearchEvidenceDir,
    productDetailEvidenceDir,
    reviewEvidenceDir,
    aiHandoffDir,
    exceptionAndCompletenessDir,
    packageJsonPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.packageJson),
    pdfReportPath: join(masterReportDir, AMAZON_PACKAGE_FILE_NAMES.pdfReport),
    evidenceIndexPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.evidenceIndex),
    exceptionSummaryPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.exceptionSummary),
    handoffRecordPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.handoffRecord),
    masterReportHtmlPath: join(masterReportDir, AMAZON_PACKAGE_FILE_NAMES.masterReportHtml),
    imageEvidenceIndexPath: join(manifestDir, AMAZON_PACKAGE_FILE_NAMES.imageEvidenceIndex),
    dataCompletenessReportPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.dataCompletenessReport),
    packageIntegrityReportPath: join(exceptionAndCompletenessDir, AMAZON_PACKAGE_FILE_NAMES.packageIntegrityReport),
    keywordSearchEvidencePath: join(keywordSearchEvidenceDir, AMAZON_PACKAGE_FILE_NAMES.keywordSearchEvidence),
    productDetailEvidencePath: join(productDetailEvidenceDir, AMAZON_PACKAGE_FILE_NAMES.productDetailEvidence),
    aiReadingContractPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.aiReadingContract),
    aiHandoffPromptPath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.aiHandoffPrompt),
    businessBoundaryNoticePath: join(aiHandoffDir, AMAZON_PACKAGE_FILE_NAMES.businessBoundaryNotice),
  };

  for (const dirPath of [
    artifactsDir,
    packageRootPath,
    masterReportDir,
    manifestDir,
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