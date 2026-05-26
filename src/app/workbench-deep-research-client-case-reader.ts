import type {
  DeepResearchAnswerBlock,
  DeepResearchInteraction,
  DeepResearchPromptBundleView,
  DeepResearchReport,
} from "./workbench-deep-research-client-contracts.js";

declare const escapeText: (value: unknown) => string;
declare const renderExpandableText: (
  title: string,
  value: unknown,
  options?: {
    emptyText?: string;
    previewLimit?: number;
    forceDetails?: boolean;
    summaryLabel?: string;
    className?: string;
  },
) => string;
declare const renderJsonDetails: (title: string, value: unknown, summaryLabel?: string) => string;
declare const renderListSection: (
  title: string,
  values: unknown,
  options?: { emptyText?: string; previewCount?: number },
) => string;
declare const renderMetaRow: (items: readonly (string | number | null | undefined)[]) => string;
declare const renderStatusBadge: (status: string | null | undefined) => string;
declare const formatStatusLabel: (value: string | null | undefined) => string;
declare const renderInteractionDebug: (interaction: DeepResearchInteraction | null) => string;

function renderPromptBundleOutputGuidance(promptBundle: DeepResearchPromptBundleView): string {
  return `
    <div class="research-summary-grid">
      ${renderListSection("Must Use Inputs", promptBundle.mustUseInputs, { emptyText: "No required inputs recorded.", previewCount: 6 })}
      ${renderListSection("Question-Specific Focus", promptBundle.questionSpecificFocus, { emptyText: "No question-specific focus recorded.", previewCount: 6 })}
      ${renderListSection("Evidence / Reasoning Needs", promptBundle.evidenceOrReasoningNeeds, { emptyText: "No evidence or reasoning needs recorded.", previewCount: 6 })}
      ${renderListSection("Must Not Do", promptBundle.mustNotDo, { emptyText: "No explicit prohibitions recorded.", previewCount: 6 })}
      ${renderListSection("Required Content", promptBundle.outputGuidance.requiredContent, { emptyText: "No required content recorded.", previewCount: 6 })}
      ${renderListSection("Supplemental Content", promptBundle.outputGuidance.supplementalContent, { emptyText: "No supplemental content recorded.", previewCount: 6 })}
      ${renderListSection("Forbidden Content", promptBundle.outputGuidance.forbiddenContent, { emptyText: "No forbidden content recorded.", previewCount: 6 })}
      ${renderListSection("Safety Boundary", promptBundle.safetyBoundary, { emptyText: "No safety boundary recorded.", previewCount: 6 })}
    </div>`;
}

export function renderPromptBundleDetails(title: string, promptBundle: DeepResearchPromptBundleView | null): string {
  if (!promptBundle) {
    return `<section class="research-copy-block research-promptbundle-panel"><h3>${escapeText(title)}</h3><p class="muted">PromptBundle was not persisted.</p></section>`;
  }
  return `
    <section class="research-copy-block research-promptbundle-panel">
      <h3>${escapeText(title)}</h3>
      ${renderMetaRow([
        promptBundle.promptBundleId,
        formatStatusLabel(promptBundle.promptRole),
        `Preferred format ${promptBundle.outputGuidance.preferredFormat}`,
      ])}
      ${renderExpandableText("Task Instruction", promptBundle.taskInstruction, {
        summaryLabel: "Show Full Task Instruction",
        className: "response-pre",
        previewLimit: 320,
      })}
      ${renderPromptBundleOutputGuidance(promptBundle)}
      ${renderExpandableText("Language Instruction", promptBundle.languageInstruction, {
        summaryLabel: "Show Full Language Instruction",
        className: "response-pre",
        previewLimit: 240,
      })}
    </section>`;
}

function renderRenderedPrompt(interaction: DeepResearchInteraction | null): string {
  return renderExpandableText("Rendered Prompt", interaction?.promptText ?? "", {
    summaryLabel: "Show Full Prompt",
    className: "prompt-pre",
    forceDetails: true,
    emptyText: "Rendered prompt was not persisted.",
  });
}

