const PRODUCTION_RUNTIME_CLIENT = `
const refreshProductionTaskStatus = async () => {
  const form = qs("[data-production-runtime-form]");
  const jobId = form?.jobId?.value?.trim();
  if (!jobId) throw new Error("jobId is required");
  const payload = await readJson("/api/production-runtime/status?jobId=" + encodeURIComponent(jobId));
  setText("[data-production-task-status]", payload.status || "-");
  setText("[data-production-plugin-id]", payload.identity?.plugin_id || "-");
  setText("[data-production-plugin-version]", payload.identity?.plugin_version || "-");
  setText("[data-production-failure]", payload.failure_reason || "-");
  openInspector({ kind: "production task status", title: jobId, payload });
};
document.addEventListener("DOMContentLoaded", () => {
  qs("[data-production-status]")?.addEventListener("click", () => refreshProductionTaskStatus()
    .catch((error) => writeActivity("production status failed: " + error.message, "failed")));
});
`;

export const renderProductionRuntimeClient = (): string => PRODUCTION_RUNTIME_CLIENT;
