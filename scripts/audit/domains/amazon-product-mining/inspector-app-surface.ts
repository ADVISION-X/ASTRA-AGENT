import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const HOME_PAGE_PATH = "src/app/workbench-home-page.ts";
const HOME_CLIENT_PATH = "src/app/workbench-home-client.ts";
const FORBIDDEN_APP_SURFACE_TERMS = ["profit", "purchase", "sampling", "inventory", "finalSelection", "runId"] as const;

const getRequiredSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const trackSourceFile = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const literalText = (sourceFile: SourceFile): string => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
].join("\n");

const identifierText = (sourceFile: SourceFile): string =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()).join("\n");

const fileIncludesText = (sourceFile: SourceFile, text: string): boolean =>
  literalText(sourceFile).includes(text) || identifierText(sourceFile).includes(text);

const inspectHomePage = (
  pageFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const requiredPageTokens = [
    'data-job-card="amazon-product-mining"',
    'data-job-panel="amazon-product-mining"',
    'name="amazonMarketplace"',
    'name="targetMarket"',
    'name="productDirection"',
    'name="requestedKeywordCount"',
    'name="amazonKeywordProviderKind"',
    'value="gemini-api"',
    'value="gemini-web-chat"',
    'value="gpt-web-chat"',
    'name="languagePreference"',
    'data-amazon-product-mining-status',
  ];
  if (!pageFile || !requiredPageTokens.every((token) => fileIncludesText(pageFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/workbench-home-page-surface",
      lawId,
      filePath: HOME_PAGE_PATH,
      message: "workbench-home-page.ts must expose Amazon mining card, panel, required inputs, and status display.",
    }));
  }
  const pageText = pageFile ? `${literalText(pageFile)}\n${identifierText(pageFile)}`.toLowerCase() : "";
  for (const forbiddenTerm of FORBIDDEN_APP_SURFACE_TERMS) {
    if (!pageText.includes(forbiddenTerm.toLowerCase())) continue;
    findings.push(createFinding({
      checkId: `amazon-mining/workbench-home-page-forbidden-${forbiddenTerm.toLowerCase()}`,
      lawId,
      filePath: HOME_PAGE_PATH,
      message: `workbench-home-page.ts must not expose forbidden Amazon mining input term '${forbiddenTerm}'.`,
    }));
  }
};

const inspectHomeClient = (
  clientFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const requiredClientTokens = [
    "amazonProductMiningTaskId",
    "startAmazonProductMining",
    "refreshAmazonProductMiningLatest",
    "exportAmazonProductMining",
    "amazonKeywordProviderKind",
    "/api/amazon-product-mining/mission",
    "/api/amazon-product-mining/latest",
    "/api/amazon-product-mining/export?taskId=",
  ];
  if (!clientFile || !requiredClientTokens.every((token) => fileIncludesText(clientFile, token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/workbench-home-client-surface",
      lawId,
      filePath: HOME_CLIENT_PATH,
      message: "workbench-home-client.ts must expose Amazon mining state and start/latest/export client events.",
    }));
  }
  const clientText = clientFile ? `${literalText(clientFile)}\n${identifierText(clientFile)}` : "";
  for (const forbiddenToken of [
    "/api/amazon-product-mining/run?runId=",
    "/api/amazon-product-mining/export?runId=",
    "taskId || runId",
  ]) {
    if (!clientText.includes(forbiddenToken)) continue;
    findings.push(createFinding({
      checkId: `amazon-mining/workbench-home-client-forbidden-${forbiddenToken}`,
      lawId,
      filePath: HOME_CLIENT_PATH,
      message: `workbench-home-client.ts must remain taskId-only and must not include '${forbiddenToken}'.`,
    }));
  }
};

export const inspectWorkbenchHomeSurface = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const pageFile = getRequiredSourceFile(context, HOME_PAGE_PATH);
  const clientFile = getRequiredSourceFile(context, HOME_CLIENT_PATH);
  trackSourceFile(inspectedFiles, pageFile);
  trackSourceFile(inspectedFiles, clientFile);
  inspectHomePage(pageFile, findings, lawId);
  inspectHomeClient(clientFile, findings, lawId);
};

