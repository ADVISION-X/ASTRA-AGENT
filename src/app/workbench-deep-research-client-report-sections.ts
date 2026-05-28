import type {
  DeepResearchClientState,
  DeepResearchReport,
} from "./workbench-deep-research-client-contracts.js";
import { deepResearchClientCaseReaderRuntime } from "./workbench-deep-research-client-case-reader.js";
import { deepResearchClientDeliverySectionsRuntime } from "./workbench-deep-research-client-delivery-sections.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

declare const renderLedger: (payload: unknown, options?: { job?: string }) => void;

const {
  escapeText,
  formatDateTime,
  formatStatusLabel,
  renderEmptyReader,
  renderExpandableText,
  renderInteractionDebug,
  renderJsonDetails,
  renderListSection,
  renderMetaRow,
  renderStatusBadge,
  setResearchHtml,
  syncFormVisibility,
  toggleResearchHidden,
} = deepResearchClientSharedRuntime;

const {
  renderResearchPlanSection,
  renderAnalysisCardsSection,
} = deepResearchClientCaseReaderRuntime;

const {
  renderFullCaseFileDelivery,
  renderPrimaryBusinessReport,
} = deepResearchClientDeliverySectionsRuntime;

function renderFlowLabel(): string {
  return "PromptBundle 1+N+1+1";
}

function renderChainProgress(report: DeepResearchReport): string {
  const stages = report.stages.filter((stage) => [
    "stage-decompose",
    "stage-analyze-n",
    "stage-final-adjudication",
    "stage-html-report",
  ].includes(stage.id));
  return `
    <div class="research-chain-strip" aria-label="PromptBundle 1+N+1+1 chain">
      ${stages.map((stage, index) => `
        <a class="research-chain-step research-chain-${escapeText(stage.status)}" href="#${escapeText(stage.anchorId)}">
          <span class="research-chain-index">${escapeText(index === 0 ? "1" : index === 1 ? "N" : "+1")}</span>
          <b>${escapeText(stage.label)}</b>
          ${renderStatusBadge(stage.status)}
        </a>`).join("")}
    </div>`;
}

function renderPrimaryHtmlActions(report: DeepResearchReport): string {
  if (!report.primaryBusinessReport?.htmlExport) {
    return "";
  }
  return `
    <div class="research-primary-actions">
      <button class="btn" type="button" data-deep-research-open-export="business-report.html">Open HTML Report</button>
      <button class="btn secondary" type="button" data-deep-research-export="business-report.html">Download HTML Report</button>
    </div>`;
}

function renderReportHeader(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-report-header]", `
    <div class="research-report-kicker">
      ${renderStatusBadge(report.job.status)}
    </div>
    <h2>${escapeText(report.job.title)}</h2>
    <p class="research-lead">${escapeText(report.job.userQuestion)}</p>
    ${report.job.analysisGoal ? `<p class="muted">${escapeText(report.job.analysisGoal)}</p>` : ""}
    <div class="research-delivery-strip">
      <span><b>${escapeText(renderFlowLabel())}</b></span>
      <span><b>${escapeText(report.job.subQuestionCount)}</b> subquestions</span>
      <span><b>${escapeText(report.job.interactionCount)}</b> interactions</span>
      <span><b>${escapeText(report.job.exportCount)}</b> exports</span>
      <span>${escapeText(formatDateTime(report.job.updatedAt))}</span>
    </div>
    ${renderChainProgress(report)}
    ${renderPrimaryHtmlActions(report)}`);
}

function renderConclusionCard(report: DeepResearchReport): void {
  if (!report.conclusion) {
    setResearchHtml("[data-deep-research-final-card]", `
      <div class="research-card-head">
        <div>
          <p class="research-kicker">Final Adjudication Raw</p>
          <h2>Final adjudication not persisted yet</h2>
        </div>
      </div>
      <p class="muted">The case reader will render the raw final adjudication as soon as the final stage persists.</p>`);
    return;
  }
  setResearchHtml("[data-deep-research-final-card]", `
    <div class="research-card-head">
      <div>
        <p class="research-kicker">Final Adjudication Raw</p>
        <h2>Authoritative raw final adjudication</h2>
      </div>
    </div>
    ${renderExpandableText("Raw Final Adjudication", report.conclusion.rawFinalAnswerText, {
      summaryLabel: "Show Full Final Adjudication",
      className: "response-pre",
      previewLimit: 700,
    })}
    ${renderMetaRow([
      renderFlowLabel(),
      report.conclusion.preferredFormat,
      report.conclusion.parseStatus,
    ])}
    ${report.conclusion.parsedJsonIndex ? renderJsonDetails("Parsed JSON Index", report.conclusion.parsedJsonIndex, "Show Parsed JSON Index") : ""}
    ${renderInteractionDebug(report.finalAdjudication.interaction)}
  `);
}

function renderResearchPlan(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-research-plan]", renderResearchPlanSection(report));
}

function renderAnalysisCards(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-analysis-cards]", renderAnalysisCardsSection(report));
}

function renderProcessTrace(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-process-trace]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Process Trace</p>
        <h2>Single-chain execution trace</h2>
      </div>
    </div>
    <div class="research-plan-grid">
      ${report.stages.map((stage) => `
        <article class="research-stage-item research-case-outline">
          <div class="research-analysis-head">
            <div>
              <h3>${escapeText(stage.label)}</h3>
              <p class="muted">${escapeText(stage.recordCount)} record(s)</p>
            </div>
            ${renderStatusBadge(stage.status)}
          </div>
          ${renderMetaRow([
            stage.failureReason,
            stage.reviewReason,
          ])}
          ${stage.promptHashes.length ? renderListSection("Prompt Hashes", stage.promptHashes, { emptyText: "No prompt hashes recorded.", previewCount: 3 }) : ""}
          ${stage.rawResponseHashes.length ? renderListSection("Raw Response Hashes", stage.rawResponseHashes, { emptyText: "No raw response hashes recorded.", previewCount: 3 }) : ""}
          ${stage.parseStatuses.length ? renderListSection("Parse Status", stage.parseStatuses, { emptyText: "No parse status recorded.", previewCount: 5 }) : ""}
        </article>`).join("")}
    </div>`);
}

