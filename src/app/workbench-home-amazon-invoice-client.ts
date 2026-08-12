type AmazonInvoiceClientRoutes = {
  downloadArtifact: string;
  downloadLatest: string;
  downloadStart: string;
  uploadLedger: string;
};

const AMAZON_INVOICE_UPLOAD_CLIENT = `
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
  };
  if (form.adminOrderUrl.value) mission.adminOrderUrl = form.adminOrderUrl.value;
  const body = new FormData();
  body.append("mission", JSON.stringify(mission));
  body.append("invoicePdf", form.invoicePdf.files[0]);
  writeActivity("amazon invoice upload submitted", "running");
  renderLedger(await readJson("/api/plugins/amazon-invoice-upload/start", { method: "POST", body }), { job: "amazon" });
};
const refreshAmazonLatest = async () => {
  const orderId = qs("[name=amazonOrderId]")?.value;
  if (!orderId) return writeActivity("amazon order id is required", "manual-required");
  const invoiceNo = qs("[name=invoiceNo]")?.value;
  const params = new URLSearchParams({ amazonOrderId: orderId });
  if (invoiceNo) params.set("invoiceNo", invoiceNo);
  renderLedger(await readJson("/api/plugins/amazon-invoice-upload/latest?" + params), { job: "amazon" });
};
const resumeAmazon = async () => {
  if (!state.taskId) return writeActivity("task id is required", "manual-required");
  renderLedger(await readJson("/api/amazon-invoice-upload/task/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId: state.taskId }),
  }), { job: "amazon" });
};
`;

const amazonInvoiceBatchListClient = (): string => `
const AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT = 200;
const summarizeAmazonInvoiceBatchItems = (items) => {
  const summary = { upload_success: 0, already_uploaded: 0, amount_mismatch_skipped: 0, review_required: 0, failed: 0, blocked_auth: 0, invalid: 0 };
  for (const item of items || []) {
    if (item.status in summary) summary[item.status] += 1;
  }
  return summary;
};
const compactAmazonInvoiceBatchRecord = (record) => {
  const items = record?.items || [];
  if (items.length <= AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT) return record;
  return { ...record, items: items.slice(0, AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT), itemPreviewTruncated: true, itemPreviewTotal: items.length };
};
const renderAmazonInvoiceBatchItems = (items, currentIndex) => {
  const list = qs("[data-amazon-invoice-batch-items]");
  if (!list) return;
  list.innerHTML = "";
  const sourceItems = items || [];
  const visibleItems = sourceItems.slice(0, AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT);
  if (Number.isInteger(currentIndex) && currentIndex >= AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT && currentIndex < sourceItems.length) visibleItems.push(sourceItems[currentIndex]);
  for (const item of visibleItems) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = [item.index + 1, item.amazonOrderId, item.status].filter(Boolean).join(" · ");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [item.originalFileName, item.reachedStep, item.reason].filter(Boolean).join(" | ");
    row.append(title, meta);
    row.addEventListener("click", () => openInspector({ kind: "batch item", title: item.amazonOrderId || item.originalFileName, payload: item }));
    list.append(row);
  }
  if (sourceItems.length > visibleItems.length) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = "Showing " + visibleItems.length + " of " + sourceItems.length + " records";
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = "Full per-file progress is retained in the in-memory queue and persisted single-upload ledger.";
    row.append(title, meta);
    list.append(row);
  }
};
`;

