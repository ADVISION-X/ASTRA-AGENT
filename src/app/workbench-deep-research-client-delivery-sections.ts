import type { DeepResearchReport } from "./workbench-deep-research-client-contracts.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

const {
  formatDateTime,
  renderListSection,
  renderMetaRow,
  setResearchHtml,
} = deepResearchClientSharedRuntime;

function findExport(report: DeepResearchReport, kind: string): DeepResearchReport["exports"][number] | null {
  return report.exports.find((record) => record.exportKind === kind) ?? null;
}

type PrimaryBusinessReportView = NonNullable<DeepResearchReport["primaryBusinessReport"]>;
type PrimaryBusinessReportWithExport = PrimaryBusinessReportView & {
  htmlExport: NonNullable<PrimaryBusinessReportView["htmlExport"]>;
};

function renderMissingFullCaseFileDelivery(report: DeepResearchReport): string {
  return `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Full Case File</p>
        <h2>Full case file not generated</h2>
      </div>
    </div>
    ${renderMetaRow([
      report.job.failureReason,
      report.job.reviewReason,
    ])}
    <p class="muted">The full case file is the prompt/response case record for final adjudication and HTML publishing. Markdown and JSON exports are missing.</p>`;
}

function renderFullCaseFileMeta(
  report: DeepResearchReport,
  fullCaseFileMarkdown: ReturnType<typeof findExport>,
  fullCaseFileJson: ReturnType<typeof findExport>,
): string {
  const summary = report.fullCaseFileSummary;
  return renderMetaRow([
    summary.hasMarkdown ? "Markdown exported" : null,
    summary.hasJson ? "JSON exported" : null,
    summary.finalRawPresent ? "Final raw present" : "Final raw missing",
    summary.htmlReportPresent ? "HTML export present" : "HTML export missing",
    fullCaseFileMarkdown?.createdAt ? formatDateTime(fullCaseFileMarkdown.createdAt) : fullCaseFileJson?.createdAt ? formatDateTime(fullCaseFileJson.createdAt) : null,
  ]);
}

function renderFullCaseFileActions(
  fullCaseFileMarkdown: ReturnType<typeof findExport>,
  fullCaseFileJson: ReturnType<typeof findExport>,
): string {
  return `
    <div class="research-delivery-strip">
      ${fullCaseFileMarkdown ? '<button class="btn secondary" type="button" data-deep-research-open-export="full-case-file.md">Open Full Case File</button>' : ""}
      ${fullCaseFileMarkdown ? '<button class="btn secondary" type="button" data-deep-research-export="full-case-file.md">Download full-case-file.md</button>' : ""}
      ${fullCaseFileJson ? '<button class="btn secondary" type="button" data-deep-research-export="full-case-file.json">Download full-case-file.json</button>' : ""}
    </div>`;
}

function renderFullCaseFileOutline(
  report: DeepResearchReport,
  fullCaseFileMarkdown: ReturnType<typeof findExport>,
  fullCaseFileJson: ReturnType<typeof findExport>,
): string {
  const summary = report.fullCaseFileSummary;
  return `
    <div class="research-summary-grid research-case-outline">
      ${renderListSection("Case Outline", [
        `Decomposition raw present: ${summary.decompositionRawPresent ? "yes" : "no"}`,
        `Analysis raw count: ${summary.analysisRawCount}`,
        `Sub-question count: ${summary.subQuestionCount}`,
        `Final raw present: ${summary.finalRawPresent ? "yes" : "no"}`,
        `HTML report export present: ${summary.htmlReportPresent ? "yes" : "no"}`,
      ], { emptyText: "No case outline recorded.", previewCount: 6 })}
      ${renderListSection("Artifact Hashes", [
        fullCaseFileMarkdown ? `Markdown: ${fullCaseFileMarkdown.fileHash}` : null,
        fullCaseFileJson ? `JSON: ${fullCaseFileJson.fileHash}` : null,
      ].filter((value): value is string => Boolean(value)), { emptyText: "No full case file hashes recorded." })}
    </div>`;
}

