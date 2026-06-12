import type {
  DeepResearchClientState,
  DeepResearchExportPayload,
  DeepResearchHistoryPayload,
  DeepResearchLatestPayload,
  DeepResearchLoadReportOptions,
  DeepResearchReport,
  DeepResearchStartPayload,
} from "./workbench-deep-research-client-contracts.js";
import {
  addDeepResearchInputAttachmentFiles,
  buildDeepResearchInputAttachments,
  getDeepResearchAttachmentStateField,
  getDeepResearchFormFromTarget,
  handleDeepResearchAttachmentChange,
  handleDeepResearchAttachmentDragOver,
  handleDeepResearchAttachmentDrop,
  handleDeepResearchAttachmentPaste,
  handleDeepResearchAttachmentPickerChange,
  readDeepResearchAttachmentState,
  renderDeepResearchAttachmentState,
  stageDeepResearchInputAttachmentFiles,
  writeDeepResearchAttachmentState,
} from "./workbench-deep-research-client-attachments.js";
import { deepResearchClientReportRuntime } from "./workbench-deep-research-client-report-sections.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";
import { getFieldHelpContent, type DeepResearchFieldHelpKey } from "./workbench-deep-research-field-help.js";

const { renderSelectedReport } = deepResearchClientReportRuntime;
const {
  readResearchJson,
  renderEmptyReader,
  renderHistory,
  researchQuery,
  syncFormVisibility,
} = deepResearchClientSharedRuntime;

declare const writeActivity: (message: string, tone?: string) => void;
declare const openInspector: (detail: { kind: string; title: string; payload: Record<string, unknown> }) => void;

function setSelectedJobId(state: DeepResearchClientState, jobId: string): void {
  state.selectedJobId = jobId;
}

function stopPolling(state: DeepResearchClientState): void {
  if (state.poll) {
    clearInterval(state.poll);
  }
  state.poll = null;
}

function showDeepResearchPage(page: string): void {
  const activePage = page || "reader";
  document.querySelectorAll("[data-deep-research-page]").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.getAttribute("data-deep-research-page") === activePage));
  });
  document.querySelectorAll("[data-deep-research-surface]").forEach((surface) => {
    surface.classList.toggle("hidden", surface.getAttribute("data-deep-research-surface") !== activePage);
  });
}

function openDeepResearchInspector(report: DeepResearchReport): void {
  openInspector({
    kind: "task",
    title: report.job.id,
    payload: {
      "Job ID": report.job.id,
      Status: report.job.status,
      Phase: report.job.phase,
      Title: report.job.title,
      "User Question": report.job.userQuestion,
      "Subquestions": report.job.subQuestionCount,
      Interactions: report.job.interactionCount,
      Exports: report.job.exportCount,
      "HTML Report": report.primaryBusinessReport?.status || "missing",
      Reason: report.job.failureReason || report.job.reviewReason || "-",
    },
  });
}

function shouldOpenDeepResearchInspector(options: DeepResearchLoadReportOptions): boolean {
  return options.openInspector === true;
}