const amazonInvoiceBatchLifecycleClient = (): string => `
const amazonInvoiceBatchSellerCentralEntryUrl = (marketplace) => ({
  AE: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
  SA: "https://sellercentral.amazon.sa/orders-v3/order/000-0000000-0000000",
  JP: "https://sellercentral.amazon.co.jp/orders-v3/order/000-0000000-0000000",
  US: "https://sellercentral.amazon.com/orders-v3/order/000-0000000-0000000",
  UK: "https://sellercentral.amazon.co.uk/orders-v3/order/000-0000000-0000000",
})[marketplace] || "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000";
const renderAmazonInvoiceBatch = (payload) => {
  const record = payload?.record || payload?.batch || payload;
  if (!record || typeof record !== "object") return;
  const batchId = record.batchId || state.amazonInvoiceBatchId || "";
  if (batchId) state.amazonInvoiceBatchId = batchId;
  const items = record.items || [];
  const needsSummary = [record.succeeded, record.alreadyUploaded, record.failed, record.blockedAuth].some((value) => typeof value !== "number");
  const summary = needsSummary ? summarizeAmazonInvoiceBatchItems(items) : null;
  setText("[data-amazon-invoice-batch-id]", batchId || "-");
  const batchStateText = record.status === "inter_item_pacing"
    ? "inter_item_pacing · " + String(record.interItemDelayMs || 0) + "ms · next " + (record.nextItemAt || "-")
    : record.status || "-";
  setText("[data-amazon-invoice-batch-state]", batchStateText);
  setText("[data-amazon-invoice-batch-current]", record.currentOrderId || "-");
  setText("[data-amazon-invoice-batch-total]", String(record.total ?? items.length));
  setText("[data-amazon-invoice-batch-succeeded]", String(record.succeeded ?? summary.upload_success));
  setText("[data-amazon-invoice-batch-already]", String(record.alreadyUploaded ?? summary.already_uploaded));
  setText("[data-amazon-invoice-batch-failed]", String(record.failed ?? summary.amount_mismatch_skipped + summary.review_required + summary.failed + summary.invalid));
  setText("[data-amazon-invoice-batch-blocked-auth]", String(record.blockedAuth ?? summary.blocked_auth));
  renderAmazonInvoiceBatchItems(items, record.currentIndex);
  renderLedger(compactAmazonInvoiceBatchRecord(record), { job: "amazon" });
};
`;

