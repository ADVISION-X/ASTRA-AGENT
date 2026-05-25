import type {
  DeepResearchClientState,
  DeepResearchReport,
} from "./workbench-deep-research-client-contracts.js";
import { deepResearchClientDeliverySectionsRuntime } from "./workbench-deep-research-client-delivery-sections.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

declare const renderLedger: (payload: unknown) => void;

const {
  escapeText,
  formatDateTime,
  formatStatusLabel,
  renderAnswerCard,
  renderEmptyReader,
  renderExpandableText,
  exportActionLabel,
  renderExportButtons,
  renderInteractionDebug,
  renderJsonDetails,
  renderListSection,
  renderMetaRow,
  renderStatusBadge,
  renderStructuredParsedResult,
  setResearchHtml,
  syncFormVisibility,
  toggleResearchHidden,
} = deepResearchClientSharedRuntime;

const {
  renderFullCaseFileDelivery,
  renderPrimaryBusinessReport,
} = deepResearchClientDeliverySectionsRuntime;

function renderFlowLabel(report: DeepResearchReport): string {
  return "Default 1+N+1+1";
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
      <span><b>${escapeText(renderFlowLabel(report))}</b></span>
      <span><b>${escapeText(report.job.subQuestionCount)}</b> subquestions</span>
      <span><b>${escapeText(report.job.interactionCount)}</b> interactions</span>
      <span><b>${escapeText(report.job.exportCount)}</b> exports</span>
      <span>${escapeText(formatDateTime(report.job.updatedAt))}</span>
    </div>
    ${renderExportButtons(report.exports)}`);
}

function renderStructuredConclusionPayload(report: DeepResearchReport): string {
  if (!report.conclusion?.parsedJsonIndex) {
    return "";
  }
  return renderJsonDetails("Parsed JSON Index", report.conclusion.parsedJsonIndex, "Show Parsed JSON Index");
}

function renderConclusionCard(report: DeepResearchReport): void {
  if (!report.conclusion) {
    setResearchHtml("[data-deep-research-final-card]", `
      <div class="research-card-head">
        <div>
          <p class="research-kicker">Final Adjudication</p>
          <h2>Final adjudication not persisted yet</h2>
        </div>
      </div>
      <p class="muted">This report is still building. The reader will prioritize the raw final adjudication card as soon as the final adjudication result is persisted.</p>`);
    return;
  }
  setResearchHtml("[data-deep-research-final-card]", `
    <div class="research-card-head">
      <div>
        <p class="research-kicker">Final Adjudication</p>
        <h2>Authoritative raw final adjudication</h2>
      </div>
    </div>
    ${renderExpandableText("Raw Final Adjudication", report.conclusion.rawFinalAnswerText, {
      summaryLabel: "Show Full Final Adjudication",
      className: "response-pre",
      previewLimit: 800,
    })}
    ${renderMetaRow([
      renderFlowLabel(report),
      report.conclusion.preferredFormat,
      report.conclusion.parseStatus,
    ])}
    ${renderStructuredConclusionPayload(report)}`);
}

function renderStageOverview(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-stage-overview]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Stage Overview</p>
        <h2>Default 1+N+1+1 research flow</h2>
      </div>
    </div>
    <div class="research-stage-grid">
      ${report.stages.map((stage) => `<article class="research-stage-item"><span>${escapeText(stage.label)}</span><span class="research-stage-chip research-stage-${escapeText(stage.status)}">${escapeText(formatStatusLabel(stage.status))}</span></article>`).join("")}
    </div>`);
}

