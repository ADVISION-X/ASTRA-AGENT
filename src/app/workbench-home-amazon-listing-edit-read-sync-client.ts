const LISTING_EDIT_READ_CLIENT_INPUT_AND_STATUS = `
const listingEditReadState = { taskId: "" };

const listingEditReadSelectedTabs = (form) =>
  Array.from(form.querySelectorAll("input[name='tabs']:checked")).map((input) => input.value);

const listingEditReadTarget = (form) => {
  const target = {};
  for (const key of ["asin", "sku", "parentAsin", "parentSku", "childAsin", "childSku"]) {
    const value = form[key]?.value?.trim();
    if (value) target[key] = value;
  }
  return target;
};

const listingEditReadPayload = (form) => {
  const payload = {
    site: form.site.value.trim(),
    requestId: form.requestId.value.trim(),
    marketplace: form.marketplace.value,
    safetyMode: form.safetyMode.value,
    scope: form.scope.value,
    targetMode: form.targetMode.value,
    target: listingEditReadTarget(form),
    requireParentChildProof: form.requireParentChildProof.checked,
    maxItems: Number(form.maxItems.value),
    stopOnFirstIssue: form.stopOnFirstIssue.checked,
    tabs: listingEditReadSelectedTabs(form),
  };
  const productType = form.productType.value.trim();
  if (productType) payload.productType = productType;
  return payload;
};

const listingEditReadSetStatus = (task) => {
  if (!task) return;
  listingEditReadState.taskId = task.taskId || listingEditReadState.taskId;
  setText("[data-listing-edit-read-title]", task.taskId || "Task");
  setText("[data-listing-edit-read-status]", task.status || "-");
  setText("[data-listing-edit-read-task-id]", task.taskId || "-");
  setText("[data-listing-edit-read-step]", task.reachedStep || "-");
  setText("[data-listing-edit-read-reason]", task.reason || "-");
  setText("[data-listing-edit-read-target-status]", task.targetResolution?.status || "-");
  setText("[data-listing-edit-read-candidate-count]", String(task.targetResolution?.candidateCount ?? 0));
  setText("[data-listing-edit-read-inventory-count]", String(task.inventoryItems?.length ?? 0));
  setText("[data-listing-edit-read-item-count]", String(task.items?.length ?? 0));
  setText("[data-listing-edit-read-auth]", task.diagnostic?.authGate || "none");
  setText("[data-listing-edit-read-form-state]", task.status || "idle");
  const raw = qs("[data-listing-edit-read-raw]");
  if (raw) raw.textContent = JSON.stringify(task, null, 2);
  renderLedger(task, { job: "amazon-listing-edit-read-sync" });
  listingEditReadRenderItems(task.items || []);
  listingEditReadRenderInventory(task.inventoryItems || []);
};

const listingEditReadRenderItems = (items) => {
  const body = qs("[data-listing-edit-read-items]");
  if (!body) return;
  body.innerHTML = "";
  if (!items.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan='6'>No rows</td>";
    body.append(row);
    return;
  }
  for (const item of items) {
    const row = document.createElement("tr");
    const tabSummary = (item.tabs || []).map((tab) => tab.tab + ":" + tab.status).join(", ");
    row.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td>";
    row.children[0].textContent = item.sku || "-";
    row.children[1].textContent = item.asin || "-";
    row.children[2].textContent = item.status || "-";
    row.children[3].textContent = item.fnsku || "-";
    row.children[4].textContent = tabSummary || "-";
    const action = document.createElement("button");
    action.className = "btn secondary compact-button";
    action.type = "button";
    action.textContent = "Detail";
    action.addEventListener("click", () => openInspector({ kind: "listing item", title: item.sku || item.asin || "Item", payload: item }));
    row.children[5].append(action);
    body.append(row);
  }
};
`;

const LISTING_EDIT_READ_CLIENT_RENDER_AND_EVENTS = `
const listingEditReadRenderInventory = (items) => {
  const body = qs("[data-listing-edit-read-inventory]");
  if (!body) return;
  body.innerHTML = "";
  if (!items.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td colspan='6'>No rows</td>";
    body.append(row);
    return;
  }
  for (const item of items) {
    const row = document.createElement("tr");
    row.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td>";
    row.children[0].textContent = item.rowKind || "-";
    row.children[1].textContent = item.sku || "-";
    row.children[2].textContent = item.asin || "-";
    row.children[3].textContent = item.parentSku || "-";
    row.children[4].textContent = item.parentAsin || "-";
    row.children[5].textContent = item.evidenceRef || "-";
    row.addEventListener("click", () => openInspector({ kind: "inventory row", title: item.sku || item.asin || "Inventory", payload: item }));
    body.append(row);
  }
};

const startListingEditReadSync = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = listingEditReadPayload(form);
  writeActivity("task started: amazon listing edit read", "running");
  const task = await readJson("/api/plugins/amazon-listing-edit-read-sync/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  listingEditReadSetStatus(task);
};

const refreshListingEditReadSync = async () => {
  if (!listingEditReadState.taskId) return refreshListingEditReadLatest();
  const task = await readJson("/api/plugins/amazon-listing-edit-read-sync/status/" + encodeURIComponent(listingEditReadState.taskId));
  listingEditReadSetStatus(task);
};

const refreshListingEditReadLatest = async () => {
  const payload = await readJson("/api/plugins/amazon-listing-edit-read-sync/latest");
  if (!payload.task) {
    writeActivity("amazon listing edit read latest task not found", "manual-required");
    return;
  }
  listingEditReadSetStatus(payload.task);
};

document.addEventListener("DOMContentLoaded", () => {
  qs("[data-listing-edit-read-form]")?.addEventListener("submit", startListingEditReadSync);
  qs("[data-listing-edit-read-latest]")?.addEventListener("click", refreshListingEditReadLatest);
  qs("[data-listing-edit-read-refresh]")?.addEventListener("click", refreshListingEditReadSync);
});
`;

export const renderAmazonListingEditReadSyncClient = (): string =>
  LISTING_EDIT_READ_CLIENT_INPUT_AND_STATUS + LISTING_EDIT_READ_CLIENT_RENDER_AND_EVENTS;
