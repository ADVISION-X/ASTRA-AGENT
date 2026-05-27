import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  AMAZON_PACKAGE_FILE_NAMES,
  createAmazonPackageLayout,
  resolveAmazonPackageRootPath,
} from "./amazon-product-mining.package-layout.js";

export type AmazonHandoffRecord = {
  taskId: string;
  packageRootPath: string;
  packageJsonPath: string;
  reportPath: string;
  masterReportHtmlPath: string;
  evidenceIndexPath: string;
  imageEvidenceIndexPath: string;
  exceptionSummaryPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  aiReadingContractPath: string;
  aiHandoffPromptPath: string;
  businessBoundaryNoticePath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  taskScope: {
    amazonMarketplace: string;
    targetMarket: string;
    productDirection: string;
    requestedKeywordCount: number;
    languagePreference: string;
  };
  dataCompletenessStatistics: {
    keywordCount: number;
    productCount: number;
    reviewCount: number;
  };
  handoffStatus: "ready" | "manual_required";
  manualRequiredReasons: string[];
  analysisBoundary: "external_advanced_ai_only";
  generatedAt: string;
};

export type PersistedAmazonHandoffRecord = AmazonHandoffRecord & {
  handoffRecordPath: string;
};

export const resolveAmazonHandoffRecordPath = (input: { dataDir: string; taskId: string }): string =>
  join(resolveAmazonPackageRootPath(input), "05-ai-handoff", AMAZON_PACKAGE_FILE_NAMES.handoffRecord);

const writeMarkdownFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, `${content.trimEnd()}\n`, "utf8");
};

const buildAiReadingContract = (input: {
  packageJsonPath: string;
  evidenceIndexPath: string;
  imageEvidenceIndexPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
  exceptionSummaryPath: string;
}) => `# AI Reading Contract

Read this package in the following order:

1. ${input.packageIntegrityReportPath}
2. ${input.dataCompletenessReportPath}
3. ${input.packageJsonPath}
4. ${input.evidenceIndexPath}
5. ${input.imageEvidenceIndexPath}
6. ${input.exceptionSummaryPath}
7. Per-product review JSONL files under 04-review-evidence

Hard constraints:

- Missing evidence stays missing. Do not invent absent price, rating, review volume, or product attributes.
- Treat image evidence as mode url_only pointers, not downloaded binary proof.
- Cite task IDs, keyword IDs, detail IDs, ASINs, and file paths when making comparative statements.
- Read completeness and integrity before any analytical summary.
- If integrity_status is manual_required, disclose the missing artifacts before any downstream reasoning.
`;

const buildAiHandoffPrompt = (input: {
  packageJsonPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  dataCompletenessReportPath: string;
  packageIntegrityReportPath: string;
}) => `# AI Handoff Prompt

You are receiving a structured Amazon product mining evidence package.

Input files:

- Package manifest: ${input.packageJsonPath}
- Evidence index: ${input.evidenceIndexPath}
- Exception summary: ${input.exceptionSummaryPath}
- Data completeness report: ${input.dataCompletenessReportPath}
- Package integrity report: ${input.packageIntegrityReportPath}

Required behavior:

- Use only the supplied package files.
- Start by assessing package integrity and completeness.
- Produce evidence-based comparative analysis of candidate products, keywords, review signals, and risk markers.
- Explicitly disclose gaps, blockers, and uncertainty.
- Do not invent missing evidence and do not treat sparse review data as strong proof.

Required output sections:

1. Package health check
2. Keyword landscape summary
3. Product evidence comparison
4. Review signal comparison
5. Risk and incompleteness disclosure
6. Evidence citations by file path and record id
`;

const buildBusinessBoundaryNotice = () => `# Business Boundary Notice

This package was produced by the Amazon Product Mining flow.

Boundary rules:

- The agent ends at evidence capture, persistence, packaging, reporting, and handoff.
- The agent does not output final product selection, purchase recommendation, sampling decision, inventory decision, ad-budget decision, or profit conclusion.
- Any downstream adjudication belongs to an external advanced AI or human operator and must disclose its own authorship.
`;