function renderSidePanels(report: DeepResearchReport): void {
  const navigation = [
    { id: "conclusion", label: "Final Adjudication Raw" },
    { id: "business-report", label: "Primary Business HTML Report" },
    { id: "research-plan", label: "ResearchPlan" },
    { id: "analysis-cards", label: "Analysis Cards" },
    { id: "full-case-file", label: "Full Case File" },
    { id: "process-trace", label: "Process Trace" },
  ];
  setResearchHtml("[data-deep-research-nav]", navigation.map((item) => `<a href="#${escapeText(item.id)}">${escapeText(item.label)}</a>`).join(""));
  setResearchHtml("[data-deep-research-meta]", `
    <div class="research-side-meta-grid">
      <div><b>Status</b><span>${escapeText(formatStatusLabel(report.job.status))}</span></div>
      <div><b>Phase</b><span>${escapeText(report.job.phase)}</span></div>
      <div><b>Job ID</b><span>${escapeText(report.job.id)}</span></div>
      <div><b>Updated</b><span>${escapeText(formatDateTime(report.job.updatedAt))}</span></div>
      <div><b>Interactions</b><span>${escapeText(report.job.interactionCount)}</span></div>
      <div><b>Subquestions</b><span>${escapeText(report.job.subQuestionCount)}</span></div>
      <div><b>Exports</b><span>${escapeText(report.job.exportCount)}</span></div>
      <div><b>HTML</b><span>${escapeText(formatStatusLabel(report.primaryBusinessReport?.status || "missing"))}</span></div>
      <div><b>Reason</b><span>${escapeText(report.job.failureReason || report.job.reviewReason || "-")}</span></div>
    </div>`);
}

function renderSelectedReport(state: DeepResearchClientState, report: DeepResearchReport | null): void {
  if (!report) {
    renderEmptyReader("No report selected");
    syncFormVisibility(state, false);
    return;
  }
  toggleResearchHidden("[data-deep-research-empty]", true);
  toggleResearchHidden("[data-deep-research-report]", false);
  renderReportHeader(report);
  renderConclusionCard(report);
  renderPrimaryBusinessReport(report);
  renderResearchPlan(report);
  renderAnalysisCards(report);
  renderFullCaseFileDelivery(report);
  renderProcessTrace(report);
  renderSidePanels(report);
  renderLedger({
    record: {
      taskId: report.job.id,
      status: report.job.status,
      reachedStep: report.job.phase,
      reason: report.job.failureReason || report.job.reviewReason || "-",
      evidence: report.exports.length ? `${report.exports.length} export artifacts available` : "-",
    },
  }, { job: "deep-research" });
  syncFormVisibility(state, true);
}

export const deepResearchClientReportRuntime = {
  renderSelectedReport,
} as const;

export const deepResearchClientReportFunctions = [
  renderFlowLabel,
  renderChainProgress,
  renderPrimaryHtmlActions,
  renderReportHeader,
  renderConclusionCard,
  renderResearchPlan,
  renderAnalysisCards,
  renderProcessTrace,
  renderSidePanels,
  renderSelectedReport,
] as const;
