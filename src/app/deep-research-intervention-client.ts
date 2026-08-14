export const renderDeepResearchInterventionClient = (): string => `
{
  const panel = document.querySelector('[data-plugin-intervention-owner="deep-research-analysis"]');
  if (panel) {
    const route = "/api/deep-research-analysis/intervention/";
    const taskId = () => panel.querySelector("[data-plugin-intervention-task-id]").value.trim();
    const show = (snapshot) => { const value = snapshot?.intervention ?? snapshot; panel.querySelector("[data-plugin-intervention-revision]").value = String(value?.revision ?? 0); panel.querySelector("[data-plugin-intervention-state]").textContent = value?.state ?? "not_found"; panel.querySelector("[data-plugin-intervention-result]").textContent = value ? "checkpoint=" + value.checkpoint + " · revision=" + value.revision + " · reason=" + (value.reason ?? "-") : "Job not found"; };
    const showFailure = (error) => { panel.querySelector("[data-plugin-intervention-result]").textContent = "Request failed: " + (error instanceof Error ? error.message : String(error)); };
    panel.querySelector("[data-plugin-intervention-read]").addEventListener("click", async () => { try { const response = await fetch(route + "status?taskId=" + encodeURIComponent(taskId())); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); show(payload); } catch (error) { showFailure(error); } });
    panel.querySelectorAll("[data-plugin-intervention-action]").forEach((button) => button.addEventListener("click", async () => { try { const response = await fetch(route + button.dataset.pluginInterventionAction, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: taskId(), expectedRevision: Number(panel.querySelector("[data-plugin-intervention-revision]").value), reason: panel.querySelector("[data-plugin-intervention-reason]").value.trim(), requestId: "workbench-" + crypto.randomUUID() }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); show(payload); } catch (error) { showFailure(error); } }));
  }
}
`;
