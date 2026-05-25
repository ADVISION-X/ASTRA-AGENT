import type {
  DeepResearchClientState,
  DeepResearchExportPayload,
  DeepResearchHistoryPayload,
  DeepResearchLatestPayload,
  DeepResearchReport,
  DeepResearchStartPayload,
} from "./workbench-deep-research-client-contracts.js";
import { deepResearchClientReportRuntime } from "./workbench-deep-research-client-report-sections.js";
import { deepResearchClientSharedRuntime } from "./workbench-deep-research-client-shared.js";

const { renderSelectedReport } = deepResearchClientReportRuntime;
const {
  readResearchJson,
  renderEmptyReader,
  renderHistory,
  researchQuery,
  syncFormVisibility,
} = deepResearchClientSharedRuntime;

declare const writeActivity: (message: string, tone?: string) => void;

function setSelectedJobId(state: DeepResearchClientState, jobId: string): void {
  state.selectedJobId = jobId;
  if (jobId) {
    localStorage.setItem("grasseye:lastDeepResearchJobId", jobId);
  }
}

function stopPolling(state: DeepResearchClientState): void {
  if (state.poll) {
    clearInterval(state.poll);
  }
  state.poll = null;
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
  options: { skipHistoryRefresh?: boolean } = {},
): Promise<DeepResearchReport> {
  setSelectedJobId(state, jobId);
  const report = await readResearchJson<DeepResearchReport>(`/api/deep-research-analysis/report?jobId=${encodeURIComponent(jobId)}`);
  state.formOpen = false;
  renderHistory(state);
  renderSelectedReport(state, report);
  if (!options.skipHistoryRefresh) {
    await refreshHistory(state, jobId);
  }
  if (report?.job?.status === "queued" || report?.job?.status === "running") {
    stopPolling(state);
    state.poll = setInterval(() => {
      loadSelectedReport(state, jobId, { skipHistoryRefresh: false }).catch((error) => {
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
  await loadSelectedReport(state, latest.job.id);
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
    }),
  });
  state.formOpen = false;
  writeActivity("deep research started", "ok");
  await refreshHistory(state, payload.jobId);
  await loadSelectedReport(state, payload.jobId, { skipHistoryRefresh: true });
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
    localStorage.removeItem("grasseye:lastDeepResearchJobId");
    stopPolling(state);
  }
  writeActivity("deep research report deleted", "ok");
  const nextJobId = await refreshHistory(state);
  if (nextJobId) {
    await loadSelectedReport(state, nextJobId, { skipHistoryRefresh: true });
  }
}

function handleDeepResearchClick(state: DeepResearchClientState, event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const openExportButton = target?.closest("[data-deep-research-open-export]");
  if (openExportButton) {
    openDeepResearchExport(state, openExportButton.getAttribute("data-deep-research-open-export") || "").catch((error) => {
      writeActivity(`deep research export open failed: ${error.message}`, "bad");
    });
    return;
  }
  const deleteJob = target?.closest("[data-deep-research-delete-job]");
  if (deleteJob) {
    deleteDeepResearchJob(state, deleteJob.getAttribute("data-deep-research-delete-job") || "").catch((error) => {
      writeActivity(`deep research delete failed: ${error.message}`, "bad");
    });
    return;
  }
  const selectedJob = target?.closest("[data-deep-research-select-job]");
  if (selectedJob) {
    loadSelectedReport(state, selectedJob.getAttribute("data-deep-research-select-job") || "").catch((error) => {
      writeActivity(`deep research selection failed: ${error.message}`, "bad");
    });
    return;
  }
  const exportButton = target?.closest("[data-deep-research-export]");
  if (exportButton) {
    downloadDeepResearchExport(state, exportButton.getAttribute("data-deep-research-export") || "").catch((error) => {
      writeActivity(`deep research export failed: ${error.message}`, "bad");
    });
    return;
  }
  if (target?.closest("[data-deep-research-new-toggle]")) {
    state.formOpen = !state.formOpen;
    syncFormVisibility(state, Boolean(state.selectedJobId));
    return;
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
    return;
  }
  if (target?.closest("[data-deep-research-latest]")) {
    loadLatestReport(state).catch((error) => writeActivity(`deep research latest failed: ${error.message}`, "bad"));
  }
}

function handleDeepResearchInput(state: DeepResearchClientState, event: Event): void {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  if (!target || target.getAttribute("data-deep-research-history-search") === null) {
    return;
  }
  state.historyFilter = target.value || "";
  renderHistory(state);
}

function handleDeepResearchDomReady(state: DeepResearchClientState): void {
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
      state.formOpen = false;
      return loadSelectedReport(state, jobId, { skipHistoryRefresh: true });
    })
    .catch((error) => writeActivity(`deep research history load failed: ${error.message}`, "bad"));
}

function bootWorkbenchDeepResearchClient(): void {
  const state: DeepResearchClientState = {
    history: [],
    selectedJobId: localStorage.getItem("grasseye:lastDeepResearchJobId") || "",
    historyFilter: "",
    formOpen: !localStorage.getItem("grasseye:lastDeepResearchJobId"),
    poll: null,
  };
  document.addEventListener("click", (event) => handleDeepResearchClick(state, event));
  document.addEventListener("input", (event) => handleDeepResearchInput(state, event));
  document.addEventListener("DOMContentLoaded", () => handleDeepResearchDomReady(state));
}

export const deepResearchClientBootFunctions = [
  setSelectedJobId,
  stopPolling,
  refreshHistory,
  loadSelectedReport,
  loadLatestReport,
  startDeepResearch,
  downloadDeepResearchExport,
  deleteDeepResearchJob,
  handleDeepResearchClick,
  handleDeepResearchInput,
  handleDeepResearchDomReady,
  bootWorkbenchDeepResearchClient,
] as const;
