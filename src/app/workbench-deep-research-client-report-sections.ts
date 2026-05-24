import type {
  DeepResearchClientState,
  DeepResearchExportRecord,
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

function isLegacyFlow(report: DeepResearchReport): boolean {
  return report.job.flowMode === "legacy_1_n_n_1";
}

function renderFlowLabel(report: DeepResearchReport): string {
  return isLegacyFlow(report) ? "Legacy 1+N+N+1" : "Default 1+N+1";
}

function renderReportHeader(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-report-header]", `
    <div class="research-report-kicker">
      ${renderStatusBadge(report.job.status)}
      ${renderConfidenceBadge(report.conclusion?.confidence)}
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

function renderRankedConclusions(report: DeepResearchReport): string {
  const items = report.conclusion?.rankedConclusions ?? [];
  if (!items.length) {
    return "";
  }
  return `
    <section class="research-copy-block">
      <h3>Ranked Conclusions</h3>
      <div class="research-question-tree">
        ${items.map((item) => `
          <article class="research-question-card">
            <h4>#${escapeText(item.rank)} ${escapeText(item.conclusion)}</h4>
            <p>${escapeText(item.whyItMatters)}</p>
            ${renderMetaRow([
              item.strength,
              item.reverseCondition || null,
            ])}
            ${renderListSection("Applies To", item.appliesTo, { emptyText: "No explicit applicability recorded." })}
            ${renderListSection("Does Not Apply To", item.doesNotApplyTo, { emptyText: "No explicit exclusions recorded." })}
          </article>`).join("")}
      </div>
    </section>`;
}

function renderConclusionCard(report: DeepResearchReport): void {
  if (!report.conclusion) {
    setResearchHtml("[data-deep-research-final-card]", `
      <div class="research-card-head">
        <div>
          <p class="research-kicker">${escapeText(isLegacyFlow(report) ? "Final Synthesis" : "Final Adjudication")}</p>
          <h2>Final report not persisted yet</h2>
        </div>
      </div>
      <p class="muted">This report is still building. The reader will prioritize the final conclusion card as soon as the final adjudication result is persisted.</p>`);
    return;
  }
  const decisiveReasons = report.conclusion.decisiveReasons.length
    ? report.conclusion.decisiveReasons
    : report.conclusion.positiveReasons;
  const rejectedClaims = report.conclusion.weakOrRejectedClaims.length
    ? report.conclusion.weakOrRejectedClaims
    : report.conclusion.strongestOpposingArguments;
  setResearchHtml("[data-deep-research-final-card]", `
    <div class="research-card-head">
      <div>
        <p class="research-kicker">${escapeText(isLegacyFlow(report) ? "Final Synthesis" : "Final Adjudication")}</p>
        <h2>Decision-grade conclusion</h2>
      </div>
      ${renderConfidenceBadge(report.conclusion.confidence)}
    </div>
    ${renderExpandableText("Direct Answer", report.conclusion.directAnswer || report.conclusion.executiveConclusion, {
      summaryLabel: "More",
      className: "response-pre",
      previewLimit: 800,
    })}
    ${renderMetaRow([
      report.conclusion.finalVerdict || null,
      renderFlowLabel(report),
    ])}
    <div class="research-summary-grid">
      ${renderListSection("Decisive Reasons", decisiveReasons, { emptyText: "No decisive reasons recorded." })}
      ${renderListSection("Weak Or Rejected Claims", rejectedClaims, { emptyText: "No rejected claims recorded." })}
      ${renderListSection("Reverse Conditions", report.conclusion.reverseConditions, { emptyText: "No reverse conditions recorded." })}
      ${renderListSection("Evidence Gaps", report.conclusion.evidenceGaps, { emptyText: "No evidence gaps recorded." })}
    </div>
    ${renderRankedConclusions(report)}
    <div class="research-summary-grid">
      ${renderListSection("Applicability", report.conclusion.applicability, { emptyText: "No explicit applicability recorded." })}
      ${renderListSection("Non-Applicability", report.conclusion.nonApplicability, { emptyText: "No explicit exclusions recorded." })}
      ${renderListSection("Follow-up Signals", report.conclusion.followUpSignals, { emptyText: "No follow-up signals recorded." })}
      ${renderListSection("Multi-stage Value Added", report.conclusion.multiStageValueAdded, { emptyText: "No multi-stage value-added notes recorded." })}
    </div>
    ${renderListSection("Limitations", report.conclusion.limitations, { emptyText: "No limitations recorded." })}`);
}

function renderStageOverview(report: DeepResearchReport): void {
  setResearchHtml("[data-deep-research-stage-overview]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Stage Overview</p>
        <h2>${escapeText(isLegacyFlow(report) ? "Legacy 1+N+N+1 research flow" : "Default 1+N+1 research flow")}</h2>
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

function renderLegacySubQuestionSection(report: DeepResearchReport): string {
  return report.subQuestionReports.map((entry) => `
    <section class="research-subquestion-section" id="subquestion-${escapeText(entry.subQuestion.id)}">
      <div class="research-section-head">
        <div>
          <p class="research-kicker">Sub-question</p>
          <h2>Q${escapeText(entry.subQuestion.ordinal + 1)}: ${escapeText(entry.subQuestion.title)}</h2>
        </div>
      </div>
      <div class="research-question-card research-question-card-full">
        <p>${escapeText(entry.subQuestion.questionText)}</p>
        ${renderMetaRow([
          entry.subQuestion.whyItMatters || entry.subQuestion.purpose,
          entry.subQuestion.scope,
          entry.subQuestion.expectedAnswerShape,
        ])}
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
    </section>`).join("");
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
    ? (isLegacyFlow(report) ? renderLegacySubQuestionSection(report) : renderDefaultSubQuestionSection(report))
    : '<section class="research-section"><p class="muted">No sub-question analysis has been persisted yet.</p></section>';
  setResearchHtml("[data-deep-research-subquestions]", html);
}

function renderFinalAdjudication(report: DeepResearchReport): void {
  const interaction = report.finalAdjudication.interaction;
  const sectionLabel = isLegacyFlow(report) ? "Final Synthesis" : "Final Adjudication";
  setResearchHtml("[data-deep-research-final-adjudication]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">${escapeText(sectionLabel)}</p>
        <h2>${escapeText(isLegacyFlow(report) ? "How the legacy synthesis was built" : "How the final adjudication was reached")}</h2>
      </div>
    </div>
    <div class="research-article-card">
      ${report.conclusion ? renderExpandableText("Parsed Final Report", report.conclusion.directAnswer || report.conclusion.executiveConclusion, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 700,
      }) : `<p class="muted">${escapeText(sectionLabel)} has not been persisted yet.</p>`}
      ${interaction ? renderInteractionDebug(interaction) : ""}
      ${renderJsonDetails("Parsed Final Report JSON", report.finalAdjudication.parsedFinalReport, "Show Parsed Result")}
    </div>`);
}

function renderBusinessDeck(report: DeepResearchReport): void {
  if (!report.businessDeck) {
    setResearchHtml("[data-deep-research-business-deck]", `
      <div class="research-section-head">
        <div>
          <p class="research-kicker">Business Deck</p>
          <h2>Deck artifacts are not persisted yet</h2>
        </div>
      </div>
      <p class="muted">The deck secretary runs after final adjudication and persists the outline before PPTX export.</p>`);
    return;
  }
  const actionableExports = [report.businessDeck.pptxExport, report.businessDeck.outlineExport]
    .filter((record): record is DeepResearchExportRecord => Boolean(record));
  const actionButtons = actionableExports
    .map((record) => `<button class="btn secondary" type="button" data-deep-research-export="${escapeText(record.exportKind)}">${escapeText(exportActionLabel(record.exportKind))}</button>`)
    .join("");
  setResearchHtml("[data-deep-research-business-deck]", `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Business Deck</p>
        <h2>${escapeText(report.businessDeck.deckTitle || "Business decision presentation")}</h2>
      </div>
    </div>
    ${report.businessDeck.deckSubtitle ? `<p class="research-lead">${escapeText(report.businessDeck.deckSubtitle)}</p>` : ""}
    ${renderMetaRow([
      report.businessDeck.audience ? `audience ${report.businessDeck.audience}` : null,
      `${report.businessDeck.slideCount} slides`,
      report.businessDeck.generatedAt ? formatDateTime(report.businessDeck.generatedAt) : null,
    ])}
    <div class="research-delivery-strip">${actionButtons || '<span class="muted">No deck artifact buttons available yet.</span>'}</div>
    <div class="research-summary-grid">
      ${renderListSection("Deck Warnings", report.businessDeck.warnings, { emptyText: "No deck warnings recorded." })}
      ${report.businessDeck.preservationSummary ? renderListSection("Preservation Summary", [
        `Ranked conclusions used: ${report.businessDeck.preservationSummary.usedRankedConclusionCount}`,
        `Reverse conditions used: ${report.businessDeck.preservationSummary.usedReverseConditionCount}`,
        `Evidence gaps used: ${report.businessDeck.preservationSummary.usedEvidenceGapCount}`,
        `References used: ${report.businessDeck.preservationSummary.usedReferenceCount}`,
        `Omitted items: ${report.businessDeck.preservationSummary.omittedItemCount}`,
      ]) : ""}
    </div>
    <section class="research-copy-block">
      <h3>Slide Outline</h3>
      <div class="research-question-tree">
        ${report.businessDeck.slideSummaries.length
          ? report.businessDeck.slideSummaries.map((slide) => `
            <article class="research-question-card">
              <h4>#${escapeText(slide.slideNumber)} ${escapeText(slide.title)}</h4>
              <p>${escapeText(slide.headline)}</p>
              ${renderMetaRow([slide.slideType])}
            </article>`).join("")
          : '<p class="muted">No slide outline recorded.</p>'}
      </div>
    </section>`);
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
    {
      id: "final-adjudication",
      label: isLegacyFlow(report) ? "Final Synthesis" : "Final Adjudication",
    },
    ...(!isLegacyFlow(report) ? [{ id: "business-deck", label: "Business Deck" }] : []),
    { id: "evidence", label: "Evidence" },
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
  renderStageOverview(report);
  renderDecomposition(report);
  renderSubQuestions(report);
  renderFinalAdjudication(report);
  renderBusinessDeck(report);
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
  isLegacyFlow,
  renderFlowLabel,
  renderReportHeader,
  renderRankedConclusions,
  renderConclusionCard,
  renderStageOverview,
  renderDecomposition,
  renderLegacySubQuestionSection,
  renderDefaultSubQuestionSection,
  renderSubQuestions,
  renderFinalAdjudication,
  renderBusinessDeck,
  renderEvidence,
  renderSidePanels,
  renderSelectedReport,
] as const;