function renderMissingPrimaryBusinessReport(
  report: DeepResearchReport,
  primaryReport: PrimaryBusinessReportView | null,
): string {
  return `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Primary Business HTML Report</p>
        <h2>HTML artifact was not persisted</h2>
      </div>
    </div>
    ${renderMetaRow([
      primaryReport?.status || "missing",
      primaryReport?.failureReason || report.job.failureReason,
      primaryReport?.reviewReason || report.job.reviewReason,
    ])}
    <div class="research-delivery-status">
      <p class="muted">HTML report status: ${primaryReport?.status || "missing"}</p>
      <p class="muted">Reason: ${primaryReport?.failureReason || primaryReport?.reviewReason || report.job.failureReason || report.job.reviewReason || "No HTML artifact failure reason persisted."}</p>
    </div>`;
}

function renderPrimaryBusinessReportContent(primaryReport: PrimaryBusinessReportWithExport): string {
  return `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Primary Business HTML Report</p>
        <h2>AI-generated HTML decision report</h2>
      </div>
    </div>
    ${renderMetaRow([
      `Status ${primaryReport.status}`,
      `Generated by ${primaryReport.generatedBy}`,
      `Source ${primaryReport.sourceKind || "unknown"}`,
      primaryReport.generatedAt ? formatDateTime(primaryReport.generatedAt) : null,
    ])}
    <div class="research-delivery-strip">
      <button class="btn secondary" type="button" data-deep-research-open-export="business-report.html">Open HTML Report</button>
      <button class="btn secondary" type="button" data-deep-research-export="business-report.html">Download HTML Report</button>
    </div>
    <div class="research-summary-grid research-delivery-status">
      ${renderListSection("HTML Delivery Status", [
        `exportKind: ${primaryReport.htmlExport.exportKind}`,
        `fileName: ${primaryReport.htmlExport.fileName}`,
        `fileHash: ${primaryReport.htmlExport.fileHash}`,
        `fileSizeBytes: ${primaryReport.htmlExport.fileSizeBytes ?? "unknown"}`,
        `sourceKind: ${primaryReport.sourceKind || "unknown"}`,
      ], { emptyText: "No HTML delivery metadata recorded.", previewCount: 6 })}
      ${renderListSection("Delivery Review", [
        primaryReport.failureReason || null,
        primaryReport.reviewReason || null,
      ].filter((value): value is string => Boolean(value)), { emptyText: "No delivery failure or review reason recorded." })}
    </div>`;
}

function renderFullCaseFileDelivery(report: DeepResearchReport): void {
  const fullCaseFileMarkdown = findExport(report, "full-case-file.md");
  const fullCaseFileJson = findExport(report, "full-case-file.json");
  if (!fullCaseFileMarkdown && !fullCaseFileJson) {
    setResearchHtml("[data-deep-research-full-case-file]", renderMissingFullCaseFileDelivery(report));
    return;
  }
  setResearchHtml("[data-deep-research-full-case-file]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Full Case File</p>
        <h2>Complete prompt and response case record</h2>
      </div>
    </div>
    ${renderFullCaseFileMeta(report, fullCaseFileMarkdown, fullCaseFileJson)}
    ${renderFullCaseFileActions(fullCaseFileMarkdown, fullCaseFileJson)}
    ${renderFullCaseFileOutline(report, fullCaseFileMarkdown, fullCaseFileJson)}`);
}

function renderPrimaryBusinessReport(report: DeepResearchReport): void {
  const primaryReport = report.primaryBusinessReport;
  if (!primaryReport || !primaryReport.htmlExport) {
    setResearchHtml("[data-deep-research-primary-business-report]", renderMissingPrimaryBusinessReport(report, primaryReport));
    return;
  }
  const primaryReportWithExport = primaryReport as PrimaryBusinessReportWithExport;
  setResearchHtml("[data-deep-research-primary-business-report]", renderPrimaryBusinessReportContent(primaryReportWithExport));
}

export const deepResearchClientDeliverySectionsRuntime = {
  renderFullCaseFileDelivery,
  renderPrimaryBusinessReport,
} as const;

export const deepResearchClientDeliverySectionFunctions = [
  findExport,
  renderMissingFullCaseFileDelivery,
  renderFullCaseFileMeta,
  renderFullCaseFileActions,
  renderFullCaseFileOutline,
  renderMissingPrimaryBusinessReport,
  renderPrimaryBusinessReportContent,
  renderFullCaseFileDelivery,
  renderPrimaryBusinessReport,
] as const;