function renderDecomposition(report: DeepResearchReport): void {
  const interaction = report.decomposition.interaction;
  setResearchHtml("[data-deep-research-decomposition]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Decomposition</p>
        <h2>Original question and bounded question set</h2>
      </div>
    </div>
    <div class="research-article-card">
      ${renderExpandableText("Original Question", report.job.userQuestion, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 500,
      })}
      ${interaction ? renderStructuredParsedResult("Parsed Decomposition", interaction.parsedJson) : ""}
      ${interaction ? renderInteractionDebug(interaction) : '<p class="muted">Decomposition interaction not persisted yet.</p>'}
    </div>
    <div class="research-question-tree">
      ${report.decomposition.subQuestions.length
        ? report.decomposition.subQuestions.map((subQuestion) => `
          <article class="research-question-card">
            <h3>Q${escapeText(subQuestion.ordinal + 1)}: ${escapeText(subQuestion.title)}</h3>
            <p>${escapeText(subQuestion.questionText)}</p>
            ${renderMetaRow([
              subQuestion.whyItMatters || subQuestion.purpose,
              subQuestion.decisionWeight,
              subQuestion.priority,
            ])}
            ${subQuestion.analysisFocus ? `<p class="muted">${escapeText(subQuestion.analysisFocus)}</p>` : ""}
            ${renderListSection("Required Evidence", subQuestion.requiredEvidence, { emptyText: "No explicit evidence requirements recorded." })}
            ${subQuestion.omissionRisk ? `<p class="muted">${escapeText(subQuestion.omissionRisk)}</p>` : ""}
          </article>`).join("")
        : '<p class="muted">No parsed sub-questions yet.</p>'}
    </div>`);
}

function renderDefaultSubQuestionSection(report: DeepResearchReport): string {
  return report.subQuestionReports.map((entry) => `
    <section class="research-subquestion-section" id="subquestion-${escapeText(entry.subQuestion.id)}">
      <div class="research-section-head">
        <div>
          <p class="research-kicker">Independent Analysis</p>
          <h2>Q${escapeText(entry.subQuestion.ordinal + 1)}: ${escapeText(entry.subQuestion.title)}</h2>
        </div>
      </div>
      <div class="research-question-card research-question-card-full">
        <p>${escapeText(entry.subQuestion.questionText)}</p>
        ${renderMetaRow([
          entry.subQuestion.whyItMatters || entry.subQuestion.purpose,
          entry.subQuestion.decisionWeight,
          entry.subQuestion.priority,
          entry.subQuestion.scope,
        ])}
        ${entry.subQuestion.analysisFocus ? `<p class="muted">${escapeText(entry.subQuestion.analysisFocus)}</p>` : ""}
      </div>
      <div class="research-analysis-grid">
        ${renderAnswerCard("Independent Analysis", entry.analysis, "Independent analysis has not been persisted yet.")}
      </div>
      <div class="research-summary-grid">
        ${renderListSection("Required Evidence", entry.subQuestion.requiredEvidence, { emptyText: "No required evidence recorded." })}
        ${renderListSection("Expected Answer Shape", [entry.subQuestion.expectedAnswerShape], { emptyText: "No expected answer shape recorded." })}
      </div>
      ${entry.subQuestion.omissionRisk ? `<section class="research-copy-block"><h3>Omission Risk</h3><p>${escapeText(entry.subQuestion.omissionRisk)}</p></section>` : ""}
    </section>`).join("");
}

function renderSubQuestions(report: DeepResearchReport): void {
  const html = report.subQuestionReports.length
    ? renderDefaultSubQuestionSection(report)
    : '<section class="research-section"><p class="muted">No sub-question analysis has been persisted yet.</p></section>';
  setResearchHtml("[data-deep-research-subquestions]", html);
}

function renderFinalAdjudication(report: DeepResearchReport): void {
  const interaction = report.finalAdjudication.interaction;
  const sectionLabel = "Final Adjudication";
  setResearchHtml("[data-deep-research-final-adjudication]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">${escapeText(sectionLabel)}</p>
        <h2>How the final adjudication was reached</h2>
      </div>
    </div>
    <div class="research-article-card">
      ${report.conclusion ? renderExpandableText("Raw Final Adjudication", report.conclusion.rawFinalAnswerText, {
        summaryLabel: "Show Full Final Adjudication",
        className: "response-pre",
        previewLimit: 700,
      }) : `<p class="muted">${escapeText(sectionLabel)} has not been persisted yet.</p>`}
      ${interaction ? renderStructuredParsedResult("Parsed Final Adjudication", interaction.parsedJson) : ""}
      ${interaction ? renderInteractionDebug(interaction) : ""}
      ${renderJsonDetails("Final Adjudication Record JSON", report.finalAdjudication.record, "Show Parsed Result")}
    </div>`);
}

