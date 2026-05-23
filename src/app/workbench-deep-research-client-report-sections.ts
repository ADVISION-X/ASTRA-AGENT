import type {
  DeepResearchClientState,
  DeepResearchReport,
} from "./workbench-deep-research-client-contracts.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

declare const renderLedger: (payload: unknown) => void;

const {
  escapeText,
  exportActionLabel,
  formatDateTime,
  formatStatusLabel,
  renderAnswerCard,
  renderConfidenceBadge,
  renderEmptyReader,
  renderExpandableText,
  renderExportButtons,
  renderInteractionDebug,
  renderJsonDetails,
  renderListSection,
  renderMetaRow,
  renderStatusBadge,
  setResearchHtml,
  syncFormVisibility,
  toggleResearchHidden,
} = deepResearchClientSharedRuntime;

function renderReportHeader(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-report-header]", `
    <div class="research-report-kicker">
      ${renderStatusBadge(report.job.status)}
      ${renderConfidenceBadge(report.conclusion?.confidence)}
    </div>
    <h2>${escapeText(report.job.title)}</h2>
    <p class="research-lead">${escapeText(report.job.userQuestion)}</p>
    ${report.job.analysisGoal ? `<p class="muted">${escapeText(report.job.analysisGoal)}</p>` : ""}
    ${renderMetaRow([
      formatDateTime(report.job.updatedAt),
      `${report.job.subQuestionCount} subquestions`,
      `${report.job.interactionCount} interactions`,
      `${report.job.exportCount} exports`,
    ])}
    ${renderExportButtons(report.exports)}`);
}

function renderConclusionCard(report: DeepResearchReport): void {
  if (!report.conclusion) {
    setResearchHtml("[data-deep-research-final-card]", `
      <div class="research-card-head">
        <div>
          <p class="research-kicker">Final Conclusion</p>
          <h2>Final report not persisted yet</h2>
        </div>
      </div>
      <p class="muted">This report is still building. The reader will prioritize the final conclusion card as soon as the final synthesis is persisted.</p>`);
    return;
  }
  setResearchHtml("[data-deep-research-final-card]", `
    <div class="research-card-head">
      <div>
        <p class="research-kicker">Final Conclusion</p>
        <h2>${escapeText(report.job.title)}</h2>
      </div>
      ${renderConfidenceBadge(report.conclusion.confidence)}
    </div>
    ${renderExpandableText("Final Conclusion", report.conclusion.executiveConclusion, {
      summaryLabel: "More",
      className: "response-pre",
      previewLimit: 800,
    })}
    <div class="research-summary-grid">
      ${renderListSection("Core Reasons", report.conclusion.positiveReasons)}
      ${renderListSection("Strongest Opposing Arguments", report.conclusion.strongestOpposingArguments)}
      ${renderListSection("Reverse Conditions", report.conclusion.reverseConditions)}
      ${renderListSection("Evidence Gaps", report.conclusion.evidenceGaps)}
    </div>
    ${renderListSection("Follow-up Signals", report.conclusion.followUpSignals)}
    ${renderListSection("Limitations", report.conclusion.limitations)}`);
}

function renderStageOverview(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-stage-overview]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Stage Overview</p>
        <h2>1+N+N+1 research flow</h2>
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
        <h2>Original question and question tree</h2>
      </div>
    </div>
    <div class="research-article-card">
      ${renderExpandableText("Original Question", report.job.userQuestion, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 500,
      })}
      ${interaction ? renderInteractionDebug(interaction) : '<p class="muted">Decomposition interaction not persisted yet.</p>'}
    </div>
    <div class="research-question-tree">
      ${report.decomposition.subQuestions.length
        ? report.decomposition.subQuestions.map((subQuestion) => `
          <article class="research-question-card">
            <h3>Q${escapeText(subQuestion.ordinal + 1)}: ${escapeText(subQuestion.title)}</h3>
            <p>${escapeText(subQuestion.questionText)}</p>
            ${renderMetaRow([subQuestion.purpose, subQuestion.scope])}
          </article>`).join("")
        : '<p class="muted">No parsed sub-questions yet.</p>'}
    </div>`);
}