function renderCleanAnswer(block: DeepResearchAnswerBlock | null): string {
  return `
    <section class="research-copy-block research-answer-clean">
      ${renderExpandableText("Clean Answer", block?.answerText ?? "", {
        summaryLabel: "Show Full Clean Answer",
        className: "response-pre",
        previewLimit: 520,
        emptyText: "No clean answer persisted yet.",
      })}
      <p class="muted">If Clean Answer appears to be a JSON envelope, check the Runtime Format Shell.</p>
    </section>`;
}

function renderIndexView(block: DeepResearchAnswerBlock | null): string {
  if (!block) {
    return `<section class="research-copy-block research-answer-index"><h3>Index JSON / Index Notes</h3><p class="muted">No index persisted. Raw answer remains the source record.</p></section>`;
  }
  if (block.parsedJsonIndex) {
    return `
      <section class="research-copy-block research-answer-index">
        ${renderJsonDetails("Index JSON", block.parsedJsonIndex, "Show Index JSON")}
        ${block.indexNotes.length ? renderListSection("Index Notes", block.indexNotes, { emptyText: "No index notes recorded.", previewCount: 8 }) : ""}
      </section>`;
  }
  if (block.indexNotes.length) {
    return `<section class="research-copy-block research-answer-index">${renderListSection("Index Notes", block.indexNotes, { emptyText: "No index notes recorded.", previewCount: 8 })}</section>`;
  }
  return `<section class="research-copy-block research-answer-index"><h3>Index JSON / Index Notes</h3><p class="muted">No index persisted. Raw answer remains the source record.</p></section>`;
}

function renderRawResponse(interaction: DeepResearchInteraction | null): string {
  return renderExpandableText("Raw AI Response", interaction?.rawResponseText ?? "", {
    summaryLabel: "Show Full Raw AI Response",
    className: "response-pre",
    forceDetails: true,
    emptyText: "Raw AI response was not persisted.",
  });
}

function renderResearchPlanSubQuestionCard(entry: DeepResearchReport["subQuestionReports"][number]): string {
  return `
    <article class="research-subquestion-card">
      <div class="research-analysis-head">
        <div>
          <h3>Q${escapeText(entry.subQuestion.ordinal + 1)}: ${escapeText(entry.subQuestion.title)}</h3>
          <p>${escapeText(entry.subQuestion.questionText)}</p>
        </div>
        ${renderStatusBadge(entry.subQuestion.analysisStatus || "missing")}
      </div>
      ${renderMetaRow([
        entry.subQuestion.whyItMatters || entry.subQuestion.purpose,
        entry.subQuestion.decisionWeight,
        entry.subQuestion.omissionRisk,
        entry.subQuestion.parseStatus,
      ])}
      <details>
        <summary>Show PromptBundle</summary>
        ${renderPromptBundleDetails("PromptBundle", entry.subQuestion.promptBundle)}
      </details>
      <details>
        <summary>Show Rendered Prompt</summary>
        ${renderRenderedPrompt(entry.analysis?.interaction ?? null)}
      </details>
      <div class="research-delivery-strip">
        <a class="btn secondary" href="#analysis-card-${escapeText(entry.subQuestion.id)}">Jump to Analysis</a>
      </div>
    </article>`;
}

function renderSubQuestionAnalysisCard(entry: DeepResearchReport["subQuestionReports"][number]): string {
  return `
    <article class="research-analysis-card research-subquestion-card" id="analysis-card-${escapeText(entry.subQuestion.id)}">
      <div class="research-analysis-head">
        <div>
          <p class="research-kicker">Analysis Card</p>
          <h3>Q${escapeText(entry.subQuestion.ordinal + 1)}: ${escapeText(entry.subQuestion.title)}</h3>
        </div>
        ${renderStatusBadge(entry.subQuestion.analysisStatus || "missing")}
      </div>
      <p>${escapeText(entry.subQuestion.questionText)}</p>
      ${renderMetaRow([
        entry.subQuestion.decisionWeight,
        entry.subQuestion.omissionRisk,
        entry.subQuestion.parseStatus,
      ])}
      ${renderPromptBundleDetails("PromptBundle", entry.subQuestion.promptBundle)}
      ${renderRenderedPrompt(entry.analysis?.interaction ?? null)}
      ${renderCleanAnswer(entry.analysis)}
      ${renderIndexView(entry.analysis)}
      <section class="research-copy-block research-answer-raw">
        ${renderRawResponse(entry.analysis?.interaction ?? null)}
      </section>
    </article>`;
}