const amazonInvoiceLocalQueueHelpersClient = (): string => `
const AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS = 2000;
const AMAZON_INVOICE_INTER_ITEM_DELAY_MAX_MS = 15000;
const sampleAmazonInvoiceInterItemDelayMs = () => {
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  const unitInterval = entropy[0] / 0x100000000;
  return AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS + Math.floor(unitInterval * (AMAZON_INVOICE_INTER_ITEM_DELAY_MAX_MS - AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS + 1));
};
const waitAmazonInvoiceInterItemDelay = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));
const runAmazonInvoiceInterItemPacing = async (record, item) => {
  const delayMs = sampleAmazonInvoiceInterItemDelayMs();
  const nextItemAt = new Date(Date.now() + delayMs).toISOString();
  const pacing = { ...record, status: "inter_item_pacing", reason: "Waiting a bounded random interval before the next real single-upload request.", reachedStep: "inter-item pacing", currentIndex: item.index, currentOrderId: item.amazonOrderId, interItemDelayMs: delayMs, nextItemAt, updatedAt: new Date().toISOString() };
  renderAmazonInvoiceBatch(pacing);
  writeActivity("amazon invoice local queue pacing " + delayMs + "ms before " + item.amazonOrderId, "running");
  await waitAmazonInvoiceInterItemDelay(delayMs);
  return { ...pacing, status: "running", reason: "Inter-item pacing completed; the next real single-upload request may start.", reachedStep: "local file queue", interItemDelayMs: null, nextItemAt: null, updatedAt: new Date().toISOString() };
};
const parseAmazonInvoiceBatchFileName = (fileName) => /^\\d{3}-\\d{7}-\\d{7}\\.pdf$/i.test(fileName || "") ? fileName.slice(0, -4) : "";
const ensureAmazonInvoiceBackendReady = async () => {
  try {
    const health = await readJson("/api/health");
    return health?.status === "healthy" || health?.status === "degraded";
  } catch (error) {
    return false;
  }
};
const normalizeAmazonInvoiceLocalBatchResult = (result) => {
  const record = result?.record || result?.task || result;
  if (!record || typeof record !== "object") return { status: "failed", reason: "empty upload response", reachedStep: "single upload response" };
  const payload = { reason: record.reason || record.failureReason || "-", reachedStep: record.reachedStep || "-", taskId: record.taskId, evidenceRef: record.evidenceRef, runtimeLogRef: record.runtimeLogRef, navigationEvidenceRef: record.orderNavigationProof?.evidenceRef || record.navigationEvidenceRef };
  if (record.status === "upload_success") return { ...payload, status: "upload_success" };
  if (record.status === "already_uploaded") return { ...payload, status: "already_uploaded" };
  if (record.status === "amount_mismatch_skipped") return { ...payload, status: "amount_mismatch_skipped", reviewRequired: true, amountCheck: record.amountCheck };
  if (record.status === "login_required" || record.status === "captcha_or_2fa_required") return { ...payload, status: "blocked_auth" };
  if (record.status === "review_required") return { ...payload, status: "review_required", reviewRequired: true };
  return { ...payload, status: "failed", reviewRequired: record.reviewRequired === true };
};
const buildAmazonInvoiceLocalQueueRecord = (files) => {
  const now = new Date().toISOString();
  const seenOrderIds = new Set();
  const items = files.map((file, index) => {
    const orderId = parseAmazonInvoiceBatchFileName(file.name);
    const duplicate = Boolean(orderId && seenOrderIds.has(orderId));
    if (orderId) seenOrderIds.add(orderId);
    return { index, originalFileName: file.name, safeFileName: file.name, amazonOrderId: orderId, invoiceNo: orderId, status: orderId && !duplicate ? "queued" : "invalid", reason: duplicate ? "duplicate_order_id_in_batch" : orderId ? "queued" : "invalid_pdf_filename", reachedStep: orderId && !duplicate ? "queued" : "validate local file", updatedAt: now };
  });
  return { batchId: "local-file-queue-" + Date.now().toString(36), status: "running", reason: "Local file queue started through existing single-upload API.", reachedStep: "local file queue", total: files.length, succeeded: 0, alreadyUploaded: 0, failed: items.filter((item) => item.status === "invalid").length, blockedAuth: 0, items, createdAt: now, updatedAt: now };
};
const amazonInvoiceLocalQueueCounterKey = (status) => ({ upload_success: "succeeded", already_uploaded: "alreadyUploaded", amount_mismatch_skipped: "failed", review_required: "failed", failed: "failed", invalid: "failed", blocked_auth: "blockedAuth" })[status] || "";
const shouldStopAmazonInvoiceLocalQueue = (result, stopOnFailed) => result.status === "blocked_auth" || result.status === "review_required" || (result.status === "failed" && stopOnFailed === true);
const amazonInvoiceLocalQueueItemKey = (item) => item.amazonOrderId + "::" + item.invoiceNo;
const loadAmazonInvoiceUploadLedgerIndex = async () => {
  const payload = await readJson("/api/plugins/amazon-invoice-upload/ledger");
  const index = new Map();
  for (const record of payload.records || []) {
    if (record.status === "upload_success" || record.status === "already_uploaded") index.set(record.amazonOrderId + "::" + record.invoiceNo, record);
  }
  return index;
};
const markAmazonInvoiceLocalQueueItem = (record, item, patch) => {
  const previous = record.items[item.index] || item;
  const updated = { ...previous, ...patch, updatedAt: new Date().toISOString() };
  const nextRecord = { ...record, updatedAt: new Date().toISOString() };
  const fromCounter = amazonInvoiceLocalQueueCounterKey(previous.status);
  const toCounter = amazonInvoiceLocalQueueCounterKey(updated.status);
  if (fromCounter && fromCounter !== toCounter && typeof nextRecord[fromCounter] === "number") nextRecord[fromCounter] = Math.max(0, nextRecord[fromCounter] - 1);
  if (toCounter && fromCounter !== toCounter && typeof nextRecord[toCounter] === "number") nextRecord[toCounter] += 1;
  record.items[item.index] = updated;
  nextRecord.items = record.items;
  return nextRecord;
};
`;

const amazonInvoiceLocalQueueUploadClient = (): string => `
const uploadAmazonInvoiceLocalQueueItem = async (form, files, record, item) => {
  record = markAmazonInvoiceLocalQueueItem({ ...record, currentIndex: item.index, currentOrderId: item.amazonOrderId }, item, { status: "uploading", reason: "Uploading through existing single-upload API.", reachedStep: "single upload start", startedAt: new Date().toISOString() });
  renderAmazonInvoiceBatch(record);
  const mission = { missionType: "amazon_invoice_upload", marketplace: form.marketplace.value, sellerCentralEntryUrl: amazonInvoiceBatchSellerCentralEntryUrl(form.marketplace.value).replace("000-0000000-0000000", item.amazonOrderId), amazonOrderId: item.amazonOrderId, invoiceNo: item.invoiceNo, invoicePdfPath: "approved-by-workbench" };
  const body = new FormData();
  body.append("mission", JSON.stringify(mission));
  body.append("invoicePdf", files[item.index]);
  const result = normalizeAmazonInvoiceLocalBatchResult(await readJson("/api/plugins/amazon-invoice-upload/start", { method: "POST", body }));
  return markAmazonInvoiceLocalQueueItem(record, item, { ...result, completedAt: new Date().toISOString() });
};
`;

