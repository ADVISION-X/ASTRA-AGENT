const PRODUCTION_RUNTIME_CLIENT = `
const compactObservationValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? text.slice(0, 117) + "..." : text;
};
const renderProductionObservationRows = (rows) => {
  const body = qs("[data-production-observation-rows]");
  if (!body) return;
  body.innerHTML = "";
  const observations = Array.isArray(rows) ? rows : [];
  if (observations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "没有可展示的权威事实";
    row.append(cell);
    body.append(row);
    return;
  }
  for (const observation of observations) {
    const row = document.createElement("tr");
    const freshness = observation.freshness?.kind === "ttl"
      ? "ttl → " + observation.freshness.fresh_until
      : observation.freshness?.kind || "-";
    const locator = [observation.authority_ref, observation.evidence_ref].filter(Boolean).join(" | ");
    for (const value of [
      observation.axis, observation.owner, compactObservationValue(observation.current_value),
      observation.reason_code, observation.observed_at, freshness, locator, observation.completeness,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value === undefined || value === null || value === "" ? "-" : String(value);
      row.append(cell);
    }
    row.addEventListener("click", () => openInspector({
      kind: "production authority fact",
      title: observation.axis + " / " + observation.owner,
      payload: observation,
    }));
    body.append(row);
  }
};
const refreshProductionTaskStatus = async () => {
  const form = qs("[data-production-runtime-form]");
  const jobId = form?.jobId?.value?.trim();
  const query = jobId ? "?jobId=" + encodeURIComponent(jobId) : "";
  const payload = await readJson("/api/production-runtime/operations-snapshot" + query);
  setText("[data-production-scope]", payload.scope?.status || "-");
  setText("[data-production-selected-job]", payload.scope?.selected_job_id || "-");
  setText("[data-production-completeness]", payload.rows?.some((row) => row.completeness !== "COMPLETE")
    ? "DIAGNOSIS_INCOMPLETE" : "COMPLETE");
  setText("[data-production-observed-at]", payload.observed_at || "-");
  renderProductionObservationRows(payload.rows);
  if (payload.scope?.status === "AMBIGUOUS_SCOPE") {
    openInspector({ kind: "production scope", title: "请选择工单", payload: payload.scope });
  }
};
document.addEventListener("DOMContentLoaded", () => {
  qs("[data-production-status]")?.addEventListener("click", () => refreshProductionTaskStatus()
    .catch((error) => writeActivity("production status failed: " + error.message, "failed")));
  refreshProductionTaskStatus().catch((error) => writeActivity("production status failed: " + error.message, "failed"));
});
`;

export const renderProductionRuntimeClient = (): string => PRODUCTION_RUNTIME_CLIENT;
