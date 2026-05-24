import type {
  DeepResearchAnswerBlock,
  DeepResearchClientState,
  DeepResearchEvidence,
  DeepResearchExportRecord,
  DeepResearchListOptions,
  DeepResearchTextOptions,
} from "./workbench-deep-research-client-contracts.js";

declare const qs: (selector: string) => Element | null;
declare const readJson: (url: string, options?: RequestInit) => Promise<unknown>;

type JsonRecord = Record<string, unknown>;

function readResearchJson<T>(url: string, options?: RequestInit): Promise<T> {
  return readJson(url, options) as Promise<T>;
}

function researchQuery(selector: string): Element | null {
  return qs(selector);
}

function researchJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function escapeText(value: unknown): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function setResearchHtml(selector: string, html: string): void {
  const node = researchQuery(selector);
  if (node) {
    node.innerHTML = html;
  }
}

function toggleResearchHidden(selector: string, hidden: boolean): void {
  const node = researchQuery(selector);
  if (node) {
    node.classList.toggle("hidden", hidden);
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function formatStatusLabel(value: string | null | undefined): string {
  return String(value ?? "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function exportActionLabel(kind: string): string {
  if (kind === "business-report.html") {
    return "Open HTML Report";
  }
  if (kind === "final-report.md") {
    return "Open final report";
  }
  if (kind === "decision-package.json") {
    return "Open decision package";
  }
  if (kind === "research-bundle.json") {
    return "Download research bundle";
  }
  if (kind === "business-deck-outline.json") {
    return "Open Deck Outline";
  }
  if (
    kind === "business-deck.pptx"
    || kind === "business-deck.ai-pptx"
    || kind === "business-deck.local-pptx"
  ) {
    return "Download PPT";
  }
  return "Download evidence index";
}

function renderStatusBadge(status: string | null | undefined): string {
  return `<span class="research-status-pill research-status-${escapeText(status || "queued")}">${escapeText(formatStatusLabel(status))}</span>`;
}

function renderConfidenceBadge(confidence: string | null | undefined): string {
  return confidence ? `<span class="research-confidence-pill">Confidence ${escapeText(confidence)}</span>` : "";
}

function renderMetaRow(items: readonly (string | number | null | undefined)[]): string {
  return `<div class="research-meta-row">${items.filter(Boolean).map((item) => `<span>${escapeText(item)}</span>`).join("")}</div>`;
}

function renderListSection(title: string, values: unknown, options: DeepResearchListOptions = {}): string {
  const items = asArray(values);
  if (!items.length) {
    return `<section class="research-copy-block"><h3>${escapeText(title)}</h3><p class="muted">${escapeText(options.emptyText || "None recorded.")}</p></section>`;
  }
  const previewCount = options.previewCount || 3;
  const previewItems = items.slice(0, previewCount);
  const listHtml = (list: readonly string[]): string => `<ul class="research-list">${list.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
  const showDetails = previewItems.length < items.length;
  return `
    <section class="research-copy-block">
      <h3>${escapeText(title)}</h3>
      ${listHtml(previewItems)}
      ${showDetails ? `<details><summary>More</summary>${listHtml(items)}</details>` : ""}
    </section>`;
}

function readPayloadString(payload: JsonRecord, key: string): string {
  const value = payload[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function renderStructuredField(title: string, value: unknown, options: DeepResearchTextOptions = {}): string {
  if (Array.isArray(value)) {
    return renderListSection(title, value, {
      emptyText: options.emptyText || "None recorded.",
      previewCount: 5,
    });
  }
  if (value && typeof value === "object") {
    return renderJsonDetails(title, value, options.summaryLabel || "Show Structured JSON");
  }
  const textOptions: DeepResearchTextOptions = {
    summaryLabel: options.summaryLabel || "More",
    className: options.className || "response-pre",
    previewLimit: options.previewLimit || 420,
  };
  if (options.emptyText) {
    textOptions.emptyText = options.emptyText;
  }
  return renderExpandableText(title, value, {
    ...textOptions,
  });
}

function renderStructuredFields(payload: JsonRecord, fields: readonly {
  key: string;
  title: string;
  emptyText?: string;
}[]): string {
  return fields
    .filter((field) => {
      const value = payload[field.key];
      return Array.isArray(value)
        ? value.length > 0
        : value !== undefined && value !== null && String(value).trim().length > 0;
    })
    .map((field) => renderStructuredField(
      field.title,
      payload[field.key],
      field.emptyText ? { emptyText: field.emptyText } : {},
    ))
    .join("");
}

function renderExpandableText(title: string, value: unknown, options: DeepResearchTextOptions = {}): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return `<section class="research-copy-block"><h3>${escapeText(title)}</h3><p class="muted">${escapeText(options.emptyText || "Not persisted yet.")}</p></section>`;
  }
  const previewLimit = options.previewLimit || 480;
  const preview = text.length > previewLimit ? `${text.slice(0, previewLimit - 1).trimEnd()}...` : text;
  const showDetails = Boolean(options.forceDetails) || text.length > previewLimit;
  return `
    <section class="research-copy-block">
      <h3>${escapeText(title)}</h3>
      <p>${escapeText(preview)}</p>
      ${showDetails ? `<details><summary>${escapeText(options.summaryLabel || "More")}</summary><pre class="${escapeText(options.className || "response-pre")}">${escapeText(text)}</pre></details>` : ""}
    </section>`;
}

function renderJsonDetails(title: string, value: unknown, summaryLabel?: string): string {
  if (value === undefined || value === null) {
    return `<section class="research-copy-block"><h3>${escapeText(title)}</h3><p class="muted">No parsed result yet.</p></section>`;
  }
  return `
    <section class="research-copy-block">
      <h3>${escapeText(title)}</h3>
      <details>
        <summary>${escapeText(summaryLabel || "Show Parsed Result")}</summary>
        <pre class="raw-json-pre">${escapeText(researchJson(value))}</pre>
      </details>
    </section>`;
}

function renderDecompositionParsedResult(payload: JsonRecord): string {
  const subQuestions = Array.isArray(payload.subQuestions)
    ? payload.subQuestions.map((item) => asRecord(item)).filter((item): item is JsonRecord => Boolean(item))
    : [];
  return `
    <section class="research-parsed-panel">
      <div class="research-parsed-head">
        <h3>Parsed Decomposition</h3>
        ${renderMetaRow([
          readPayloadString(payload, "questionType"),
          subQuestions.length ? `${subQuestions.length} subquestions` : null,
        ])}
      </div>
      ${renderStructuredField("Main Question", payload.mainQuestion)}
      ${renderStructuredField("Decomposition Strategy", payload.decompositionStrategy)}
      ${renderListSection("Missing Info", payload.missingInfo, { emptyText: "No missing information recorded.", previewCount: 5 })}
      ${subQuestions.length ? `
        <div class="research-parsed-list">
          ${subQuestions.map((question, index) => `
            <article class="research-parsed-item">
              <div class="research-parsed-item-head">
                <b>Q${escapeText(index + 1)} ${escapeText(readPayloadString(question, "title") || readPayloadString(question, "id"))}</b>
                ${renderMetaRow([
                  readPayloadString(question, "decisionWeight"),
                  readPayloadString(question, "priority"),
                ])}
              </div>
              ${renderStructuredField("Question", readPayloadString(question, "questionText"))}
              ${renderStructuredField("Why It Matters", readPayloadString(question, "whyItMatters"))}
              ${renderStructuredField("Analysis Focus", readPayloadString(question, "analysisFocus"))}
              ${renderListSection("Required Evidence", question.requiredEvidence, { emptyText: "No required evidence recorded.", previewCount: 4 })}
            </article>`).join("")}
        </div>` : ""}
    </section>`;
}

function renderAnalysisParsedResult(payload: JsonRecord, title: string): string {
  return `
    <section class="research-parsed-panel">
      <div class="research-parsed-head">
        <h3>${escapeText(title)}</h3>
        ${renderMetaRow([
          readPayloadString(payload, "subQuestionId"),
          readPayloadString(payload, "confidence"),
        ])}
      </div>
      ${renderStructuredFields(payload, [
        { key: "answer", title: "Answer" },
        { key: "coreFinding", title: "Core Finding" },
        { key: "impactOnFinalAdjudication", title: "Impact On Final Adjudication" },
        { key: "falsificationSummary", title: "Falsification Summary" },
      ])}
      <div class="research-summary-grid">
        ${renderListSection("Key Claims", payload.keyClaims ?? payload.claims ?? payload.keyPoints, { emptyText: "No key claims recorded.", previewCount: 5 })}
        ${renderListSection("Supporting Reasons", payload.supportingReasons ?? payload.reasons, { emptyText: "No supporting reasons recorded.", previewCount: 5 })}
        ${renderListSection("Evidence Mentions", payload.evidenceMentions, { emptyText: "No evidence mentions recorded.", previewCount: 5 })}
        ${renderListSection("Failure Cases", payload.failureCases ?? payload.failureModes, { emptyText: "No failure cases recorded.", previewCount: 5 })}
        ${renderListSection("Assumptions", payload.assumptions, { emptyText: "No assumptions recorded.", previewCount: 5 })}
        ${renderListSection("Limitations", payload.limitations, { emptyText: "No limitations recorded.", previewCount: 5 })}
        ${renderListSection("Uncertainties", payload.uncertainties, { emptyText: "No uncertainties recorded.", previewCount: 5 })}
      </div>
    </section>`;
}

function renderFinalParsedResult(payload: JsonRecord): string {
  const rankedConclusions = Array.isArray(payload.rankedConclusions)
    ? payload.rankedConclusions.map((item) => {
      const record = asRecord(item);
      return record ? `${record.rank ? `#${String(record.rank)} ` : ""}${String(record.conclusion ?? "")}`.trim() : "";
    }).filter(Boolean)
    : [];
  return `
    <section class="research-parsed-panel">
      <div class="research-parsed-head">
        <h3>Parsed Final Adjudication</h3>
        ${renderMetaRow([
          readPayloadString(payload, "confidence"),
          readPayloadString(payload, "finalVerdict"),
        ])}
      </div>
      ${renderStructuredField("Direct Answer", payload.directAnswer ?? payload.executiveConclusion)}
      ${renderStructuredField("One Sentence Decision", payload.oneSentenceDecision)}
      <div class="research-summary-grid">
        ${renderListSection("Ranked Conclusions", rankedConclusions, { emptyText: "No ranked conclusions recorded.", previewCount: 5 })}
        ${renderListSection("Decisive Reasons", payload.decisiveReasons ?? payload.positiveReasons, { emptyText: "No decisive reasons recorded.", previewCount: 5 })}
        ${renderListSection("Weak Or Rejected Claims", payload.weakOrRejectedClaims ?? payload.strongestOpposingArguments, { emptyText: "No rejected claims recorded.", previewCount: 5 })}
        ${renderListSection("Reverse Conditions", payload.reverseConditions, { emptyText: "No reverse conditions recorded.", previewCount: 5 })}
        ${renderListSection("Evidence Gaps", payload.evidenceGaps, { emptyText: "No evidence gaps recorded.", previewCount: 5 })}
        ${renderListSection("Limitations", payload.limitations, { emptyText: "No limitations recorded.", previewCount: 5 })}
      </div>
    </section>`;
}

function renderStructuredParsedResult(title: string, value: unknown): string {
  const payload = asRecord(value);
  if (!payload) {
    return renderJsonDetails(title, value, "Show Parsed Result");
  }
  if (Array.isArray(payload.subQuestions)) {
    return renderDecompositionParsedResult(payload);
  }
  if (payload.directAnswer || payload.executiveConclusion || payload.finalVerdict) {
    return renderFinalParsedResult(payload);
  }
  if (payload.answer || payload.coreFinding || payload.falsificationSummary) {
    return renderAnalysisParsedResult(payload, title);
  }
  return renderJsonDetails(title, value, "Show Parsed Result");
}

function renderExportButtons(exports: readonly DeepResearchExportRecord[]): string {
  if (!exports.length) {
    return "";
  }
  return `<div class="research-export-actions">${exports.map((record) => `<button class="btn secondary" type="button" data-deep-research-export="${escapeText(record.exportKind)}">${escapeText(exportActionLabel(record.exportKind))}</button>`).join("")}</div>`;
}

function renderInteractionDebug(interaction: DeepResearchEvidence | DeepResearchAnswerBlock["interaction"]): string {
  if (!interaction) {
    return "";
  }
  const body = [
    renderExpandableText("Prompt", interaction.promptText || "", {
      summaryLabel: "Show Full Prompt",
      className: "prompt-pre",
      forceDetails: true,
    }),
    renderExpandableText("AI Raw Response", interaction.rawResponseText || "", {
      summaryLabel: "Show Full AI Response",
      className: "response-pre",
      forceDetails: true,
    }),
    renderStructuredParsedResult("Parsed Result", interaction.parsedJson),
    renderJsonDetails("Parsed Result JSON", interaction.parsedJson, "Show Parsed Result"),
  ].join("");
  return `<details class="research-debug-root"><summary>Interaction Evidence</summary>${body}</details>`;
}

function renderAnswerCard(title: string, block: DeepResearchAnswerBlock | null, emptyText: string): string {
  if (!block) {
    return `<article class="research-analysis-card"><h3>${escapeText(title)}</h3><p class="muted">${escapeText(emptyText)}</p></article>`;
  }
  const coreFinding = readPayloadString(block.parsedPayload, "coreFinding");
  const impactOnFinalAdjudication = readPayloadString(block.parsedPayload, "impactOnFinalAdjudication");
  const failureCases = asArray(block.parsedPayload.failureCases);
  const uncertainties = asArray(block.parsedPayload.uncertainties);
  const keyClaimTitle = block.answerKind === "falsification"
    ? "Strongest Opposing Arguments"
    : "Key Claims";
  const contradictionTitle = block.answerKind === "analysis"
    ? "Counter Conditions"
    : "Contradiction Points";
  return `
    <article class="research-analysis-card">
      <div class="research-analysis-head">
        <h3>${escapeText(title)}</h3>
        ${renderConfidenceBadge(block.confidence)}
      </div>
      ${renderExpandableText("Summary", block.answerText, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 420,
      })}
      ${coreFinding ? renderExpandableText("Core Finding", coreFinding, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 280,
      }) : ""}
      ${impactOnFinalAdjudication ? renderExpandableText("Impact On Final Adjudication", impactOnFinalAdjudication, {
        summaryLabel: "More",
        className: "response-pre",
        previewLimit: 280,
      }) : ""}
      ${renderListSection(keyClaimTitle, block.keyPoints, {
        emptyText: block.answerKind === "falsification"
          ? "No opposing arguments recorded."
          : "No key claims recorded.",
      })}
      ${block.answerKind !== "positive" ? renderListSection(contradictionTitle, block.contradictionPoints, {
        emptyText: block.answerKind === "analysis"
          ? "No counter conditions recorded."
          : "No contradiction points recorded.",
      }) : ""}
      ${failureCases.length ? renderListSection("Failure Cases", failureCases, { emptyText: "No failure cases recorded." }) : ""}
      ${renderListSection("Evidence Mentions", block.evidenceMentions, { emptyText: "No evidence mentions recorded." })}
      ${renderListSection("Assumptions", block.assumptions, { emptyText: "No assumptions recorded." })}
      ${uncertainties.length ? renderListSection("Uncertainties", uncertainties, { emptyText: "No uncertainties recorded." }) : ""}
      ${renderListSection("Limitations", block.limitations, { emptyText: "No limitations recorded." })}
      ${renderStructuredParsedResult("Parsed Answer Structure", block.parsedPayload)}
      ${renderInteractionDebug(block.interaction)}
    </article>`;
}

function renderHistory(state: DeepResearchClientState): void {
  const normalizedFilter = normalizeText(state.historyFilter.trim());
  const jobs = state.history.filter((job) => {
    if (!normalizedFilter) {
      return true;
    }
    return [job.title, job.userQuestion, job.questionSummary, job.status]
      .some((value) => normalizeText(value).includes(normalizedFilter));
  });
  if (!jobs.length) {
    setResearchHtml("[data-deep-research-history]", '<p class="muted">No report matched the current filter.</p>');
    return;
  }
  setResearchHtml("[data-deep-research-history]", jobs.map((job) => {
    const selected = job.id === state.selectedJobId;
    return `
      <article class="research-history-item${selected ? " selected" : ""}">
        <button class="research-history-select" type="button" data-deep-research-select-job="${escapeText(job.id)}" aria-pressed="${selected}">
          <div class="research-history-title">
            <h3>${escapeText(job.title)}</h3>
            <span>${escapeText(formatDateTime(job.updatedAt))}</span>
          </div>
          <p class="research-history-summary">${escapeText(job.questionSummary)}</p>
        </button>
        <div class="research-history-top">
          ${renderStatusBadge(job.status)}
          ${renderConfidenceBadge(job.finalConfidence)}
        </div>
        <button class="btn secondary research-history-delete" type="button" data-deep-research-delete-job="${escapeText(job.id)}" aria-label="Delete ${escapeText(job.title)}">Delete</button>
        ${renderMetaRow([
          `${job.subQuestionCount} subquestions`,
          `${job.interactionCount} interactions`,
          `${job.exportCount} exports`,
        ])}
      </article>`;
  }).join(""));
}

function renderEmptyReader(message: string): void {
  toggleResearchHidden("[data-deep-research-empty]", false);
  toggleResearchHidden("[data-deep-research-report]", true);
  setResearchHtml("[data-deep-research-empty]", `
    <p class="research-kicker">Report Reader</p>
    <h2>${escapeText(message || "Select a report from history")}</h2>
    <p class="muted">The reader will show decomposition, independent analysis, final adjudication, exports, and evidence trace.</p>`);
  setResearchHtml("[data-deep-research-nav]", '<p class="muted">No report selected.</p>');
  setResearchHtml("[data-deep-research-meta]", '<p class="muted">No metadata available.</p>');
}

function syncFormVisibility(state: DeepResearchClientState, hasSelectedReport: boolean): void {
  const shouldShow = state.formOpen || !hasSelectedReport;
  toggleResearchHidden("[data-deep-research-form-shell]", !shouldShow);
  const toggle = researchQuery("[data-deep-research-new-toggle]");
  if (toggle) {
    toggle.textContent = shouldShow ? "Hide New Research" : "New Research";
  }
}

export const deepResearchClientSharedRuntime = {
  readResearchJson, researchQuery, researchJson, asArray, escapeText, setResearchHtml, toggleResearchHidden,
  normalizeText, formatDateTime, formatStatusLabel, exportActionLabel, renderStatusBadge, renderConfidenceBadge,
  renderMetaRow, renderListSection, renderExpandableText, renderJsonDetails, renderExportButtons,
  renderInteractionDebug, readPayloadString, renderStructuredParsedResult, renderAnswerCard, renderHistory,
  renderEmptyReader, syncFormVisibility,
} as const;

export const deepResearchClientSharedFunctions = [
  readResearchJson, researchQuery, researchJson, asArray, asRecord, escapeText, setResearchHtml,
  toggleResearchHidden, normalizeText, formatDateTime, formatStatusLabel, exportActionLabel, renderStatusBadge,
  renderConfidenceBadge, renderMetaRow, renderListSection, readPayloadString, renderStructuredField,
  renderStructuredFields, renderExpandableText, renderJsonDetails, renderDecompositionParsedResult,
  renderAnalysisParsedResult, renderFinalParsedResult, renderStructuredParsedResult, renderExportButtons,
  renderInteractionDebug, renderAnswerCard, renderHistory, renderEmptyReader, syncFormVisibility,
] as const;