function isDeepResearchFormActive(): boolean {
  const form = researchQuery("[data-deep-research-form]");
  if (!(form instanceof HTMLFormElement)) {
    return false;
  }
  const activeElement = document.activeElement;
  const focusedInside = activeElement instanceof Element && form.contains(activeElement);
  const userQuestion = (form.elements.namedItem("userQuestion") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  const analysisGoal = (form.elements.namedItem("analysisGoal") as HTMLInputElement | null)?.value.trim() ?? "";
  const inputAttachments = (form.elements.namedItem("inputAttachments") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  return focusedInside || userQuestion.length > 0 || analysisGoal.length > 0 || inputAttachments.length > 0;
}

function closeDeepResearchFormUnlessActive(state: DeepResearchClientState): void {
  if (!isDeepResearchFormActive()) {
    state.formOpen = false;
  }
}

function refreshHistory(
  state: DeepResearchClientState,
  preferredJobId?: string,
): Promise<string | null> {
  return readResearchJson<DeepResearchHistoryPayload>("/api/deep-research-analysis/history?limit=50").then((payload) => {
    state.history = payload.jobs || [];
    renderHistory(state);
    const nextJobId = preferredJobId || state.selectedJobId || state.history[0]?.id || "";
    if (!nextJobId) {
      renderEmptyReader("No Deep Research reports yet");
      syncFormVisibility(state, false);
      return null;
    }
    return nextJobId;
  });
}

async function loadSelectedReport(
  state: DeepResearchClientState,
  jobId: string,
  options: DeepResearchLoadReportOptions = {},
): Promise<DeepResearchReport> {
  setSelectedJobId(state, jobId);
  const report = await readResearchJson<DeepResearchReport>(`/api/deep-research-analysis/report?jobId=${encodeURIComponent(jobId)}`);
  if (options.closeForm === true && options.preserveFormOpen !== true) {
    closeDeepResearchFormUnlessActive(state);
  }
  renderHistory(state);
  renderSelectedReport(state, report);
  if (shouldOpenDeepResearchInspector(options)) {
    openDeepResearchInspector(report);
  }
  showDeepResearchPage("reader");
  if (!options.skipHistoryRefresh) {
    await refreshHistory(state, jobId);
  }
  if (report?.job?.status === "queued" || report?.job?.status === "running") {
    stopPolling(state);
    state.poll = setInterval(() => {
      loadSelectedReport(state, jobId, { skipHistoryRefresh: false, preserveFormOpen: true }).catch((error) => {
        writeActivity(`deep research refresh failed: ${error.message}`, "bad");
      });
    }, 5000);
  } else {
    stopPolling(state);
  }
  return report;
}

async function loadLatestReport(state: DeepResearchClientState): Promise<void> {
  const latest = await readResearchJson<DeepResearchLatestPayload>("/api/deep-research-analysis/latest");
  if (!latest?.job?.id) {
    renderEmptyReader("No Deep Research reports yet");
    return;
  }
  await loadSelectedReport(state, latest.job.id, { closeForm: true });
}

async function startDeepResearch(state: DeepResearchClientState, event: Event): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null;
  if (!form) {
    return;
  }
  const userQuestion = (form.elements.namedItem("userQuestion") as HTMLTextAreaElement | null)?.value ?? "";
  const analysisGoal = (form.elements.namedItem("analysisGoal") as HTMLInputElement | null)?.value ?? "";
  const language = (form.elements.namedItem("language") as HTMLSelectElement | null)?.value ?? "zh-CN";
  const maxSubQuestions = Number((form.elements.namedItem("maxSubQuestions") as HTMLInputElement | null)?.value ?? "4");
  const providerKind = (form.elements.namedItem("providerKind") as HTMLSelectElement | null)?.value ?? "gemini-api";
  const inputAttachments = buildDeepResearchInputAttachments(
    (form.elements.namedItem("inputAttachments") as HTMLTextAreaElement | null)?.value ?? "",
  );
  const payload = await readResearchJson<DeepResearchStartPayload>("/api/deep-research-analysis/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userQuestion,
      analysisGoal: analysisGoal || null,
      language,
      maxSubQuestions,
      outputFormat: "markdown",
      providerKind,
      inputAttachments,
    }),
  });
  state.formOpen = false;
  writeActivity("deep research started", "ok");
  await refreshHistory(state, payload.jobId);
  await loadSelectedReport(state, payload.jobId, { skipHistoryRefresh: true });
}

function setHelpModalHidden(hidden: boolean): void {
  const modal = researchQuery("[data-deep-research-help-modal]");
  if (modal instanceof HTMLElement) {
    modal.classList.toggle("hidden", hidden);
  }
}

function openFieldHelp(fieldKey: string): void {
  const content = getFieldHelpContent()[fieldKey as DeepResearchFieldHelpKey];
  if (!content) {
    return;
  }
  const title = researchQuery("[data-deep-research-help-title]");
  const body = researchQuery("[data-deep-research-help-body]");
  const effect = researchQuery("[data-deep-research-help-effect]");
  if (title) title.textContent = content.title;
  if (body) body.textContent = content.body;
  if (effect) effect.textContent = content.effect;
  setHelpModalHidden(false);
}