const amazonInvoiceLocalQueueRunnerClient = (): string => `
const startAmazonInvoiceBatch = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (state.amazonInvoiceBatchRunning === true) {
    writeActivity("amazon invoice local queue rejected: batch_already_running", "failed");
    return;
  }
  state.amazonInvoiceBatchRunning = true;
  const startButton = form.querySelector('button[type="submit"]');
  if (startButton) startButton.disabled = true;
  try {
  const files = Array.from(form.invoicePdfs.files || []);
  let record = buildAmazonInvoiceLocalQueueRecord(files);
  renderAmazonInvoiceBatch(record);
  if (!await ensureAmazonInvoiceBackendReady()) {
    record = { ...record, status: "failed", reason: "backend_unreachable", reachedStep: "api health preflight", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    renderAmazonInvoiceBatch(record);
    writeActivity("amazon invoice local queue blocked: backend_unreachable", "failed");
    return;
  }
  writeActivity("amazon invoice local queue accepted " + files.length + " files", "running");
  let uploadedLedgerIndex;
  try {
    uploadedLedgerIndex = await loadAmazonInvoiceUploadLedgerIndex();
  } catch (error) {
    record = { ...record, status: "failed", reason: "upload_ledger_preflight_failed: " + (error.message || "ledger read failed"), reachedStep: "upload ledger preflight", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    renderAmazonInvoiceBatch(record);
    writeActivity("amazon invoice local queue blocked: upload_ledger_preflight_failed", "failed");
    return;
  }
  let pendingInterItemDelay = false;
  for (const item of record.items) {
    if (item.status !== "queued") continue;
    const ledgerRecord = uploadedLedgerIndex.get(amazonInvoiceLocalQueueItemKey(item));
    if (ledgerRecord) {
      record = markAmazonInvoiceLocalQueueItem(record, item, { status: "already_uploaded", reason: "skipped_by_upload_ledger", reachedStep: "upload ledger preflight", taskId: ledgerRecord.taskId, evidenceRef: ledgerRecord.evidenceRef, runtimeLogRef: ledgerRecord.runtimeLogRef, navigationEvidenceRef: ledgerRecord.navigationEvidenceRef, completedAt: new Date().toISOString() });
      renderAmazonInvoiceBatch(record);
      continue;
    }
    if (pendingInterItemDelay) {
      try {
        record = await runAmazonInvoiceInterItemPacing(record, item);
        pendingInterItemDelay = false;
      } catch (error) {
        record = markAmazonInvoiceLocalQueueItem(record, item, { status: "review_required", reviewRequired: true, reason: "inter_item_pacing_failed: " + (error.message || "bounded random delay failed"), reachedStep: "inter-item pacing", completedAt: new Date().toISOString() });
        renderAmazonInvoiceBatch(record);
        writeActivity("amazon invoice local queue stopped: inter_item_pacing_failed", "failed");
        break;
      }
    }
    try {
      record = await uploadAmazonInvoiceLocalQueueItem(form, files, record, item);
    } catch (error) {
      record = markAmazonInvoiceLocalQueueItem(record, item, { status: "review_required", reviewRequired: true, reason: "single_upload_transport_outcome_unknown: " + (error.message || "single upload response was not received"), reachedStep: "single upload response unknown", completedAt: new Date().toISOString() });
      writeActivity("amazon invoice local queue stopped on unknown upload outcome: " + item.amazonOrderId, "failed");
    }
    renderAmazonInvoiceBatch(record);
    const result = record.items[item.index];
    if (result.status === "upload_success" || result.status === "already_uploaded") uploadedLedgerIndex.set(amazonInvoiceLocalQueueItemKey(item), result);
    if (shouldStopAmazonInvoiceLocalQueue(result, form.stopOnFailed.checked)) break;
    pendingInterItemDelay = true;
  }
  const hasBlockedAuth = record.items.some((item) => item.status === "blocked_auth");
  const hasReviewRequired = record.items.some((item) => item.status === "review_required");
  const hasFailed = record.items.some((item) => item.status === "amount_mismatch_skipped" || item.status === "failed" || item.status === "invalid");
  record = { ...record, status: hasBlockedAuth ? "blocked_auth" : hasReviewRequired ? "review_required" : hasFailed ? "completed_with_errors" : "completed", reason: hasReviewRequired ? "Local file queue stopped on the current review-required order; queued orders were not started." : "Local file queue completed through existing single-upload API.", reachedStep: hasReviewRequired ? "local file queue paused for review" : "local file queue completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  renderAmazonInvoiceBatch(record);
  await refreshAmazonInvoiceUploadLedger();
  } finally {
    state.amazonInvoiceBatchRunning = false;
    if (startButton) startButton.disabled = false;
  }
};
`;

