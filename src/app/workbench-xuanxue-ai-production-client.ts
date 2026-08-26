const XUANXUE_AI_PRODUCTION_CLIENT = `
const readXuanxueStatusForm = () => {
  const form = qs("[data-xuanxue-ai-production-form]");
  return { orderId: form.orderId.value.trim() };
};
const renderXuanxueAiProductionStatus = (payload) => {
  const control = payload?.controlIntent || payload;
  const order = payload?.order;
  const quarantine = payload?.quarantine;
  setText("[data-xuanxue-state]", quarantine?.state || control?.intent || "-");
  setText("[data-xuanxue-revision]", String(control?.controlEpoch ?? "-"));
  setText("[data-xuanxue-checkpoint]", control?.lastSafeCheckpoint || "-");
  setText("[data-xuanxue-order-status]", order?.status || "-");
  openInspector({ kind: "xuanxue whole-order status", title: control?.orderId || "玄学 AI 生产", payload });
};
const refreshXuanxueAiProductionStatus = async () => {
  const { orderId } = readXuanxueStatusForm();
  if (!orderId) throw new Error("orderId is required");
  renderXuanxueAiProductionStatus(await readJson("/api/xuanxue-ai-production/status?orderId=" + encodeURIComponent(orderId)));
};
document.addEventListener("DOMContentLoaded", () => {
  const bind = (selector, action) => qs(selector)?.addEventListener("click", () => action().catch((error) => writeActivity("xuanxue status failed: " + error.message, "failed")));
  bind("[data-xuanxue-status]", refreshXuanxueAiProductionStatus);
});
`;

export const renderXuanxueAiProductionClient = (): string =>
  XUANXUE_AI_PRODUCTION_CLIENT;