export const inspectArtifactOutputs = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const packageFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.package.ts");
  const packageLayoutFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.package-layout.ts");
  const packageArtifactBuildersFile = getRequiredSourceFile(
    context,
    "src/plugins/amazon-product-mining/amazon-product-mining.package-artifact-builders.ts",
  );
  const pdfFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts");
  const handoffFile = getRequiredSourceFile(context, "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts");
  trackSourceFile(inspectedFiles, packageFile);
  trackSourceFile(inspectedFiles, packageLayoutFile);
  trackSourceFile(inspectedFiles, packageArtifactBuildersFile);
  trackSourceFile(inspectedFiles, pdfFile);
  trackSourceFile(inspectedFiles, handoffFile);
  const packageText = [packageFile, packageLayoutFile, packageArtifactBuildersFile]
    .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined)
    .map((sourceFile) => literalText(sourceFile))
    .join("\n");
  const pdfText = pdfFile ? literalText(pdfFile) : "";
  const pdfIdentifiers = pdfFile ? identifierText(pdfFile) : "";
  const handoffText = handoffFile ? literalText(handoffFile) : "";
  const handoffIdentifiers = handoffFile ? identifierText(handoffFile) : "";
  const requiredNames = [
    "amazon-product-mining-package.json",
    "amazon-product-mining-evidence-index.json",
    "amazon-product-mining-exception-summary.json",
  ];
  if (!requiredNames.every((name) => packageText.includes(name))) {
    findings.push(createFinding({
      checkId: "amazon-mining/fixed-package-artifact-names",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
      message: "package.ts must write the fixed Amazon mining package, evidence index, and exception summary artifact names.",
    }));
  }
  const requiredAdvancedPackageTokens = [
    "00-master-report",
    "01-manifest",
    "02-keyword-search-evidence",
    "03-product-detail-evidence",
    "04-review-evidence",
    "05-ai-handoff",
    "06-exception-and-completeness",
    "keyword-search-evidence.json",
    "product-detail-evidence.json",
    "reviews.jsonl",
    "image-evidence-index.json",
    "data-completeness-report.json",
    "package-integrity-report.json",
    "url_only",
  ];
  if (!requiredAdvancedPackageTokens.every((token) => packageText.includes(token))) {
    findings.push(createFinding({
      checkId: "amazon-mining/advanced-package-structure",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.package-layout.ts",
      message: "Amazon package owner must define the production package directory tree, review JSONL evidence, image index, completeness report, and integrity report.",
    }));
  }
  if (!packageText.includes("pdf_report_pdf") || !packageText.includes("exception_summary_json") || !packageText.includes("handoff_record_json")) {
    findings.push(createFinding({
      checkId: "amazon-mining/evidence-index-artifact-coverage",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
      message: "package.ts must include PDF, exception summary, and handoff record entries in the evidence index.",
    }));
  }
  if (!packageText.includes("image_evidence_index_json") || !packageText.includes("data_completeness_report_json") || !packageText.includes("package_integrity_report_json") || !packageText.includes("review_evidence_jsonl")) {
    findings.push(createFinding({
      checkId: "amazon-mining/evidence-index-rich-artifact-coverage",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.package-artifact-builders.ts",
      message: "Amazon evidence index must catalog image evidence, completeness, integrity, and per-product review JSONL artifacts.",
    }));
  }
  if (!packageText.includes("amazon-product-mining-report.pdf") || !pdfIdentifiers.includes("pdfReportPath") || pdfText.includes("report.html")) {
    findings.push(createFinding({
      checkId: "amazon-mining/fixed-pdf-artifact-name",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
      message: "pdf.ts must write amazon-product-mining-report.pdf and must not return an HTML report as pdfReportPath.",
    }));
  }
  if (!pdfText.includes("%PDF-")) {
    findings.push(createFinding({
      checkId: "amazon-mining/pdf-signature",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
      message: "pdf.ts must produce a PDF artifact, not a non-PDF file behind a PDF path.",
    }));
  }
  if (!packageText.includes("master-report.html") || !pdfIdentifiers.includes("masterReportHtmlPath")) {
    findings.push(createFinding({
      checkId: "amazon-mining/master-report-html",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
      message: "pdf.ts must generate the companion master-report.html alongside the fixed PDF artifact.",
    }));
  }
  if (!packageText.includes("amazon-product-mining-handoff-record.json") || !handoffIdentifiers.includes("handoffRecordPath")) {
    findings.push(createFinding({
      checkId: "amazon-mining/fixed-handoff-artifact-name",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts",
      message: "handoff.ts must persist amazon-product-mining-handoff-record.json as a real artifact.",
    }));
  }
  if (!packageText.includes("ai-reading-contract.md") || !packageText.includes("ai-handoff-prompt.md") || !packageText.includes("business-boundary-notice.md") || !handoffIdentifiers.includes("aiReadingContractPath") || !handoffIdentifiers.includes("aiHandoffPromptPath") || !handoffIdentifiers.includes("businessBoundaryNoticePath")) {
    findings.push(createFinding({
      checkId: "amazon-mining/handoff-doc-bundle",
      lawId,
      filePath: "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts",
      message: "handoff.ts must emit AI reading contract, handoff prompt, and business boundary notice documents.",
    }));
  }
};