async function downloadDeepResearchExport(state: DeepResearchClientState, kind: string): Promise<void> {
  if (!state.selectedJobId) {
    writeActivity("deep research job id is required", "warn");
    return;
  }
  const exported = await readResearchJson<DeepResearchExportPayload>(`/api/deep-research-analysis/export?jobId=${encodeURIComponent(state.selectedJobId)}&kind=${encodeURIComponent(kind)}`);
  const blob = exported.base64Content
    ? new Blob([
      Uint8Array.from(atob(exported.base64Content), (character) => character.charCodeAt(0)),
    ], { type: exported.contentType || "application/octet-stream" })
    : new Blob([
      exported.textContent || JSON.stringify(exported.jsonContent, null, 2),
    ], { type: exported.contentType || "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = exported.fileName || kind;
  link.click();
  URL.revokeObjectURL(link.href);
  writeActivity(`deep research export ready: ${exported.fileName || kind}`, "ok");
}

async function openDeepResearchExport(state: DeepResearchClientState, kind: string): Promise<void> {
  if (!state.selectedJobId) {
    writeActivity("deep research job id is required", "warn");
    return;
  }
  const exported = await readResearchJson<DeepResearchExportPayload>(`/api/deep-research-analysis/export?jobId=${encodeURIComponent(state.selectedJobId)}&kind=${encodeURIComponent(kind)}`);
  const blob = exported.base64Content
    ? new Blob([
      Uint8Array.from(atob(exported.base64Content), (character) => character.charCodeAt(0)),
    ], { type: exported.contentType || "application/octet-stream" })
    : new Blob([
      exported.textContent || JSON.stringify(exported.jsonContent, null, 2),
    ], { type: exported.contentType || "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = exported.fileName || kind;
    link.click();
  }
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
  writeActivity(`deep research export opened: ${exported.fileName || kind}`, "ok");
}

async function deleteDeepResearchJob(state: DeepResearchClientState, jobId: string): Promise<void> {
  if (!jobId || !confirm("Delete this Deep Research report and its exported artifacts?")) {
    return;
  }
  await readResearchJson(`/api/deep-research-analysis/job?jobId=${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
  if (state.selectedJobId === jobId) {
    state.selectedJobId = "";
    stopPolling(state);
  }
  writeActivity("deep research report deleted", "ok");
  const nextJobId = await refreshHistory(state);
  if (nextJobId) {
    await loadSelectedReport(state, nextJobId, { skipHistoryRefresh: true, closeForm: true });
  }
}

function tryHandleDeepResearchHelpClick(target: Element | null): boolean {
  const helpButton = target?.closest("[data-deep-research-field-help]");
  if (helpButton) {
    openFieldHelp(helpButton.getAttribute("data-deep-research-field-help") || "");
    return true;
  }
  if (target?.closest("[data-deep-research-help-close]")) {
    setHelpModalHidden(true);
    return true;
  }
  return false;
}

function tryHandleDeepResearchExportClick(state: DeepResearchClientState, target: Element | null): boolean {
  const openExportButton = target?.closest("[data-deep-research-open-export]");
  if (openExportButton) {
    openDeepResearchExport(state, openExportButton.getAttribute("data-deep-research-open-export") || "").catch((error) => {
      writeActivity(`deep research export open failed: ${error.message}`, "bad");
    });
    return true;
  }
  const exportButton = target?.closest("[data-deep-research-export]");
  if (exportButton) {
    downloadDeepResearchExport(state, exportButton.getAttribute("data-deep-research-export") || "").catch((error) => {
      writeActivity(`deep research export failed: ${error.message}`, "bad");
    });
    return true;
  }
  return false;
}

function tryHandleDeepResearchJobClick(state: DeepResearchClientState, target: Element | null): boolean {
  const deleteJob = target?.closest("[data-deep-research-delete-job]");
  if (deleteJob) {
    deleteDeepResearchJob(state, deleteJob.getAttribute("data-deep-research-delete-job") || "").catch((error) => {
      writeActivity(`deep research delete failed: ${error.message}`, "bad");
    });
    return true;
  }
  const selectedJob = target?.closest("[data-deep-research-select-job]");
  if (selectedJob) {
    loadSelectedReport(state, selectedJob.getAttribute("data-deep-research-select-job") || "", { closeForm: true, openInspector: true }).catch((error) => {
      writeActivity(`deep research selection failed: ${error.message}`, "bad");
    });
    return true;
  }
  return false;
}

function tryHandleDeepResearchToolbarClick(state: DeepResearchClientState, target: Element | null): boolean {
  const pageTab = target?.closest("[data-deep-research-page]");
  if (pageTab) {
    const page = pageTab.getAttribute("data-deep-research-page") || "reader";
    if (page === "new") {
      state.formOpen = true;
      syncFormVisibility(state, Boolean(state.selectedJobId));
    }
    showDeepResearchPage(page);
    return true;
  }
  if (target?.closest("[data-deep-research-new-toggle]")) {
    state.formOpen = true;
    syncFormVisibility(state, Boolean(state.selectedJobId));
    showDeepResearchPage("new");
    return true;
  }
  if (target?.closest("[data-deep-research-refresh]")) {
    refreshHistory(state)
      .then((jobId) => {
        if (jobId && jobId === state.selectedJobId) {
          return loadSelectedReport(state, jobId, { skipHistoryRefresh: true });
        }
        return undefined;
      })
      .catch((error) => writeActivity(`deep research history refresh failed: ${error.message}`, "bad"));
    return true;
  }
  if (target?.closest("[data-deep-research-latest]")) {
    loadLatestReport(state).catch((error) => writeActivity(`deep research latest failed: ${error.message}`, "bad"));
    return true;
  }
  return false;
}

function handleDeepResearchClick(state: DeepResearchClientState, event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (tryHandleDeepResearchHelpClick(target)) {
    return;
  }
  if (tryHandleDeepResearchExportClick(state, target)) {
    return;
  }
  if (tryHandleDeepResearchJobClick(state, target)) {
    return;
  }
  tryHandleDeepResearchToolbarClick(state, target);
}

function handleDeepResearchInput(state: DeepResearchClientState, event: Event): void {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  if (!target || target.getAttribute("data-deep-research-history-search") === null) {
    return;
  }
  state.historyFilter = target.value || "";
  renderHistory(state);
}

function handleDeepResearchChange(event: Event): void {
  handleDeepResearchAttachmentChange(event);
}

function handleDeepResearchDragOver(event: DragEvent): void {
  handleDeepResearchAttachmentDragOver(event);
}

function handleDeepResearchDomReady(state: DeepResearchClientState): void {
  showDeepResearchPage("reader");
  const form = researchQuery("[data-deep-research-form]");
  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (event) => {
      startDeepResearch(state, event).catch((error) => writeActivity(`deep research start failed: ${error.message}`, "bad"));
    });
  }
  refreshHistory(state)
    .then((jobId) => {
      syncFormVisibility(state, false);
      if (!jobId) {
        return undefined;
      }
      closeDeepResearchFormUnlessActive(state);
      return loadSelectedReport(state, jobId, { skipHistoryRefresh: true });
    })
    .catch((error) => writeActivity(`deep research history load failed: ${error.message}`, "bad"));
}

function bootWorkbenchDeepResearchClient(): void {
  const state: DeepResearchClientState = {
    history: [],
    selectedJobId: "",
    historyFilter: "",
    formOpen: true,
    poll: null,
  };
  document.addEventListener("click", (event) => handleDeepResearchClick(state, event));
  document.addEventListener("input", (event) => handleDeepResearchInput(state, event));
  document.addEventListener("change", (event) => handleDeepResearchChange(event));
  document.addEventListener("dragover", (event) => handleDeepResearchDragOver(event));
  document.addEventListener("drop", (event) => handleDeepResearchAttachmentDrop(event));
  document.addEventListener("paste", (event) => handleDeepResearchAttachmentPaste(event));
  document.addEventListener("DOMContentLoaded", () => handleDeepResearchDomReady(state));
}

export const deepResearchClientBootFunctions = [
  setSelectedJobId,
  stopPolling,
  showDeepResearchPage,
  openDeepResearchInspector,
  shouldOpenDeepResearchInspector,
  isDeepResearchFormActive,
  closeDeepResearchFormUnlessActive,
  refreshHistory,
  loadSelectedReport,
  loadLatestReport,
  startDeepResearch,
  getDeepResearchAttachmentStateField,
  readDeepResearchAttachmentState,
  writeDeepResearchAttachmentState,
  renderDeepResearchAttachmentState,
  stageDeepResearchInputAttachmentFiles,
  addDeepResearchInputAttachmentFiles,
  getDeepResearchFormFromTarget,
  handleDeepResearchAttachmentPickerChange,
  handleDeepResearchAttachmentDrop,
  handleDeepResearchAttachmentPaste,
  getFieldHelpContent,
  setHelpModalHidden,
  openFieldHelp,
  downloadDeepResearchExport,
  openDeepResearchExport,
  deleteDeepResearchJob,
  tryHandleDeepResearchHelpClick,
  tryHandleDeepResearchExportClick,
  tryHandleDeepResearchJobClick,
  tryHandleDeepResearchToolbarClick,
  handleDeepResearchClick,
  handleDeepResearchInput,
  handleDeepResearchChange,
  handleDeepResearchDragOver,
  handleDeepResearchDomReady,
  bootWorkbenchDeepResearchClient,
] as const;
