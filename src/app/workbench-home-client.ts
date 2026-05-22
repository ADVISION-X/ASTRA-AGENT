const WORKBENCH_HOME_CLIENT = `
const state = { job: "amazon", taskId: localStorage.getItem("grasseye:lastTaskId") || "" };
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
const renderLedger = (payload) => {
  const record = payload?.record || payload?.task || payload;
  if (!record || typeof record !== "object") return;
  const taskId = record.taskId || record.runId || state.taskId || "-";
  state.taskId = taskId === "-" ? state.taskId : taskId;
  if (state.taskId) localStorage.setItem("grasseye:lastTaskId", state.taskId);
  setText("[data-task-id]", taskId);
  setText("[data-task-status]", record.status || "-");
  setText("[data-task-step]", record.reachedStep || record.currentRoundId || "-");
  setText("[data-task-reason]", record.failureReason || record.reason || "-");
  setText("[data-evidence-ref]", record.evidenceRef || record.videoArtifactRef || "-");
  qs("[data-raw-result]").textContent = JSON.stringify(record, null, 2);
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
  }));
};
const startFacebook = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mission = {
    feedEntryUrl: form.feedEntryUrl.value,
    providerKind: form.providerKind.value,
    modelName: form.modelName.value || null,
    targetProductCount: Number(form.targetProductCount.value),
    maxRounds: Number(form.maxRounds.value),
    maxMinutes: Number(form.maxMinutes.value),
  };
  writeActivity("facebook product video mining submitted");
  renderLedger(await readJson("/api/facebook-product-video-mining/mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  }));
};
const refreshFacebookLatest = async () => {
  renderLedger(await readJson("/api/facebook-product-video-mining/latest"));
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-job-card]").forEach((card) => {
    card.addEventListener("click", () => showJob(card.dataset.jobCard));
  });
  qs("[data-amazon-form]").addEventListener("submit", startAmazon);
  qs("[data-facebook-form]").addEventListener("submit", startFacebook);
  qs("[data-refresh-shell]").addEventListener("click", refreshShell);
  qs("[data-amazon-latest]").addEventListener("click", refreshAmazonLatest);
  qs("[data-amazon-resume]").addEventListener("click", resumeAmazon);
  qs("[data-facebook-latest]").addEventListener("click", refreshFacebookLatest);
  refreshShell();
});
`;

export const renderWorkbenchHomeClient = (): string => WORKBENCH_HOME_CLIENT;
