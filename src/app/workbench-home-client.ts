import { renderAmazonInvoiceClient } from "./workbench-home-amazon-invoice-client.js";
import { renderAmazonProductMiningReviewClient } from "./workbench-home-amazon-product-mining-review-client.js";
import { renderPick3Client } from "./workbench-home-pick3-client.js";

const WORKBENCH_HOME_CLIENT = `
const state = {
  skill: "amazon-product-mining",
  taskId: "",
  amazonInvoiceBatchId: "",
  amazonTaxInvoiceDownloadTaskId: "",
  amazonProductMiningTaskId: "",
  amazonProductMiningReviews: [],
  amazonProductMiningReviewFilters: {
    taskId: "",
    decision: "ALL",
    marketplace: "ALL",
    keyword: "",
    targetMarket: "",
    humanNextStep: "ALL",
    dataConfidence: "ALL",
    packageIntegrity: "ALL",
    sort: "createdAt_desc",
  },
  amazonProductMiningReviewLoading: false,
  amazonProductMiningReviewError: "",
  amazonProductMiningPoll: null,
  facebookRunId: "",
  facebookPoll: null,
  pick3TaskId: "",
};

const skillLabels = {
  "amazon-product-mining": "Amazon Product Mining",
  "facebook-video-mining": "Facebook Video Mining",
  "tiktok-product-mining": "TikTok Product Mining",
  "deep-research-analysis": "Deep Research Analysis",
  "pick3-is-blind-eval": "Pick3 IS Blind Eval",
  "video-downloader": "Video Downloader",
  "media-optimizer": "Media Optimizer",
  "amazon-invoice-upload": "Amazon Invoice Upload",
};
const jobToSkill = {
  "amazon-product-mining": "amazon-product-mining",
  facebook: "facebook-video-mining",
  "facebook-video-mining": "facebook-video-mining",
  "video-download": "video-downloader",
  "video-downloader": "video-downloader",
  "media-processing": "media-optimizer",
  "media-optimizer": "media-optimizer",
  "deep-research": "deep-research-analysis",
  "deep-research-analysis": "deep-research-analysis",
  "pick3-is-blind-eval": "pick3-is-blind-eval",
  amazon: "amazon-invoice-upload",
  "amazon-invoice-upload": "amazon-invoice-upload",
};
const qs = (selector) => document.querySelector(selector);
const setText = (selector, value) => { const node = qs(selector); if (node) node.textContent = value ?? "-"; };
const setInputValue = (selector, value) => {
  const node = qs(selector);
  if (node && typeof value === "string") node.value = value;
};
const setRegionState = (stateName) => {
  const normalized = stateName || "ready";
  setText("[data-runtime-console-state]", normalized);
};
const clearRuntimeEmptyState = () => {
  const empty = qs("[data-runtime-empty-state]");
  if (empty) empty.remove();
};
const writeActivity = (message, tone = "ready") => {
  const list = qs("[data-activity-log]");
  if (!list) return;
  clearRuntimeEmptyState();
  const node = document.createElement("button");
  node.type = "button";
  node.className = "runtime-event " + tone + "-state";
  node.dataset.runtimeEvent = tone;
  node.textContent = new Date().toLocaleTimeString() + " " + message;
  node.addEventListener("click", () => openInspector({
    kind: "runtime event",
    title: tone,
    payload: { Message: message, Status: tone, Time: new Date().toISOString() },
  }));
  list.prepend(node);
  setRegionState(tone);
};
const readJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.failureReason || payload.error || response.statusText);
  return payload;
};
const renderInspectorValue = (value) => {
  if (value && typeof value === "object" && "label" in value && "value" in value) {
    const wrap = document.createElement("div");
    wrap.className = "inspector-link-line";
    const text = document.createElement("span");
    text.textContent = value.value || "not_available";
    wrap.append(text);
    if (value.action) {
      const action = document.createElement("button");
      action.className = "btn secondary compact-button";
      action.type = "button";
      action.textContent = value.label;
      action.addEventListener("click", value.action);
      wrap.append(action);
    }
    return wrap;
  }
  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    list.className = "inspector-list";
    if (value.length === 0) {
      const item = document.createElement("li");
      item.textContent = "not_available";
      list.append(item);
      return list;
    }
    for (const entry of value) {
      const item = document.createElement("li");
      item.textContent = entry || "not_available";
      list.append(item);
    }
    return list;
  }
  const span = document.createElement("span");
  span.textContent = value === undefined || value === null || value === "" ? "not_available" : String(value);
  return span;
};
const openInspector = ({ kind, title, payload }) => {
  document.body.classList.remove("inspector-collapsed");
  setText("[data-inspector-title]", title || "Detail");
  setText("[data-inspector-kind]", kind || "detail");
  const body = qs("[data-inspector-body]");
  if (!body) return;
  body.innerHTML = "";
  const section = document.createElement("section");
  section.className = "detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title || "Detail";
  const grid = document.createElement("div");
  grid.className = "detail-grid inspector-detail-grid";
  const entries = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.entries(payload) : [["Value", payload]];
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    const label = document.createElement("b");
    label.textContent = key;
    row.append(label, renderInspectorValue(value));
    grid.append(row);
  }
  section.append(heading, grid);
  body.append(section);
};
const resetInspectorForSkill = (skill) => {
  document.body.classList.add("inspector-collapsed");
  setText("[data-inspector-title]", "No selection");
  setText("[data-inspector-kind]", "empty");
  setText("[data-task-id]", "-");
  setText("[data-task-status]", "-");
  setText("[data-task-step]", "-");
  setText("[data-task-reason]", "-");
  setText("[data-evidence-ref]", "-");
  const raw = qs("[data-raw-result]");
  if (raw) raw.textContent = "{}";
  const body = qs("[data-inspector-body]");
  if (!body) return;
  body.innerHTML = "";
  const section = document.createElement("section");
  section.className = "empty-state";
  section.dataset.inspectorEmpty = "";
  section.dataset.inspectorEmptyState = "";
  const heading = document.createElement("h3");
  heading.textContent = (skillLabels[skill] || "Skill") + " detail is closed";
  const copy = document.createElement("p");
  copy.textContent = "Select a task, keyword review, package, evidence, exception, or runtime event to open the third-level Inspector.";
  section.append(heading, copy);
  body.append(section);
};
const showSkill = (skill) => {
  state.skill = skill;
  document.body.dataset.activeSkill = skill;
  setText("[data-current-skill]", skillLabels[skill] || skill);
  resetInspectorForSkill(skill);
  document.querySelectorAll("[data-skill-id]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item.dataset.skillId === skill));
  });
  document.querySelectorAll("[data-skill-workspace]").forEach((workspace) => {
    workspace.classList.toggle("hidden", workspace.dataset.skillWorkspace !== skill);
  });
  document.querySelectorAll("[data-job-panel]").forEach((panel) => {
    const mappedSkill = jobToSkill[panel.dataset.jobPanel] || panel.dataset.jobPanel;
    panel.classList.toggle("hidden", mappedSkill !== skill && panel.dataset.skillWorkspace !== skill);
  });
};
const showAmazonProductMiningPage = (page) => {
  const activePage = page || "history";
  document.querySelectorAll("[data-amazon-product-mining-page]").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.amazonProductMiningPage === activePage));
  });
  document.querySelectorAll("[data-amazon-product-mining-surface]").forEach((surface) => {
    surface.classList.toggle("hidden", surface.dataset.amazonProductMiningSurface !== activePage);
  });
};
const showWorkspacePage = (skill, page) => {
  const activePage = page || "main";
  document.querySelectorAll("[data-workspace-page-skill='" + skill + "']").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.workspacePage === activePage));
  });
  document.querySelectorAll("[data-workspace-surface-skill='" + skill + "']").forEach((surface) => {
    surface.classList.toggle("hidden", surface.dataset.workspaceSurface !== activePage);
  });
};
const refreshShell = async () => {
  try {
    const [health, mode] = await Promise.all([readJson("/api/health"), readJson("/api/mode")]);
    setText("[data-health-status]", health.status || "ready");
    setText("[data-mode-status]", mode.mode?.platformTarget || mode.mode?.mode || "local");
    writeActivity("shell refreshed", "completed");
  } catch (error) {
    writeActivity("shell refresh failed: " + error.message, "failed");
  }
};
${renderAmazonProductMiningReviewClient()}
${renderAmazonInvoiceClient({
  downloadStart: "/api/plugins/amazon-invoice-upload/download/start",
  downloadLatest: "/api/plugins/amazon-invoice-upload/download/latest",
  downloadArtifact: "/api/plugins/amazon-invoice-upload/download/artifact/",
  uploadLedger: "/api/plugins/amazon-invoice-upload/ledger",
})}
${renderPick3Client()}
const renderLedger = (payload, options = {}) => {
  const record = payload?.record || payload?.task || payload;
  if (!record || typeof record !== "object") return;
  const job = options.job || state.skill;
  const targetSkill = jobToSkill[job] || job;
  if (targetSkill !== state.skill) {
    return;
  }
  let recordId = "-";
  if (job === "facebook" || job === "facebook-video-mining") {
    const nextRunId = typeof record.runId === "string" && record.runId ? record.runId : state.facebookRunId;
    recordId = nextRunId || "-";
    if (nextRunId) state.facebookRunId = nextRunId;
  } else if (job === "amazon-product-mining") {
    const nextTaskId = typeof record.taskId === "string" && record.taskId ? record.taskId : state.amazonProductMiningTaskId;
    recordId = nextTaskId || "-";
    if (nextTaskId) state.amazonProductMiningTaskId = nextTaskId;
    renderAmazonProductMiningSummary(record);
  } else {
    const nextTaskId = typeof record.taskId === "string" && record.taskId ? record.taskId : state.taskId;
    recordId = nextTaskId || "-";
    if (nextTaskId) state.taskId = nextTaskId;
  }
  setText("[data-task-id]", recordId);
  setText("[data-task-status]", record.status || "-");
  setText("[data-task-step]", record.reachedStep || record.currentRoundId || "-");
  setText("[data-task-reason]", record.failureReason || record.reason || "-");
  setText("[data-evidence-ref]", record.evidenceRef || record.videoArtifactRef || "-");
  const raw = qs("[data-raw-result]");
  if (raw) raw.textContent = JSON.stringify(record, null, 2);
};
const renderFacebookRecords = (records) => {
  const list = qs("[data-facebook-record-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const record of records || []) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = [record.visibleProduct, record.productCategory, record.pageTitle].filter(Boolean).join(" · ") || record.candidateId;
    const reason = document.createElement("div");
    reason.textContent = record.aiReason || "-";
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [record.sourcePageUrl, record.videoArtifactRef || record.videoFilePath || ""].filter(Boolean).join(" | ");
    item.append(title, reason, meta);
    item.addEventListener("click", () => openInspector({ kind: "evidence", title: title.textContent, payload: record }));
    list.append(item);
  }
};
const renderFacebookResults = async (runId) => {
  if (!runId) return;
  const payload = await readJson("/api/facebook-product-video-mining/results?runId=" + encodeURIComponent(runId));
  setText("[data-facebook-saved-count]", String(payload.records?.length || 0));
  setText("[data-facebook-target-count]", String(payload.run?.targetProductCount || 0));
  renderFacebookRecords(payload.records || []);
  return payload;
};
const stopFacebookPolling = () => {
  if (state.facebookPoll) clearInterval(state.facebookPoll);
  state.facebookPoll = null;
};
const pollFacebookRun = async (runId) => {
  const payload = await renderFacebookResults(runId);
  if (payload?.run) renderLedger(payload.run, { job: "facebook" });
  const status = payload?.run?.status;
  if (status && status !== "queued" && status !== "running") {
    stopFacebookPolling();
    writeActivity("facebook run stopped with status " + status, status === "completed" ? "completed" : "manual-required");
  }
};
const startFacebookPolling = (runId) => {
  state.facebookRunId = runId;
  stopFacebookPolling();
  state.facebookPoll = setInterval(() => {
    pollFacebookRun(runId).catch((error) => writeActivity("facebook poll failed: " + error.message, "failed"));
  }, 5000);
  pollFacebookRun(runId).catch((error) => writeActivity("facebook poll failed: " + error.message, "failed"));
};
const startAmazonProductMining = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mission = {
    amazonMarketplace: form.amazonMarketplace.value,
    targetMarket: form.targetMarket.value.trim(),
    productDirection: form.productDirection.value.trim(),
    requestedKeywordCount: Number(form.requestedKeywordCount.value),
    languagePreference: form.languagePreference.value,
    providerKind: form.amazonKeywordProviderKind.value,
  };
  writeActivity("task started: amazon product mining", "running");
  const task = await readJson("/api/amazon-product-mining/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  });
  showAmazonProductMiningPage("latest");
  state.amazonProductMiningTaskId = task.taskId || "";
  if (state.amazonProductMiningTaskId) {
    const current = await readJson("/api/amazon-product-mining/run?taskId=" + encodeURIComponent(state.amazonProductMiningTaskId));
    renderLedger(current, { job: "amazon-product-mining" });
    await refreshAmazonProductMiningReviews();
    startAmazonProductMiningPolling(state.amazonProductMiningTaskId);
    return;
  }
  renderLedger(task, { job: "amazon-product-mining" });
};
const refreshAmazonProductMiningLatest = async () => {
  showAmazonProductMiningPage("latest");
  const latestTask = await readJson("/api/amazon-product-mining/latest");
  if (!latestTask) {
    writeActivity("amazon product mining latest task not found", "manual-required");
    return;
  }
  renderLedger(latestTask, { job: "amazon-product-mining" });
  await refreshAmazonProductMiningReviews();
  if (latestTask.taskId && (latestTask.status === "created" || latestTask.status === "keyword_generating" || latestTask.status === "keyword_ready" || latestTask.status === "mining" || latestTask.status === "packaging")) {
    startAmazonProductMiningPolling(latestTask.taskId);
  }
};
const stopAmazonProductMiningPolling = () => {
  if (state.amazonProductMiningPoll) clearInterval(state.amazonProductMiningPoll);
  state.amazonProductMiningPoll = null;
};
const pollAmazonProductMiningTask = async (taskId) => {
  if (!taskId) return;
  const current = await readJson("/api/amazon-product-mining/run?taskId=" + encodeURIComponent(taskId));
  renderLedger(current, { job: "amazon-product-mining" });
  await refreshAmazonProductMiningReviews();
  const status = current?.status;
  if (status && status !== "created" && status !== "keyword_generating" && status !== "keyword_ready" && status !== "mining" && status !== "packaging") {
    stopAmazonProductMiningPolling();
    writeActivity("amazon product mining stopped with status " + status, status === "package_completed" ? "completed" : "manual-required");
  }
};
const startAmazonProductMiningPolling = (taskId) => {
  state.amazonProductMiningTaskId = taskId || state.amazonProductMiningTaskId;
  stopAmazonProductMiningPolling();
  state.amazonProductMiningPoll = setInterval(() => {
    pollAmazonProductMiningTask(state.amazonProductMiningTaskId).catch((error) => writeActivity("amazon product mining poll failed: " + error.message, "failed"));
  }, 5000);
  pollAmazonProductMiningTask(state.amazonProductMiningTaskId).catch((error) => writeActivity("amazon product mining poll failed: " + error.message, "failed"));
};
const exportAmazonProductMining = async () => {
  const taskId = state.amazonProductMiningTaskId;
  if (!taskId) return writeActivity("amazon product mining task id is required", "manual-required");
  const exported = await readJson("/api/amazon-product-mining/export?taskId=" + encodeURIComponent(taskId));
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "amazon-product-mining-" + taskId + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
  writeActivity("package generated: amazon product mining export ready", "completed");
};
const startFacebook = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  writeActivity("task started: facebook video mining", "running");
  const run = await readJson("/api/facebook-product-video-mining/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetProductCount: Number(form.targetProductCount.value) }),
  });
  renderLedger(run, { job: "facebook" });
  startFacebookPolling(run.runId);
};
const refreshFacebookLatest = async () => {
  const run = await readJson("/api/facebook-product-video-mining/latest");
  renderLedger(run, { job: "facebook" });
  if (run?.runId) {
    state.facebookRunId = run.runId;
    await renderFacebookResults(run.runId);
    if (run.status === "queued" || run.status === "running") startFacebookPolling(run.runId);
  }
};
const exportFacebookSelection = async () => {
  const runId = state.facebookRunId;
  if (!runId) return writeActivity("facebook run id is required", "manual-required");
  const exported = await readJson("/api/facebook-product-video-mining/export?runId=" + encodeURIComponent(runId));
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "facebook-product-video-selection-" + runId + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
  writeActivity("facebook export ready", "completed");
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-skill-id]").forEach((item) => {
    item.addEventListener("click", () => showSkill(item.dataset.skillId));
  });
  qs("[data-sidebar-toggle]")?.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  qs("[data-inspector-toggle]")?.addEventListener("click", () => document.body.classList.toggle("inspector-collapsed"));
  qs("[data-amazon-form]")?.addEventListener("submit", startAmazon);
  qs("[data-amazon-product-mining-form]")?.addEventListener("submit", startAmazonProductMining);
  qs("[data-facebook-form]")?.addEventListener("submit", startFacebook);
  qs("[data-refresh-shell]")?.addEventListener("click", refreshShell);
  document.querySelectorAll("[data-amazon-product-mining-page]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.amazonProductMiningPage === "latest") {
        refreshAmazonProductMiningLatest().catch((error) => writeActivity("amazon product mining latest refresh failed: " + error.message, "failed"));
        return;
      }
      showAmazonProductMiningPage(tab.dataset.amazonProductMiningPage);
    });
  });
  document.querySelectorAll("[data-workspace-page][data-workspace-page-skill]").forEach((tab) => {
    tab.addEventListener("click", () => showWorkspacePage(tab.dataset.workspacePageSkill, tab.dataset.workspacePage));
  });
  qs("[data-amazon-latest]")?.addEventListener("click", refreshAmazonLatest);
  qs("[data-amazon-resume]")?.addEventListener("click", resumeAmazon);
  qs("[data-amazon-tax-invoice-download-form]")?.addEventListener("submit", startAmazonTaxInvoiceDownload);
  qs("[data-amazon-tax-invoice-download-latest]")?.addEventListener("click", refreshAmazonTaxInvoiceDownloadLatest);
  qs("[data-amazon-tax-invoice-download-artifact]")?.addEventListener("click", openAmazonTaxInvoiceDownloadArtifact);
  qs("[data-amazon-invoice-batch-form]")?.addEventListener("submit", startAmazonInvoiceBatch);
  document.querySelectorAll("[data-amazon-invoice-upload-ledger-refresh]").forEach((button) => {
    button.addEventListener("click", refreshAmazonInvoiceUploadLedger);
  });
  qs("[data-amazon-product-mining-latest]")?.addEventListener("click", refreshAmazonProductMiningLatest);
  qs("[data-amazon-product-mining-export]")?.addEventListener("click", exportAmazonProductMining);
  document.querySelectorAll("[data-amazon-product-mining-refresh-reviews]").forEach((button) => {
    button.addEventListener("click", () => refreshAmazonProductMiningKeywordReviews().catch(() => undefined));
  });
  [
    ["[data-amazon-product-mining-review-task-filter]", "input"],
    ["[data-amazon-product-mining-review-filter]", "change"],
    ["[data-amazon-product-mining-review-marketplace-filter]", "change"],
    ["[data-amazon-product-mining-review-keyword-filter]", "input"],
    ["[data-amazon-product-mining-review-target-market-filter]", "input"],
    ["[data-amazon-product-mining-review-human-next-step-filter]", "change"],
    ["[data-amazon-product-mining-review-data-confidence-filter]", "change"],
    ["[data-amazon-product-mining-review-package-integrity-filter]", "change"],
    ["[data-amazon-product-mining-review-sort]", "change"],
  ].forEach(([selector, eventName]) => {
    qs(selector)?.addEventListener(eventName, () => {
      syncAmazonProductMiningReviewFiltersFromDom();
      renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
    });
  });
  qs("[data-facebook-latest]")?.addEventListener("click", refreshFacebookLatest);
  qs("[data-facebook-export]")?.addEventListener("click", exportFacebookSelection);
  qs("[data-pick3-form]")?.addEventListener("submit", startPick3);
  qs("[data-pick3-latest]")?.addEventListener("click", refreshPick3Latest);
  qs("[data-pick3-trend-refresh]")?.addEventListener("click", () => {
    refreshPick3Trend().catch((error) => writeActivity("pick3 trend refresh failed: " + error.message, "failed"));
  });
  bindPick3TrendDrag();
  refreshPick3Trend().catch(() => undefined);
  qs("[data-pick3-history-refresh]")?.addEventListener("click", () => {
    refreshPick3History().catch((error) => writeActivity("pick3 history refresh failed: " + error.message, "failed"));
  });
  qs("[data-pick3-history-delete]")?.addEventListener("click", () => {
    deletePick3SelectedHistoryTask().catch((error) => writeActivity("pick3 history delete failed: " + error.message, "failed"));
  });
  showSkill("amazon-product-mining");
  showAmazonProductMiningPage("history");
  refreshShell();
  renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
});
`;

export const renderWorkbenchHomeClient = (): string => WORKBENCH_HOME_CLIENT;