function renderSubQuestions(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-subquestions]", report.subQuestionReports.length
    ? report.subQuestionReports.map((entry) => `
      <section class="research-subquestion-section" id="subquestion-${escapeText(entry.subQuestion.id)}">
        <div class="research-section-head">
          <div>
            <p class="research-kicker">Sub-question</p>
            <h2>Q${escapeText(entry.subQuestion.ordinal + 1)}: ${escapeText(entry.subQuestion.title)}</h2>
          </div>
        </div>
        <div class="research-question-card research-question-card-full">
          <p>${escapeText(entry.subQuestion.questionText)}</p>
          ${renderMetaRow([entry.subQuestion.purpose, entry.subQuestion.scope, entry.subQuestion.expectedAnswerShape])}
        </div>
        <div class="research-analysis-grid">
          ${renderAnswerCard("Positive Analysis", entry.positive, "Positive analysis has not been persisted yet.")}
          ${renderAnswerCard("Falsification", entry.falsification, "Falsification has not been persisted yet.")}
        </div>
        <section class="research-conflict-card">
          <h3>Conflict Judgment</h3>
          ${entry.conflict ? `
            ${renderListSection("Positive Claim Summary", [entry.conflict.positiveClaimSummary])}
            ${renderListSection("Falsification Summary", [entry.conflict.falsificationSummary])}
            ${renderMetaRow([
              `conflict ${entry.conflict.conflictLevel}`,
              entry.conflict.needsHumanReview ? "needs human review" : "no human review required",
            ])}
            ${renderListSection("Evidence Gap", [entry.conflict.evidenceGap])}
          ` : '<p class="muted">Conflict matrix row has not been persisted yet.</p>'}
        </section>
      </section>`).join("")
    : '<section class="research-section"><p class="muted">No sub-question analysis has been persisted yet.</p></section>');
}

function renderFinalSynthesis(report: DeepResearchReport): void {
  const interaction = report.finalSynthesis.interaction;
  setResearchHtml("[data-deep-research-final-synthesis]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Final Synthesis</p>
        <h2>How the report is synthesized</h2>
      </div>
    </div>
    <div class="research-article-card">
      ${report.conclusion ? renderExpandableText("Parsed Final Report", report.conclusion.executiveConclusion, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 700,
      }) : '<p class="muted">Final synthesis has not been persisted yet.</p>'}
      ${interaction ? renderInteractionDebug(interaction) : ""}
      ${renderJsonDetails("Parsed Final Report JSON", report.finalSynthesis.parsedFinalReport, "Show Parsed Result")}
    </div>`);
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
    { id: "conclusion", label: "Conclusion" },
    { id: "decomposition", label: "Decomposition" },
    ...report.decomposition.subQuestions.map((subQuestion) => ({
      id: `subquestion-${subQuestion.id}`,
      label: `Q${subQuestion.ordinal + 1}`,
    })),
    { id: "final-synthesis", label: "Final Synthesis" },
    { id: "evidence", label: "Evidence" },
  ];
  setResearchHtml("[data-deep-research-nav]", navigation.map((item) => `<a href="#${escapeText(item.id)}">${escapeText(item.label)}</a>`).join(""));
  setResearchHtml("[data-deep-research-meta]", `
    <div class="research-side-meta-grid">
      <div><b>Status</b><span>${escapeText(formatStatusLabel(report.job.status))}</span></div>
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
  renderStageOverview(report);
  renderDecomposition(report);
  renderSubQuestions(report);
  renderFinalSynthesis(report);
  renderEvidence(report);
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
  renderReportHeader,
  renderConclusionCard,
  renderStageOverview,
  renderDecomposition,
  renderSubQuestions,
  renderFinalSynthesis,
  renderEvidence,
  renderSidePanels,
  renderSelectedReport,
] as const;