const amazonInvoiceLocalQueueClient = (): string =>
  `${amazonInvoiceLocalQueueHelpersClient()}${amazonInvoiceLocalQueueUploadClient()}${amazonInvoiceLocalQueueRunnerClient()}`;

const amazonInvoiceBatchHistoryClient = (routes: AmazonInvoiceClientRoutes): string => `
const refreshAmazonInvoiceUploadLedger = async () => {
  showWorkspacePage("amazon-invoice-upload", "ledger");
  const payload = await readJson("${routes.uploadLedger}");
  const list = qs("[data-amazon-invoice-upload-ledger-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const record of payload.records || []) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = [record.updatedAt, record.amazonOrderId, record.status].filter(Boolean).join(" · ");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [record.invoiceNo, record.reachedStep, record.reason].filter(Boolean).join(" | ");
    row.append(title, meta);
    row.addEventListener("click", () => openInspector({ kind: "upload ledger", title: record.amazonOrderId || record.taskId, payload: record }));
    list.append(row);
  }
};
`;

const amazonInvoiceBatchClient = (routes: AmazonInvoiceClientRoutes): string =>
  `${amazonInvoiceBatchListClient()}${amazonInvoiceBatchLifecycleClient()}${amazonInvoiceLocalQueueClient()}${amazonInvoiceBatchHistoryClient(routes)}`;

const amazonTaxInvoiceDownloadClient = (routes: AmazonInvoiceClientRoutes): string => `
const renderAmazonTaxInvoiceDownload = (payload) => {
  const record = payload?.record || payload?.task || payload;
  if (!record || typeof record !== "object") return;
  const taskId = record.taskId || state.amazonTaxInvoiceDownloadTaskId || "";
  if (taskId) state.amazonTaxInvoiceDownloadTaskId = taskId;
  setText("[data-amazon-tax-invoice-download-task-id]", taskId || "-");
  setText("[data-amazon-tax-invoice-download-state]", record.status || "-");
  setText("[data-amazon-tax-invoice-download-step]", record.reachedStep || "-");
  setText("[data-amazon-tax-invoice-download-artifact-ref]", record.downloadArtifactRef || "-");
  renderLedger(record, { job: "amazon" });
};
const startAmazonTaxInvoiceDownload = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const mission = {
    missionType: "amazon_tax_invoice_download",
    marketplace: form.marketplace.value,
    sellerCentralEntryUrl: form.sellerCentralEntryUrl.value,
    reportKind: "afn_shipment_invoicing_tax_invoice",
    dateRange: "last_30_days",
    format: "csv",
    requireHumanReview: form.requireHumanReview.checked,
  };
  if (form.callbackUrl.value) mission.callbackUrl = form.callbackUrl.value;
  writeActivity("amazon tax invoice download submitted", "running");
  renderAmazonTaxInvoiceDownload(await readJson("${routes.downloadStart}", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  }));
};
const refreshAmazonTaxInvoiceDownloadLatest = async () => {
  const marketplace = qs("[data-amazon-tax-invoice-download-form] [name=marketplace]")?.value || "AE";
  const params = new URLSearchParams({ marketplace });
  const latest = await readJson("${routes.downloadLatest}?" + params);
  if (!latest) return writeActivity("amazon tax invoice latest download not found", "manual-required");
  renderAmazonTaxInvoiceDownload(latest);
};
const openAmazonTaxInvoiceDownloadArtifact = async () => {
  const taskId = state.amazonTaxInvoiceDownloadTaskId || qs("[data-amazon-tax-invoice-download-task-id]")?.textContent;
  if (!taskId || taskId === "-") return writeActivity("download task id is required", "manual-required");
  const artifact = await readJson("${routes.downloadArtifact}" + encodeURIComponent(taskId));
  openInspector({ kind: "artifact", title: "Amazon tax invoice CSV artifact", payload: artifact });
};
`;

export const renderAmazonInvoiceClient = (routes: AmazonInvoiceClientRoutes): string =>
  `${AMAZON_INVOICE_UPLOAD_CLIENT}${amazonInvoiceBatchClient(routes)}${amazonTaxInvoiceDownloadClient(routes)}`;
