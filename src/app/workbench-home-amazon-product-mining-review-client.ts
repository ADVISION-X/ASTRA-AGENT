const AMAZON_PRODUCT_MINING_REVIEW_CLIENT = `
const REVIEW_TABLE_COLUMN_COUNT = 22;
const NOT_AVAILABLE = "not_available";
const REVIEW_DECISION_PRIORITY = {
  PASS: 0,
  WATCH: 1,
  INSUFFICIENT_DATA: 2,
  REJECT: 3,
};
const REVIEW_STRENGTH_PRIORITY = {
  strong: 0,
  medium: 1,
  weak: 2,
  insufficient: 3,
  not_available: 4,
};
const normalizeAmazonProductMiningReviewValue = (value) => {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return NOT_AVAILABLE;
  const trimmed = value.trim();
  return trimmed || NOT_AVAILABLE;
};
const normalizeAmazonProductMiningReviewText = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};
const appendCell = (row, text, className = "") => {
  const cell = document.createElement("td");
  cell.textContent = text || "-";
  if (className) cell.className = className;
  row.append(cell);
  return cell;
};
const createOpenButton = (label, filePath) => {
  const button = document.createElement("button");
  button.className = "btn secondary";
  button.type = "button";
  button.textContent = label;
  button.disabled = !filePath;
  button.addEventListener("click", () => {
    if (!filePath) return;
    window.open("file://" + encodeURI(filePath), "_blank", "noopener");
  });
  return button;
};
const setAmazonProductMiningReviewTaskFilter = (taskId) => {
  state.amazonProductMiningReviewFilters.taskId = taskId || "";
  setInputValue("[data-amazon-product-mining-review-task-filter]", state.amazonProductMiningReviewFilters.taskId);
};
const renderAmazonProductMiningSummary = (record) => {
  const taskId = typeof record.taskId === "string" && record.taskId
    ? record.taskId
    : state.amazonProductMiningTaskId || "-";
  const packageRef = record.packageZipPath || record.packageJsonPath || record.pdfReportPath || record.evidenceIndexPath || "-";
  setText("[data-amazon-product-mining-task-id]", taskId);
  setText("[data-amazon-product-mining-status]", record.status || "-");
  setText("[data-amazon-product-mining-package]", packageRef);
  if (taskId && taskId !== "-") setAmazonProductMiningReviewTaskFilter(taskId);
};
const createReviewPill = (value, variant) => {
  const pill = document.createElement("span");
  const normalizedValue = normalizeAmazonProductMiningReviewValue(value);
  pill.className = "review-pill review-pill-" + variant + " review-pill-" + normalizedValue.toLowerCase();
  pill.textContent = normalizedValue;
  return pill;
};
const createReviewReferenceLine = (label, filePath) => {
  const line = document.createElement("div");
  line.className = "review-detail-ref-line";
  const name = document.createElement("strong");
  name.textContent = label;
  line.append(name);
  if (filePath) {
    line.append(createOpenButton("Open", filePath));
    const value = document.createElement("span");
    value.className = "muted review-detail-ref-value";
    value.textContent = filePath;
    line.append(value);
  } else {
    const missing = document.createElement("span");
    missing.className = "muted review-detail-ref-value";
    missing.textContent = NOT_AVAILABLE;
    line.append(missing);
  }
  return line;
};
const createAmazonProductMiningReviewListBlock = (title, items) => {
  const block = document.createElement("section");
  block.className = "review-detail-block";
  const heading = document.createElement("h3");
  heading.textContent = title;
  block.append(heading);
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = NOT_AVAILABLE;
    block.append(empty);
    return block;
  }
  const list = document.createElement("ul");
  list.className = "review-detail-list";
  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.append(listItem);
  }
  block.append(list);
  return block;
};
const createAmazonProductMiningReviewTextBlock = (title, text) => {
  const block = document.createElement("section");
  block.className = "review-detail-block";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement("p");
  body.className = "review-detail-copy";
  body.textContent = text || NOT_AVAILABLE;
  block.append(heading, body);
  return block;
};
const setAmazonProductMiningReviewState = (message, tone = "") => {
  const node = qs("[data-amazon-product-mining-review-state]");
  if (!node) return;
  node.textContent = message;
  node.className = ["history-state", tone].filter(Boolean).join(" ");
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
  const decisionNode = qs("[data-amazon-product-mining-review-filter]");
  const nextStepNode = qs("[data-amazon-product-mining-review-human-next-step-filter]");
  const confidenceNode = qs("[data-amazon-product-mining-review-data-confidence-filter]");
  const integrityNode = qs("[data-amazon-product-mining-review-package-integrity-filter]");
  const sortNode = qs("[data-amazon-product-mining-review-sort]");
  if (decisionNode) decisionNode.value = state.amazonProductMiningReviewFilters.decision;
  if (nextStepNode) nextStepNode.value = state.amazonProductMiningReviewFilters.humanNextStep;
  if (confidenceNode) confidenceNode.value = state.amazonProductMiningReviewFilters.dataConfidence;
  if (integrityNode) integrityNode.value = state.amazonProductMiningReviewFilters.packageIntegrity;
  if (sortNode) sortNode.value = state.amazonProductMiningReviewFilters.sort;
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
const renderAmazonProductMiningReviewDetail = (review) => {
  const detailRow = document.createElement("tr");
  detailRow.className = "review-detail-row";
  const detailCell = document.createElement("td");
  detailCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
  const detailGrid = document.createElement("div");
  detailGrid.className = "review-detail-grid";
  detailGrid.append(
    createAmazonProductMiningReviewTextBlock("AI Review Summary", review.aiReviewSummary || NOT_AVAILABLE),
    createAmazonProductMiningReviewListBlock("Evidence Refs", review.evidenceRefs || []),
    createAmazonProductMiningReviewListBlock("Missing Evidence", review.missingEvidence || []),
    createAmazonProductMiningReviewListBlock("Risk Points", review.riskPoints || []),
  );
  const referenceBlock = document.createElement("section");
  referenceBlock.className = "review-detail-block review-detail-block-wide";
  const heading = document.createElement("h3");
  heading.textContent = "Reference Refs";
  referenceBlock.append(heading);
  referenceBlock.append(
    createReviewReferenceLine("Package Ref", review.packageRef || null),
    createReviewReferenceLine("AI Raw Response Ref", review.aiRawResponseRef || null),
    createReviewReferenceLine("Master Evidence Report Ref", review.masterEvidenceReportRef || null),
    createReviewReferenceLine("Data Completeness Report Ref", review.dataCompletenessReportRef || null),
    createReviewReferenceLine("Package Integrity Report Ref", review.packageIntegrityReportRef || null),
    createReviewReferenceLine("Exception Summary Ref", review.exceptionSummaryRef || null),
    createReviewReferenceLine("Open Evidence Index", review.evidenceIndexRef || null),
  );
  detailGrid.append(referenceBlock);
  detailCell.append(detailGrid);
  detailRow.append(detailCell);
  return detailRow;
};
const renderAmazonProductMiningReviewRow = (review) => {
  const fragment = document.createDocumentFragment();
  const row = document.createElement("tr");
  row.className = "review-row";
  appendCell(row, review.createdAt || "-");
  appendCell(row, review.taskId || "-");
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.marketplace));
  appendCell(row, normalizeAmazonProductMiningReviewValue(review.targetMarket));
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
  const packageCell = document.createElement("td");
  packageCell.append(createOpenButton("Open Package", review.packageRef || null));
  row.append(packageCell);
  const reviewCell = document.createElement("td");
  reviewCell.append(createOpenButton("Open AI Review", review.aiReviewRef || null));
  row.append(reviewCell);
  appendCell(row, review.reasonEvidenceSummary || NOT_AVAILABLE, "review-summary-cell");
  const detailCell = document.createElement("td");
  const detailButton = document.createElement("button");
  detailButton.className = "btn secondary";
  detailButton.type = "button";
  detailButton.dataset.amazonProductMiningReviewExpand = review.reviewId;
  detailButton.textContent = state.amazonProductMiningExpandedReviewId === review.reviewId ? "Hide Details" : "View Details";
  detailButton.addEventListener("click", () => {
    state.amazonProductMiningExpandedReviewId = state.amazonProductMiningExpandedReviewId === review.reviewId ? "" : review.reviewId;
    renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
  });
  detailCell.append(detailButton);
  row.append(detailCell);
  fragment.append(row);
  if (state.amazonProductMiningExpandedReviewId === review.reviewId) {
    fragment.append(renderAmazonProductMiningReviewDetail(review));
  }
  return fragment;
};
const renderAmazonProductMiningReviewTable = (reviews) => {
  const rowsNode = qs("[data-amazon-product-mining-review-rows]");
  if (!rowsNode) return;
  renderAmazonProductMiningReviewFilters(reviews);
  rowsNode.innerHTML = "";
  if (state.amazonProductMiningReviewLoading) {
    setAmazonProductMiningReviewState("Loading reviews...", "warn");
    const loadingRow = document.createElement("tr");
    const loadingCell = document.createElement("td");
    loadingCell.className = "muted";
    loadingCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    loadingCell.textContent = "Loading reviews...";
    loadingRow.append(loadingCell);
    rowsNode.append(loadingRow);
    return;
  }
  if (state.amazonProductMiningReviewError) {
    setAmazonProductMiningReviewState("Failed to load keyword reviews: " + state.amazonProductMiningReviewError, "bad");
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    errorCell.className = "history-error-cell";
    const message = document.createElement("span");
    message.textContent = "Failed to load keyword reviews: " + state.amazonProductMiningReviewError;
    const retry = document.createElement("button");
    retry.className = "btn secondary";
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => {
      refreshAmazonProductMiningKeywordReviews().catch(() => undefined);
    });
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
    setAmazonProductMiningReviewState(emptyMessage, (reviews || []).length > 0 ? "warn" : "");
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.className = "muted";
    emptyCell.colSpan = REVIEW_TABLE_COLUMN_COUNT;
    emptyCell.textContent = emptyMessage;
    emptyRow.append(emptyCell);
    rowsNode.append(emptyRow);
    return;
  }
  setAmazonProductMiningReviewState("Showing " + filtered.length + " review rows.", "ok");
  for (const review of filtered) {
    rowsNode.append(renderAmazonProductMiningReviewRow(review));
  }
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
    state.amazonProductMiningExpandedReviewId = "";
    renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
    writeActivity("amazon product mining review history refreshed", "ok");
  } catch (error) {
    state.amazonProductMiningReviewLoading = false;
    state.amazonProductMiningReviewError = error.message;
    renderAmazonProductMiningReviewTable(state.amazonProductMiningReviews);
    writeActivity("amazon product mining reviews refresh failed: " + error.message, "bad");
  }
};
const refreshAmazonProductMiningReviews = async () => refreshAmazonProductMiningKeywordReviews();
`;

export const renderAmazonProductMiningReviewClient = (): string => AMAZON_PRODUCT_MINING_REVIEW_CLIENT;