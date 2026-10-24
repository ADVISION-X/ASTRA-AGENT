const PRODUCTION_RUNTIME_CLIENT = `
const compactObservationValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? text.slice(0, 117) + "..." : text;
};
const renderProductionMatrixMessage = (message, tone) => {
  const body = qs("[data-production-observation-rows]");
  if (!body) return;
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 8;
  cell.className = tone === "error" ? "matrix-empty is-error" : "matrix-empty";
  cell.textContent = message;
  row.append(cell);
  body.replaceChildren(row);
};
const OBSERVATION_COLUMNS = [
  ["axis", "事实"], ["owner", "Owner"], ["value", "当前值"], ["reason", "原因"],
  ["time", "观察时间"], ["freshness", "新鲜度"], ["locator", "权威 / 证据"], ["completeness", "完整性"],
];
const createObservationCell = ([column, heading], value) => {
  const cell = document.createElement("td");
  cell.className = "cell-" + column;
  const label = document.createElement("span");
  label.className = "cell-label";
  label.textContent = heading;
  const text = value === undefined || value === null || value === "" ? "-" : String(value);
  let content = text;
  if (column === "completeness" && text !== "-") {
    content = document.createElement("span");
    content.className = "status-badge " + (text === "COMPLETE" ? "status-info" : "status-watch");
    content.textContent = text;
  } else if (column === "reason" && text !== "-") {
    content = document.createElement("span");
    content.className = "reason-chip";
    text.split("_").forEach((part, index) => {
      if (index > 0) content.append("_", document.createElement("wbr"));
      content.append(part);
    });
  } else if (column === "time" && text !== "-") {
    content = document.createElement("time");
    content.dateTime = text;
    const split = text.indexOf("T");
    if (split > 0) content.append(text.slice(0, split + 1), document.createElement("wbr"), text.slice(split + 1));
    else content.textContent = text;
  }
  cell.append(label, content);
  return cell;
};
const renderProductionObservationRows = (rows) => {
  const body = qs("[data-production-observation-rows]");
  if (!body) return;
  const observations = Array.isArray(rows) ? rows : [];
  if (observations.length === 0) {
    renderProductionMatrixMessage("没有可展示的权威事实", "empty");
    return;
  }
  body.innerHTML = "";
  for (const observation of observations) {
    const row = document.createElement("tr");
    const freshness = observation.freshness?.kind === "ttl"
      ? "ttl → " + observation.freshness.fresh_until
      : observation.freshness?.kind || "-";
    const locator = [observation.authority_ref, observation.evidence_ref].filter(Boolean).join(" | ");
    [
      observation.axis, observation.owner, compactObservationValue(observation.current_value),
      observation.reason_code, observation.observed_at, freshness, locator, observation.completeness,
    ].forEach((value, index) => row.append(createObservationCell(OBSERVATION_COLUMNS[index], value)));
    const select = () => {
      body.querySelectorAll("tr.is-selected").forEach((selected) => {
        selected.classList.remove("is-selected");
        selected.removeAttribute("aria-current");
      });
      row.classList.add("is-selected");
      row.setAttribute("aria-current", "true");
      openInspector({
        kind: "production authority fact",
        title: observation.axis + " / " + observation.owner,
        payload: observation,
      });
    };
    row.tabIndex = 0;
    row.dataset.selectable = "true";
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select();
    });
    body.append(row);
  }
};
const setProductionMetric = (selector, value, tone) => {
  setText(selector, value);
  const node = qs(selector);
  if (node) node.dataset.tone = value === "-" ? "unknown" : tone;
};
const refreshProductionTaskStatus = async () => {
  const form = qs("[data-production-runtime-form]");
  const jobId = form?.jobId?.value?.trim();
  const query = jobId ? "?jobId=" + encodeURIComponent(jobId) : "";
  const payload = await readJson("/api/production-runtime/operations-snapshot" + query);
  const completeness = payload.rows?.some((row) => row.completeness !== "COMPLETE")
    ? "DIAGNOSIS_INCOMPLETE" : "COMPLETE";
  setProductionMetric("[data-production-scope]", payload.scope?.status || "-", payload.scope?.status === "AMBIGUOUS_SCOPE" ? "warning" : "neutral");
  setProductionMetric("[data-production-selected-job]", payload.scope?.selected_job_id || "-", "neutral");
  setProductionMetric("[data-production-completeness]", completeness, completeness === "COMPLETE" ? "info" : "warning");
  setProductionMetric("[data-production-observed-at]", payload.observed_at || "-", "neutral");
  renderProductionObservationRows(payload.rows);
  if (payload.scope?.status === "AMBIGUOUS_SCOPE") {
    openInspector({ kind: "production scope", title: "请选择工单", payload: payload.scope });
  }
};
const runProductionStatusRefresh = async () => {
  const button = qs("[data-production-status]");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  try {
    await refreshProductionTaskStatus();
  } catch (error) {
    renderProductionMatrixMessage("读取生产权威失败：" + error.message, "error");
    writeActivity("production status failed: " + error.message, "failed");
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
};
document.addEventListener("DOMContentLoaded", () => {
  qs("[data-production-status]")?.addEventListener("click", () => runProductionStatusRefresh());
  qs("[data-production-runtime-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runProductionStatusRefresh();
  });
  runProductionStatusRefresh();
});
`;

export const renderProductionRuntimeClient = (): string => PRODUCTION_RUNTIME_CLIENT;