function renderResearchPlanSection(report: DeepResearchReport): string {
  if (!report.researchPlan) {
    return `
      <div class="research-section-head">
        <div>
          <p class="research-kicker">ResearchPlan</p>
          <h2>ResearchPlan not persisted</h2>
        </div>
      </div>
      <p class="muted">The case reader requires a persisted ResearchPlan to show promptBundle ownership and question decomposition.</p>`;
  }
  return `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">ResearchPlan</p>
        <h2>How AI decomposed the case</h2>
      </div>
    </div>
    ${renderMetaRow([
      report.researchPlan.questionType,
      `${report.researchPlan.subQuestions.length} subquestions`,
      report.researchPlan.finalAdjudicationPromptBundle ? "Final promptBundle ready" : "Final promptBundle missing",
      report.researchPlan.htmlReportPromptBundle ? "HTML promptBundle ready" : "HTML promptBundle missing",
    ])}
    ${renderExpandableText("Main Question", report.researchPlan.mainQuestion, {
      summaryLabel: "Show Full Main Question",
      className: "response-pre",
      previewLimit: 360,
    })}
    ${renderExpandableText("Decomposition Strategy", report.researchPlan.decompositionStrategy, {
      summaryLabel: "Show Full Decomposition Strategy",
      className: "response-pre",
      previewLimit: 420,
    })}
    ${renderJsonDetails("Plan Integrity Check", report.researchPlan.planIntegrityCheck, "Show Plan Integrity Check")}
    <div class="research-plan-grid">
      ${report.subQuestionReports.map((entry) => renderResearchPlanSubQuestionCard(entry)).join("")}
    </div>
    <div class="research-summary-grid">
      ${renderPromptBundleDetails("Final Adjudication PromptBundle", report.researchPlan.finalAdjudicationPromptBundle)}
      ${renderPromptBundleDetails("HTML Report PromptBundle", report.researchPlan.htmlReportPromptBundle)}
    </div>
    ${renderInteractionDebug(report.researchPlan.interaction)} `;
}

function renderAnalysisCardsSection(report: DeepResearchReport): string {
  if (!report.subQuestionReports.length) {
    return `
      <div class="research-section-head">
        <div>
          <p class="research-kicker">Analysis Cards</p>
          <h2>No sub-question analysis persisted</h2>
        </div>
      </div>
      <p class="muted">Sub-question analysis cards will appear after the N-stage chain persists prompt, clean answer, index, and raw response.</p>`;
  }
  return `
    <div class="research-section-head">
      <div>
        <p class="research-kicker">Analysis Cards</p>
        <h2>N-stage case cards</h2>
      </div>
    </div>
    <div class="research-plan-grid">
      ${report.subQuestionReports.map((entry) => renderSubQuestionAnalysisCard(entry)).join("")}
    </div>`;
}

export const deepResearchClientCaseReaderRuntime = {
  renderPromptBundleDetails,
  renderRenderedPrompt,
  renderCleanAnswer,
  renderIndexView,
  renderRawResponse,
  renderSubQuestionAnalysisCard,
  renderResearchPlanSection,
  renderAnalysisCardsSection,
} as const;

export const deepResearchClientCaseReaderFunctions = [
  renderPromptBundleOutputGuidance,
  renderPromptBundleDetails,
  renderRenderedPrompt,
  renderCleanAnswer,
  renderIndexView,
  renderRawResponse,
  renderResearchPlanSubQuestionCard,
  renderSubQuestionAnalysisCard,
  renderResearchPlanSection,
  renderAnalysisCardsSection,
] as const;