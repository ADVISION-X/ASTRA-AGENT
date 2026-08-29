const PRODUCTION_RUNTIME_CLIENT = `
const renderProductionAtomicSteps = (steps) => {
  const body = qs("[data-production-atomic-step-rows]");
  if (!body) return;
  body.innerHTML = "";
  const rows = Array.isArray(steps) ? steps : [];
  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "没有浏览器原子步骤";
    row.append(cell);
    body.append(row);
    return;
  }
  for (const step of rows) {
    const row = document.createElement("tr");
    row.dataset.productionAtomicCommandId = step.commandId;
    const locator = [step.authorityRef, step.authorityHash, step.terminalEventId || step.startedEventId]
      .filter(Boolean).join(" | ");
    for (const value of [
      step.pluginStepId, step.childCapabilityId, step.actionOrdinal, step.precondition,
      step.dispatch, step.postcondition, step.terminalState, locator,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value === undefined || value === null || value === "" ? "-" : String(value);
      row.append(cell);
    }
    row.title = step.failureCode || step.commandId;
    row.addEventListener("click", () => openInspector({
      kind: "browser atomic step",
      title: step.pluginStepId + " / " + step.childCapabilityId + " / " + step.actionOrdinal,
      payload: step,
    }));
    body.append(row);
  }
};
const refreshProductionTaskStatus = async () => {
  const form = qs("[data-production-runtime-form]");
  const jobId = form?.jobId?.value?.trim();
  if (!jobId) throw new Error("jobId is required");
  const payload = await readJson("/api/production-runtime/status?jobId=" + encodeURIComponent(jobId));
  setText("[data-production-task-status]", payload.status || "-");
  setText("[data-production-plugin-id]", payload.identity?.plugin_id || "-");
  setText("[data-production-plugin-version]", payload.identity?.plugin_version || "-");
  setText("[data-production-failure]", payload.current_reason || "-");
  renderProductionAtomicSteps(payload.atomic_steps);
  openInspector({ kind: "production task status", title: jobId, payload });
};
document.addEventListener("DOMContentLoaded", () => {
  qs("[data-production-status]")?.addEventListener("click", () => refreshProductionTaskStatus()
    .catch((error) => writeActivity("production status failed: " + error.message, "failed")));
});
`;

export const renderProductionRuntimeClient = (): string => PRODUCTION_RUNTIME_CLIENT;
