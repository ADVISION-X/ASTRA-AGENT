const WORKBENCH_HOME_CLIENT = `
const state = {
  job: "amazon",
  taskId: localStorage.getItem("grasseye:lastTaskId") || "",
  amazonProductMiningTaskId: localStorage.getItem("grasseye:lastAmazonProductMiningTaskId") || "",
  facebookRunId: localStorage.getItem("grasseye:lastFacebookRunId") || "",
  facebookPoll: null,
};
const qs = (selector) => document.querySelector(selector);
const setText = (selector, value) => { const node = qs(selector); if (node) node.textContent = value ?? "-"; };
const writeActivity = (message, tone = "") => {
  const node = document.createElement("div");
  node.className = tone;
  node.textContent = new Date().toLocaleTimeString() + " " + message;
  qs("[data-activity-log]").prepend(node);
};
const readJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.failureReason || payload.error || response.statusText);
  return payload;
};
const showJob = (job) => {
  state.job = job;
  document.body.dataset.activeJob = job;
  document.querySelectorAll("[data-job-card]").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.jobCard === job));
  });
  document.querySelectorAll("[data-job-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.jobPanel !== job);
  });
};
const refreshShell = async () => {
  try {
    const [health, mode] = await Promise.all([readJson("/api/health"), readJson("/api/mode")]);
    setText("[data-health-status]", health.status || "ready");
    setText("[data-mode-status]", mode.mode?.platformTarget || mode.mode?.mode || "local");
    writeActivity("health and mode refreshed", "ok");
  } catch (error) {
    writeActivity("shell refresh failed: " + error.message, "bad");
  }
};
const renderAmazonProductMiningSummary = (record) => {
  const taskId = typeof record.taskId === "string" && record.taskId
    ? record.taskId
    : state.amazonProductMiningTaskId || "-";
  const packageRef = record.packageJsonPath || record.pdfReportPath || record.evidenceIndexPath || "-";
  setText("[data-amazon-product-mining-task-id]", taskId);
  setText("[data-amazon-product-mining-status]", record.status || "-");
  setText("[data-amazon-product-mining-package]", packageRef);
};
const renderLedger = (payload, options = {}) => {
  const record = payload?.record || payload?.task || payload;
  if (!record || typeof record !== "object") return;
  const job = options.job || state.job;
  let recordId = "-";
  if (job === "facebook") {
    const nextRunId = typeof record.runId === "string" && record.runId ? record.runId : state.facebookRunId;
    recordId = nextRunId || "-";
    if (nextRunId) {
      state.facebookRunId = nextRunId;
      localStorage.setItem("grasseye:lastFacebookRunId", nextRunId);
    }
  } else if (job === "amazon-product-mining") {
    const nextTaskId = typeof record.taskId === "string" && record.taskId ? record.taskId : state.amazonProductMiningTaskId;
    recordId = nextTaskId || "-";
    if (nextTaskId) {
      state.amazonProductMiningTaskId = nextTaskId;
      localStorage.setItem("grasseye:lastAmazonProductMiningTaskId", nextTaskId);
    }
    renderAmazonProductMiningSummary(record);
  } else {
    const nextTaskId = typeof record.taskId === "string" && record.taskId ? record.taskId : state.taskId;
    recordId = nextTaskId || "-";
    if (nextTaskId) {
      state.taskId = nextTaskId;
      localStorage.setItem("grasseye:lastTaskId", nextTaskId);
    }
  }
  setText("[data-task-id]", recordId);
  setText("[data-task-status]", record.status || "-");
  setText("[data-task-step]", record.reachedStep || record.currentRoundId || "-");
  setText("[data-task-reason]", record.failureReason || record.reason || "-");
  setText("[data-evidence-ref]", record.evidenceRef || record.videoArtifactRef || "-");
  qs("[data-raw-result]").textContent = JSON.stringify(record, null, 2);
};
const renderFacebookRecords = (records) => {
  const list = qs("[data-facebook-record-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const record of records || []) {
    const item = document.createElement("article");
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = [record.visibleProduct, record.productCategory, record.pageTitle].filter(Boolean).join(" · ") || record.candidateId;
    const reason = document.createElement("div");
    reason.textContent = record.aiReason || "-";
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [record.sourcePageUrl, record.videoArtifactRef || record.videoFilePath || ""].filter(Boolean).join(" | ");
    item.append(title, reason, meta);
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
  if (payload?.run) renderLedger(payload.run);
  const status = payload?.run?.status;
  if (status && status !== "queued" && status !== "running") {
    stopFacebookPolling();
    writeActivity("facebook run stopped with status " + status, status === "completed" ? "ok" : "warn");
  }
};
const startFacebookPolling = (runId) => {
  state.facebookRunId = runId;
  localStorage.setItem("grasseye:lastFacebookRunId", runId);
  stopFacebookPolling();
  state.facebookPoll = setInterval(() => {
    pollFacebookRun(runId).catch((error) => writeActivity("facebook poll failed: " + error.message, "bad"));
  }, 5000);
  pollFacebookRun(runId).catch((error) => writeActivity("facebook poll failed: " + error.message, "bad"));
};
const startAmazon = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mission = {
    missionType: "amazon_invoice_upload",
    marketplace: form.marketplace.value,
    sellerCentralEntryUrl: form.sellerCentralEntryUrl.value,
    amazonOrderId: form.amazonOrderId.value,
    invoiceNo: form.invoiceNo.value,
    invoicePdfPath: "approved-by-workbench",
    requireHumanFinalSubmit: form.requireHumanFinalSubmit.checked,
  };
  if (form.adminOrderUrl.value) mission.adminOrderUrl = form.adminOrderUrl.value;
  const body = new FormData();
  body.append("mission", JSON.stringify(mission));
  body.append("invoicePdf", form.invoicePdf.files[0]);
  writeActivity("amazon invoice upload submitted");
  renderLedger(await readJson("/api/plugins/amazon-invoice-upload/start", { method: "POST", body }));
};
const refreshAmazonLatest = async () => {
  const orderId = qs("[name=amazonOrderId]").value;
  if (!orderId) return writeActivity("amazon order id is required", "warn");
  const invoiceNo = qs("[name=invoiceNo]").value;
  const params = new URLSearchParams({ amazonOrderId: orderId });
  if (invoiceNo) params.set("invoiceNo", invoiceNo);
  renderLedger(await readJson("/api/plugins/amazon-invoice-upload/latest?" + params));
};
const resumeAmazon = async () => {
  if (!state.taskId) return writeActivity("task id is required", "warn");
  renderLedger(await readJson("/api/amazon-invoice-upload/task/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: state.taskId }),
  }), { job: "amazon" });
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
  };
  writeActivity("amazon product mining submitted");
  const task = await readJson("/api/amazon-product-mining/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  });
  state.amazonProductMiningTaskId = task.taskId || "";
  if (state.amazonProductMiningTaskId) {
    localStorage.setItem("grasseye:lastAmazonProductMiningTaskId", state.amazonProductMiningTaskId);
    const current = await readJson("/api/amazon-product-mining/run?taskId=" + encodeURIComponent(state.amazonProductMiningTaskId));
    renderLedger(current, { job: "amazon-product-mining" });
    return;
  }
  renderLedger(task, { job: "amazon-product-mining" });
};
const refreshAmazonProductMiningLatest = async () => {
  const latestTask = await readJson("/api/amazon-product-mining/latest");
  if (!latestTask) {
    writeActivity("amazon product mining latest task not found", "warn");
    return;
  }
  renderLedger(latestTask, { job: "amazon-product-mining" });
};
const exportAmazonProductMining = async () => {
  const taskId = state.amazonProductMiningTaskId;
  if (!taskId) return writeActivity("amazon product mining task id is required", "warn");
  const exported = await readJson("/api/amazon-product-mining/export?taskId=" + encodeURIComponent(taskId));
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "amazon-product-mining-" + taskId + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
  writeActivity("amazon product mining export ready", "ok");
};
const startFacebook = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mission = {
    targetProductCount: Number(form.targetProductCount.value),
  };
  writeActivity("facebook product video mining submitted");
  const run = await readJson("/api/facebook-product-video-mining/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  });
  renderLedger(run, { job: "facebook" });
  startFacebookPolling(run.runId);
};
const refreshFacebookLatest = async () => {
  const run = await readJson("/api/facebook-product-video-mining/latest");
  renderLedger(run, { job: "facebook" });
  if (run?.runId) {
    state.facebookRunId = run.runId;
    localStorage.setItem("grasseye:lastFacebookRunId", run.runId);
    await renderFacebookResults(run.runId);
    if (run.status === "queued" || run.status === "running") startFacebookPolling(run.runId);
  }
};
const exportFacebookSelection = async () => {
  const runId = state.facebookRunId;
  if (!runId) return writeActivity("facebook run id is required", "warn");
  const exported = await readJson("/api/facebook-product-video-mining/export?runId=" + encodeURIComponent(runId));
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "facebook-product-video-selection-" + runId + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
  writeActivity("facebook selection export ready", "ok");
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-job-card]").forEach((card) => {
    card.addEventListener("click", () => showJob(card.dataset.jobCard));
  });
  qs("[data-amazon-form]").addEventListener("submit", startAmazon);
  qs("[data-amazon-product-mining-form]").addEventListener("submit", startAmazonProductMining);
  qs("[data-facebook-form]").addEventListener("submit", startFacebook);
  qs("[data-refresh-shell]").addEventListener("click", refreshShell);
  qs("[data-amazon-latest]").addEventListener("click", refreshAmazonLatest);
  qs("[data-amazon-resume]").addEventListener("click", resumeAmazon);
  qs("[data-amazon-product-mining-latest]").addEventListener("click", refreshAmazonProductMiningLatest);
  qs("[data-amazon-product-mining-export]").addEventListener("click", exportAmazonProductMining);
  qs("[data-facebook-latest]").addEventListener("click", refreshFacebookLatest);
  qs("[data-facebook-export]").addEventListener("click", exportFacebookSelection);
  refreshShell();
  if (state.amazonProductMiningTaskId) setText("[data-amazon-product-mining-task-id]", state.amazonProductMiningTaskId);
  if (state.facebookRunId) renderFacebookResults(state.facebookRunId).catch(() => undefined);
});
`;

export const renderWorkbenchHomeClient = (): string => WORKBENCH_HOME_CLIENT;