export const buildHandoffRecord = (input: {
  dataDir: string;
  taskId: string;
  packageJsonPath: string;
  reportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  amazonMarketplace?: string;
  targetMarket?: string;
  productDirection?: string;
  requestedKeywordCount?: number;
  languagePreference?: string;
  manualRequiredReasons: string[];
}): AmazonHandoffRecord => ({
  taskId: input.taskId,
  packageRootPath: resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }),
  packageJsonPath: input.packageJsonPath,
  reportPath: input.reportPath,
  masterReportHtmlPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "00-master-report", AMAZON_PACKAGE_FILE_NAMES.masterReportHtml),
  evidenceIndexPath: input.evidenceIndexPath,
  imageEvidenceIndexPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "01-manifest", AMAZON_PACKAGE_FILE_NAMES.imageEvidenceIndex),
  exceptionSummaryPath: input.exceptionSummaryPath,
  dataCompletenessReportPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "06-exception-and-completeness", AMAZON_PACKAGE_FILE_NAMES.dataCompletenessReport),
  packageIntegrityReportPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "06-exception-and-completeness", AMAZON_PACKAGE_FILE_NAMES.packageIntegrityReport),
  aiReadingContractPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "05-ai-handoff", AMAZON_PACKAGE_FILE_NAMES.aiReadingContract),
  aiHandoffPromptPath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "05-ai-handoff", AMAZON_PACKAGE_FILE_NAMES.aiHandoffPrompt),
  businessBoundaryNoticePath: join(resolveAmazonPackageRootPath({ dataDir: input.dataDir, taskId: input.taskId }), "05-ai-handoff", AMAZON_PACKAGE_FILE_NAMES.businessBoundaryNotice),
  productCount: input.productCount,
  reviewCount: input.reviewCount,
  keywordCount: input.keywordCount,
  taskScope: {
    amazonMarketplace: input.amazonMarketplace ?? "unknown",
    targetMarket: input.targetMarket ?? "unknown",
    productDirection: input.productDirection ?? "unknown",
    requestedKeywordCount: input.requestedKeywordCount ?? input.keywordCount,
    languagePreference: input.languagePreference ?? "en",
  },
  dataCompletenessStatistics: {
    keywordCount: input.keywordCount,
    productCount: input.productCount,
    reviewCount: input.reviewCount,
  },
  handoffStatus: input.manualRequiredReasons.length > 0 ? "manual_required" : "ready",
  manualRequiredReasons: [...input.manualRequiredReasons],
  analysisBoundary: "external_advanced_ai_only",
  generatedAt: new Date().toISOString(),
});

export const writeAmazonHandoffRecord = (input: {
  dataDir: string;
  taskId: string;
  packageJsonPath: string;
  reportPath: string;
  evidenceIndexPath: string;
  exceptionSummaryPath: string;
  productCount: number;
  reviewCount: number;
  keywordCount: number;
  amazonMarketplace?: string;
  targetMarket?: string;
  productDirection?: string;
  requestedKeywordCount?: number;
  languagePreference?: string;
  manualRequiredReasons: string[];
}): PersistedAmazonHandoffRecord => {
  const layout = createAmazonPackageLayout({ dataDir: input.dataDir, taskId: input.taskId });
  writeMarkdownFile(
    layout.aiReadingContractPath,
    buildAiReadingContract({
      packageJsonPath: input.packageJsonPath,
      evidenceIndexPath: input.evidenceIndexPath,
      imageEvidenceIndexPath: layout.imageEvidenceIndexPath,
      dataCompletenessReportPath: layout.dataCompletenessReportPath,
      packageIntegrityReportPath: layout.packageIntegrityReportPath,
      exceptionSummaryPath: input.exceptionSummaryPath,
    }),
  );
  writeMarkdownFile(
    layout.aiHandoffPromptPath,
    buildAiHandoffPrompt({
      packageJsonPath: input.packageJsonPath,
      evidenceIndexPath: input.evidenceIndexPath,
      exceptionSummaryPath: input.exceptionSummaryPath,
      dataCompletenessReportPath: layout.dataCompletenessReportPath,
      packageIntegrityReportPath: layout.packageIntegrityReportPath,
    }),
  );
  writeMarkdownFile(layout.businessBoundaryNoticePath, buildBusinessBoundaryNotice());

  const record = buildHandoffRecord(input);
  const handoffRecordPath = layout.handoffRecordPath;
  writeFileSync(handoffRecordPath, JSON.stringify(record, null, 2), "utf8");

  return {
    ...record,
    handoffRecordPath,
  };
};
