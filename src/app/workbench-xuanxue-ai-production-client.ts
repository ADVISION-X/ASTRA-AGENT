const XUANXUE_AI_PRODUCTION_CLIENT = `
const readXuanxueInterventionForm = () => {
  const form = qs("[data-xuanxue-ai-production-form]");
  return {
    orderId: form.orderId.value.trim(),
    expectedRevision: Number(form.expectedRevision.value),
    reason: form.reason.value.trim(),
    requestId: form.requestId.value.trim(),
  };
};
const renderXuanxueAiProductionStatus = (payload) => {
  const intervention = payload?.intervention || payload;
  const order = payload?.order;
  setText("[data-xuanxue-state]", intervention?.state || "-");
  setText("[data-xuanxue-revision]", String(intervention?.revision ?? "-"));
  setText("[data-xuanxue-checkpoint]", intervention?.lastSafeCheckpoint || "-");
  setText("[data-xuanxue-order-status]", order?.status || "-");
  const revision = qs("[data-xuanxue-ai-production-form] [name=expectedRevision]");
  if (revision && Number.isInteger(intervention?.revision)) revision.value = String(intervention.revision);
  openInspector({ kind: "xuanxue whole-order status", title: intervention?.orderId || "玄学 AI 生产", payload });
};
const refreshXuanxueAiProductionStatus = async () => {
  const { orderId } = readXuanxueInterventionForm();
  if (!orderId) throw new Error("orderId is required");
  renderXuanxueAiProductionStatus(await readJson("/api/xuanxue-ai-production/status?orderId=" + encodeURIComponent(orderId)));
};
const invokeXuanxueAiProductionIntervention = async (action) => {
  const input = readXuanxueInterventionForm();
  renderXuanxueAiProductionStatus(await readJson("/api/xuanxue-ai-production/" + action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  writeActivity("xuanxue whole-order " + action + " accepted", "running");
};
document.addEventListener("DOMContentLoaded", () => {
  const bind = (selector, action) => qs(selector)?.addEventListener("click", () => action().catch((error) => writeActivity("xuanxue intervention failed: " + error.message, "failed")));
  bind("[data-xuanxue-status]", refreshXuanxueAiProductionStatus);
  bind("[data-xuanxue-pause]", () => invokeXuanxueAiProductionIntervention("pause"));
  bind("[data-xuanxue-cancel]", () => invokeXuanxueAiProductionIntervention("cancel"));
  bind("[data-xuanxue-takeover]", () => invokeXuanxueAiProductionIntervention("takeover"));
  bind("[data-xuanxue-resume]", () => invokeXuanxueAiProductionIntervention("resume"));
});
`;

export const renderXuanxueAiProductionClient = (): string =>
  XUANXUE_AI_PRODUCTION_CLIENT;