function renderProcessTrace(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-process-trace]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Process Trace</p>
        <h2>Execution stages and persisted interaction evidence</h2>
      </div>
    </div>
    <div class="research-stage-grid">
      ${report.stages.map((stage) => `<article class="research-stage-item"><span>${escapeText(stage.label)}</span><span class="research-stage-chip research-stage-${escapeText(stage.status)}">${escapeText(formatStatusLabel(stage.status))}</span></article>`).join("")}
    </div>
    <div class="research-summary-grid">
      ${renderListSection("Trace Coverage", [
        `${report.job.interactionCount} persisted interactions`,
        `${report.job.subQuestionCount} persisted subquestions`,
        `${report.job.exportCount} export artifacts`,
      ], { emptyText: "No process-trace coverage recorded." })}
      ${report.conclusion ? renderListSection("Final Adjudication Metadata", [
        `preferredFormat: ${report.conclusion.preferredFormat}`,
        `parseStatus: ${report.conclusion.parseStatus}`,
      ], { emptyText: "No final adjudication metadata recorded." }) : ""}
    </div>
    <details class="research-evidence-root" open>
      <summary>Interaction Evidence</summary>
      <div class="research-evidence-body">
        ${report.evidence.length ? report.evidence.map((entry) => `
          <article class="research-evidence-item">
            <div class="research-evidence-top">
              ${renderStatusBadge(entry.phase)}
              <span class="muted">${escapeText(formatDateTime(entry.createdAt))}</span>
            </div>
            <h3>${escapeText(entry.headline)}</h3>
            <p>${escapeText(entry.summary || "No parsed summary recorded.")}</p>
            ${renderExpandableText("What we asked", entry.promptText || "", {
              summaryLabel: "Show Full Prompt",
              className: "prompt-pre",
              forceDetails: true,
              previewLimit: 360,
            })}
            ${renderExpandableText("What AI answered", entry.rawResponseText || "", {
              summaryLabel: "Show Full AI Response",
              className: "response-pre",
              forceDetails: true,
              previewLimit: 360,
            })}
            ${renderStructuredParsedResult("Parsed Result", entry.parsedJson)}
            ${renderJsonDetails("Parsed Result JSON", entry.parsedJson, "Show Parsed Result")}
          </article>`).join("") : '<p class="muted">No evidence recorded yet.</p>'}
      </div>
    </details>`);
}

function renderEvidence(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-evidence]", `
    <details class="research-evidence-root">
      <summary>Evidence / Debug</summary>
      <div class="research-evidence-body">
        <section class="research-evidence-exports">
          <h3>Export Artifacts</h3>
          ${report.exports.length ? report.exports.map((record) => `
            <article class="research-export-item">
              <div>
                <b>${escapeText(record.label)}</b>
                <span class="muted">${escapeText(formatDateTime(record.createdAt))}</span>
              </div>
              <button class="btn secondary" type="button" data-deep-research-export="${escapeText(record.exportKind)}">${escapeText(exportActionLabel(record.exportKind))}</button>
              <details>
                <summary>Debug metadata</summary>
                <dl class="research-debug-list">
                  <div><dt>fileName</dt><dd>${escapeText(record.fileName)}</dd></div>
                  <div><dt>filePath</dt><dd>${escapeText(record.filePath)}</dd></div>
                  <div><dt>fileHash</dt><dd>${escapeText(record.fileHash)}</dd></div>
                  <div><dt>payloadHash</dt><dd>${escapeText(record.payloadHash)}</dd></div>
                </dl>
              </details>
            </article>`).join("") : '<p class="muted">No export artifacts recorded yet.</p>'}
        </section>
        ${report.evidence.length ? report.evidence.map((entry) => `
          <article class="research-evidence-item">
            <div class="research-evidence-top">
              ${renderStatusBadge(entry.phase)}
              <span class="muted">${escapeText(formatDateTime(entry.createdAt))}</span>
            </div>
            <h3>${escapeText(entry.headline)}</h3>
            <p>${escapeText(entry.summary || "No parsed summary recorded.")}</p>
            ${renderExpandableText("What we asked", entry.promptText || "", {
              summaryLabel: "Show Full Prompt",
              className: "prompt-pre",
              forceDetails: true,
              previewLimit: 360,
            })}
            ${renderExpandableText("What AI answered", entry.rawResponseText || "", {
              summaryLabel: "Show Full AI Response",
              className: "response-pre",
              forceDetails: true,
              previewLimit: 360,
            })}
            ${renderStructuredParsedResult("What the system parsed", entry.parsedJson)}
            ${renderJsonDetails("What the system parsed", entry.parsedJson, "Show Parsed Result")}
            <details>
              <summary>Debug metadata</summary>
              <dl class="research-debug-list">
                <div><dt>interactionId</dt><dd>${escapeText(entry.interactionId)}</dd></div>
                <div><dt>promptHash</dt><dd>${escapeText(entry.promptHash)}</dd></div>
                <div><dt>rawResponseHash</dt><dd>${escapeText(entry.rawResponseHash)}</dd></div>
                <div><dt>domRef</dt><dd>${escapeText(entry.domRef || "-")}</dd></div>
                <div><dt>providerKind</dt><dd>${escapeText(entry.providerKind || "-")}</dd></div>
                <div><dt>parsedRecordIds</dt><dd>${escapeText((entry.parsedRecordIds || []).join(", ") || "-")}</dd></div>
              </dl>
              ${entry.providerProofJson ? renderExpandableText("providerProofJson", entry.providerProofJson, {
                summaryLabel: "Show Provider Proof",
                className: "raw-json-pre",
                forceDetails: true,
                previewLimit: 280,
              }) : ""}
            </details>
          </article>`).join("") : '<p class="muted">No evidence recorded yet.</p>'}
      </div>
    </details>`);
}

function renderSidePanels(report: DeepResearchReport): void {
  const navigation = [
    { id: "conclusion", label: "Final Result" },
    { id: "business-report", label: "Primary Business Report" },
    { id: "full-case-file", label: "Full Case File" },
    { id: "process-trace", label: "Process Trace" },
  ];
  setResearchHtml("[data-deep-research-nav]", navigation.map((item) => `<a href="#${escapeText(item.id)}">${escapeText(item.label)}</a>`).join(""));
  setResearchHtml("[data-deep-research-meta]", `
    <div class="research-side-meta-grid">
      <div><b>Status</b><span>${escapeText(formatStatusLabel(report.job.status))}</span></div>
      <div><b>Flow</b><span>${escapeText(renderFlowLabel(report))}</span></div>
      <div><b>Job ID</b><span>${escapeText(report.job.id)}</span></div>
      <div><b>Updated</b><span>${escapeText(formatDateTime(report.job.updatedAt))}</span></div>
      <div><b>Interactions</b><span>${escapeText(report.job.interactionCount)}</span></div>
      <div><b>Subquestions</b><span>${escapeText(report.job.subQuestionCount)}</span></div>
      <div><b>Exports</b><span>${escapeText(report.job.exportCount)}</span></div>
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
  });
  syncFormVisibility(state, true);
}

export const deepResearchClientReportRuntime = {
  renderSelectedReport,
} as const;

export const deepResearchClientReportFunctions = [
  renderFlowLabel, renderReportHeader, renderStructuredConclusionPayload, renderConclusionCard,
  renderStageOverview, renderDecomposition, renderDefaultSubQuestionSection,
  renderSubQuestions, renderFinalAdjudication, renderProcessTrace,
  renderFullCaseFileDelivery, renderPrimaryBusinessReport, renderEvidence, renderSidePanels, renderSelectedReport,
] as const;
