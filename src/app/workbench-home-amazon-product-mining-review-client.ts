const AMAZON_PRODUCT_MINING_REVIEW_CLIENT = `
const REVIEW_TABLE_COLUMN_COUNT = 16;
const NOT_AVAILABLE = "not_available";
const REVIEW_DECISION_PRIORITY = { PASS: 0, WATCH: 1, INSUFFICIENT_DATA: 2, REJECT: 3 };
const REVIEW_STRENGTH_PRIORITY = { strong: 0, medium: 1, weak: 2, insufficient: 3, not_available: 4 };

const normalizeAmazonProductMiningReviewValue = (value) => {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return NOT_AVAILABLE;
  const trimmed = value.trim();
  return trimmed || NOT_AVAILABLE;
};
const normalizeAmazonProductMiningReviewText = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const appendCell = (row, text, className = "") => {
  const cell = document.createElement("td");
  cell.textContent = text || "-";
  if (className) cell.className = className;
  row.append(cell);
  return cell;
};
const setAmazonProductMiningText = (selector, value) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value ?? "-";
  });
};
const createOpenButton = (label, filePath, kind = "package") => {
  const button = document.createElement("button");
  button.className = "btn secondary compact-button";
  button.type = "button";
  button.textContent = label;
  button.disabled = !filePath;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!filePath) return;
    window.open("file://" + encodeURI(filePath), "_blank", "noopener");
    openInspector({
      kind,
      title: label,
      payload: { filePath },
    });
  });
  return button;
};
const setAmazonProductMiningReviewTaskFilter = (taskId) => {
  state.amazonProductMiningReviewFilters.taskId = taskId || "";
  setInputValue("[data-amazon-product-mining-review-task-filter]", state.amazonProductMiningReviewFilters.taskId);
};
const setAmazonProductMiningLatestSummaryState = (stateName) => {
  document.querySelectorAll("[data-amazon-product-mining-latest-state]").forEach((node) => {
    node.classList.toggle("hidden", node.dataset.amazonProductMiningLatestState !== stateName);
  });
};
const renderAmazonProductMiningSummary = (record) => {
  const taskId = typeof record.taskId === "string" && record.taskId ? record.taskId : state.amazonProductMiningTaskId || "-";
  const packageRef = record.packageZipPath || record.packageJsonPath || record.pdfReportPath || record.evidenceIndexPath || "-";
  const summary = record.summary || {};
  setAmazonProductMiningText("[data-amazon-product-mining-task-id]", taskId);
  setAmazonProductMiningText("[data-amazon-product-mining-status]", record.status || "-");
  setAmazonProductMiningText("[data-amazon-product-mining-keyword-count]", summary.keywordCount ?? "-");
  setAmazonProductMiningText("[data-amazon-product-mining-search-result-count]", summary.searchResultCount ?? "-");
  setAmazonProductMiningText("[data-amazon-product-mining-product-detail-count]", summary.productDetailCount ?? "-");
  setAmazonProductMiningText("[data-amazon-product-mining-review-count]", summary.reviewCount ?? "-");
  setAmazonProductMiningText("[data-amazon-product-mining-keyword-review-count]", summary.keywordReviewCount ?? "-");
  setAmazonProductMiningText("[data-amazon-product-mining-package]", packageRef);
  if (taskId && taskId !== "-") setAmazonProductMiningReviewTaskFilter(taskId);
  const status = normalizeAmazonProductMiningReviewValue(record.status);
  setAmazonProductMiningLatestSummaryState(status === "manual_required" || status === "failed" ? status : "loaded");
  if (status === "manual_required") setRegionState("manual-required");
  if (status === "failed") setRegionState("failed");
};
const sendAmazonProductMiningControl = async (controlName) => {
  const taskId = state.amazonProductMiningTaskId;
  if (!taskId) return writeActivity("amazon product mining task id is required", "manual-required");
  const result = await readJson("/api/amazon-product-mining/" + controlName, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  writeActivity("amazon product mining " + controlName + " accepted", controlName === "terminate" ? "manual-required" : "running");
  if (controlName === "pause" || controlName === "terminate") stopAmazonProductMiningPolling();
  if (controlName === "continue") startAmazonProductMiningPolling(taskId);
  if (result?.taskId && !result.status) {
    const current = await readJson("/api/amazon-product-mining/run?taskId=" + encodeURIComponent(result.taskId));
    renderLedger(current, { job: "amazon-product-mining" });
    return result;
  }
  renderLedger(result, { job: "amazon-product-mining" });
  return result;
};
const pauseAmazonProductMining = async () => { await sendAmazonProductMiningControl("pause"); };
const continueAmazonProductMining = async () => { await sendAmazonProductMiningControl("continue"); };
const terminateAmazonProductMining = async () => { await sendAmazonProductMiningControl("terminate"); };
const createReviewPill = (value, variant) => {
  const pill = document.createElement("span");
  const normalizedValue = normalizeAmazonProductMiningReviewValue(value);
  const classValue = normalizedValue.toLowerCase().replaceAll("_", "-");
  pill.className = "decision-badge status-badge " + (variant === "decision" ? "status-" + classValue : "status-" + classValue);
  pill.textContent = normalizedValue;
  return pill;
};
const setAmazonProductMiningReviewState = (message, tone = "empty") => {
  const node = qs("[data-amazon-product-mining-review-state]");
  if (!node) return;
  node.textContent = message;
  node.className = "history-state " + tone + "-state";
};
const setAmazonProductMiningReviewEmptyPanel = (message, hidden) => {
  const node = qs("[data-amazon-product-mining-review-empty-panel]");
  if (!node) return;
  node.classList.toggle("hidden", Boolean(hidden));
  const paragraph = node.querySelector("p");
  if (paragraph) paragraph.textContent = message;
};
const setAmazonProductMiningReviewTableVisible = (visible) => {
  const tableShell = qs("[data-amazon-product-mining-review-table-shell]");
  if (tableShell) tableShell.classList.toggle("hidden", !visible);
};
const setSelectOptions = (selectNode, values, selectedValue) => {
  if (!selectNode) return;
  selectNode.innerHTML = "";
  for (const optionSpec of values) {
    const option = document.createElement("option");
    option.value = optionSpec.value;
    option.textContent = optionSpec.label;
    selectNode.append(option);
  }
  selectNode.value = selectedValue;
};
const syncAmazonProductMiningReviewFiltersFromDom = () => {
  state.amazonProductMiningReviewFilters = {
    taskId: qs("[data-amazon-product-mining-review-task-filter]")?.value.trim() || "",
    decision: qs("[data-amazon-product-mining-review-filter]")?.value || "ALL",
    marketplace: qs("[data-amazon-product-mining-review-marketplace-filter]")?.value || "ALL",
    keyword: qs("[data-amazon-product-mining-review-keyword-filter]")?.value.trim() || "",
    targetMarket: qs("[data-amazon-product-mining-review-target-market-filter]")?.value.trim() || "",
    humanNextStep: qs("[data-amazon-product-mining-review-human-next-step-filter]")?.value || "ALL",
    dataConfidence: qs("[data-amazon-product-mining-review-data-confidence-filter]")?.value || "ALL",
    packageIntegrity: qs("[data-amazon-product-mining-review-package-integrity-filter]")?.value || "ALL",
    sort: qs("[data-amazon-product-mining-review-sort]")?.value || "createdAt_desc",
  };
};
const renderAmazonProductMiningReviewFilters = (reviews) => {
  const marketplaces = Array.from(new Set((reviews || [])
    .map((review) => review.marketplace)
    .filter((value) => typeof value === "string" && value.trim().length > 0)))
    .sort((left, right) => left.localeCompare(right));
  if (!marketplaces.includes(state.amazonProductMiningReviewFilters.marketplace) && state.amazonProductMiningReviewFilters.marketplace !== "ALL") {
    state.amazonProductMiningReviewFilters.marketplace = "ALL";
  }
  setSelectOptions(
    qs("[data-amazon-product-mining-review-marketplace-filter]"),
    [{ label: "All", value: "ALL" }, ...marketplaces.map((marketplace) => ({ label: marketplace, value: marketplace }))],
    state.amazonProductMiningReviewFilters.marketplace,
  );
  setAmazonProductMiningReviewTaskFilter(state.amazonProductMiningReviewFilters.taskId);
  setInputValue("[data-amazon-product-mining-review-keyword-filter]", state.amazonProductMiningReviewFilters.keyword);
  setInputValue("[data-amazon-product-mining-review-target-market-filter]", state.amazonProductMiningReviewFilters.targetMarket);
  for (const [selector, value] of [
    ["[data-amazon-product-mining-review-filter]", state.amazonProductMiningReviewFilters.decision],
    ["[data-amazon-product-mining-review-human-next-step-filter]", state.amazonProductMiningReviewFilters.humanNextStep],
    ["[data-amazon-product-mining-review-data-confidence-filter]", state.amazonProductMiningReviewFilters.dataConfidence],
    ["[data-amazon-product-mining-review-package-integrity-filter]", state.amazonProductMiningReviewFilters.packageIntegrity],
    ["[data-amazon-product-mining-review-sort]", state.amazonProductMiningReviewFilters.sort],
  ]) {
    const node = qs(selector);
    if (node) node.value = value;
  }
};
const filterAmazonProductMiningReviews = (reviews) => {
  const filters = state.amazonProductMiningReviewFilters;
  return (reviews || []).filter((review) => {
    if (filters.taskId && !normalizeAmazonProductMiningReviewText(review.taskId).includes(filters.taskId.toLowerCase())) return false;
    if (filters.decision !== "ALL" && normalizeAmazonProductMiningReviewValue(review.decision) !== filters.decision) return false;
    if (filters.marketplace !== "ALL" && normalizeAmazonProductMiningReviewValue(review.marketplace) !== filters.marketplace) return false;
    if (filters.humanNextStep !== "ALL" && normalizeAmazonProductMiningReviewValue(review.humanNextStep) !== filters.humanNextStep) return false;
    if (filters.dataConfidence !== "ALL" && normalizeAmazonProductMiningReviewValue(review.dataConfidence) !== filters.dataConfidence) return false;
    if (filters.packageIntegrity !== "ALL" && normalizeAmazonProductMiningReviewValue(review.packageIntegrity) !== filters.packageIntegrity) return false;
    if (filters.keyword && !normalizeAmazonProductMiningReviewText(review.keyword).includes(filters.keyword.toLowerCase())) return false;
    if (filters.targetMarket && !normalizeAmazonProductMiningReviewText(review.targetMarket).includes(filters.targetMarket.toLowerCase())) return false;
    return true;
  });
};
const sortAmazonProductMiningReviews = (reviews) => {
  const sortMode = state.amazonProductMiningReviewFilters.sort;
  return [...(reviews || [])].sort((left, right) => {
    if (sortMode === "decision_priority") {
      return (REVIEW_DECISION_PRIORITY[normalizeAmazonProductMiningReviewValue(left.decision)] ?? 99)
        - (REVIEW_DECISION_PRIORITY[normalizeAmazonProductMiningReviewValue(right.decision)] ?? 99)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    if (sortMode === "data_confidence") {
      return (REVIEW_STRENGTH_PRIORITY[normalizeAmazonProductMiningReviewValue(left.dataConfidence)] ?? 99)
        - (REVIEW_STRENGTH_PRIORITY[normalizeAmazonProductMiningReviewValue(right.dataConfidence)] ?? 99)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    if (sortMode === "review_count") {
      return Number(right.reviewCount || 0) - Number(left.reviewCount || 0)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    if (sortMode === "product_count") {
      return Number(right.productCount || 0) - Number(left.productCount || 0)
        || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};
const renderReviewInspector = (review) => {
  const link = (label, path, kind) => ({ label, value: path || NOT_AVAILABLE, action: path ? () => openInspector({ kind, title: label, payload: { filePath: path } }) : null });
  openInspector({
    kind: "keyword review",
    title: review.keyword || "Keyword review",
    payload: {
      Keyword: review.keyword,
      Decision: review.decision,
      "Human Next Step": review.humanNextStep,
      "Demand Signal": review.demandSignal,
      "Review Health": review.reviewHealth,
      "Price Ceiling": review.priceCeiling,
      "Competition Openness": review.competitionOpenness,
      "Improvement Opportunity": review.improvementOpportunity,
      "Data Confidence": review.dataConfidence,
      "AI Reason": review.aiReviewSummary || review.reasonEvidenceSummary,
      "Evidence refs": Array.isArray(review.evidenceRefs) ? review.evidenceRefs : [],
      "Missing evidence": Array.isArray(review.missingEvidence) ? review.missingEvidence : [],
      "Risk points": Array.isArray(review.riskPoints) ? review.riskPoints : [],
      "Package link": link("Open Package", review.packageRef, "package"),
      "Master Report link": link("Open Master Report", review.masterEvidenceReportRef, "package"),
      "AI raw response link": link("Open AI Raw Response", review.aiRawResponseRef, "ai review"),
    },
  });
};
const renderAmazonProductMiningReviewRow = (review) => {
  const row = document.createElement("tr");
  row.className = "review-row";
  row.dataset.reviewId = review.reviewId || "";
  row.tabIndex = 0;
  row.addEventListener("click", () => renderReviewInspector(review));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") renderReviewInspector(review);
  });
  appendCell(row, review.createdAt || "-");
  appendCell(row, review.keyword || "-");
  const decisionCell = document.createElement("td");
  decisionCell.append(createReviewPill(review.decision, "decision"));
  row.append(decisionCell);
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.humanNextStep));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.demandSignal));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.reviewHealth));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.priceCeiling));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.competitionOpenness));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.improvementOpportunity));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.dataConfidence));
  appendCell(row, String(review.productCount ?? 0));
  appendCell(row, String(review.reviewCount ?? 0));
  const integrityCell = document.createElement("td");
  integrityCell.append(createReviewPill(review.packageIntegrity, "integrity"));
  row.append(integrityCell);
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.dataCompleteness));
  const statusCell = document.createElement("td");
  statusCell.append(createReviewPill(review.status, "status"));
  row.append(statusCell);
  const openCell = document.createElement("td");
  openCell.className = "table-actions";
  openCell.append(
    createOpenButton("Open Package", review.packageRef || null, "package"),
    createOpenButton("Open Master Report", review.masterEvidenceReportRef || null, "package"),
    createOpenButton("Open AI Review", review.aiReviewRef || review.aiRawResponseRef || null, "ai review"),
    createOpenButton("Open Evidence", review.evidenceIndexRef || null, "evidence"),
  );
  row.append(openCell);
  return row;
};
const renderAmazonProductMiningReviewTable = (reviews) => {
  const rowsNode = qs("[data-amazon-product-mining-review-rows]");
  if (!rowsNode) return;
  renderAmazonProductMiningReviewFilters(reviews);
  rowsNode.innerHTML = "";
  if (state.amazonProductMiningReviewLoading) {
    setAmazonProductMiningReviewState("Loading reviews...", "loading");
    setAmazonProductMiningReviewTableVisible(false);
    setAmazonProductMiningReviewEmptyPanel("Loading persisted keyword review records from the backend.", false);
    const loadingRow = document.createElement("tr");
    const loadingCell = document.createElement("td");
    loadingCell.className = "loading-state";
    loadingCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    loadingCell.textContent = "Loading reviews...";
    loadingRow.append(loadingCell);
    rowsNode.append(loadingRow);
    return;
  }
  if (state.amazonProductMiningReviewError) {
    setAmazonProductMiningReviewState("Failed to load keyword reviews: " + state.amazonProductMiningReviewError, "error");
    setAmazonProductMiningReviewTableVisible(false);
    setAmazonProductMiningReviewEmptyPanel("Failed to load keyword reviews. Use Refresh after fixing the backend or task state.", false);
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    errorCell.className = "history-error-cell error-state";
    const message = document.createElement("span");
    message.textContent = "Failed to load keyword reviews: " + state.amazonProductMiningReviewError;
    const retry = document.createElement("button");
    retry.className = "btn secondary";
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => refreshAmazonProductMiningKeywordReviews().catch(() => undefined));
    errorCell.append(message, retry);
    errorRow.append(errorCell);
    rowsNode.append(errorRow);
    return;
  }
  const filtered = sortAmazonProductMiningReviews(filterAmazonProductMiningReviews(reviews));
  if (filtered.length === 0) {
    const emptyMessage = (reviews || []).length > 0
      ? "No keyword opportunity reviews match the current filters."
      : "No keyword opportunity reviews yet. Run an Amazon product mining task and complete AI keyword review to populate this table.";
    setAmazonProductMiningReviewState(emptyMessage, (reviews || []).length > 0 ? "manual-required" : "empty");
    setAmazonProductMiningReviewTableVisible(false);
    setAmazonProductMiningReviewEmptyPanel(emptyMessage, false);
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.className = "empty-state";
    emptyCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    emptyCell.textContent = emptyMessage;
    emptyRow.append(emptyCell);
    rowsNode.append(emptyRow);
    return;
  }
  setAmazonProductMiningReviewState("Showing " + filtered.length + " review rows.", "ready");
  setAmazonProductMiningReviewEmptyPanel("", true);
  setAmazonProductMiningReviewTableVisible(true);
  for (const review of filtered) rowsNode.append(renderAmazonProductMiningReviewRow(review));
};
const renderAmazonProductMiningReviews = (reviews) => renderAmazonProductMiningReviewTable(reviews);
const refreshAmazonProductMiningKeywordReviews = async () => {
  syncAmazonProductMiningReviewFiltersFromDom();
  const taskId = state.amazonProductMiningReviewFilters.taskId;
  const query = taskId ? "?taskId=" + encodeURIComponent(taskId) : "";
  state.amazonProductMiningReviewLoading = true;
  state.amazonProductMiningReviewError = "";
  renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
  try {
    const payload = await readJson("/api/amazon-product-mining/keyword-reviews" + query);
    state.amazonProductMiningReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    state.amazonProductMiningReviewLoading = false;
    renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
    writeActivity("keyword review history refreshed", "completed");
  } catch (error) {
    state.amazonProductMiningReviewLoading = false;
    state.amazonProductMiningReviewError = error.message;
    renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
    writeActivity("keyword review history refresh failed: " + error.message, "failed");
  }
};
const refreshAmazonProductMiningReviews = async () => refreshAmazonProductMiningKeywordReviews();
`;

export const renderAmazonProductMiningReviewClient = (): string => AMAZON_PRODUCT_MINING_REVIEW_CLIENT;
