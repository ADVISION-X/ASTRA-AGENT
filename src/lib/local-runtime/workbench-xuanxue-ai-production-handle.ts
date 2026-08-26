import { createXuanxueAiProductionWorkbenchOwner } from "../../plugins/xuanxue-ai-production/index.js";

export const buildXuanxueAiProductionHandle = (
  owner: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>,
) => ({
  readXuanxueAiProductionQuarantine: (orderId: string) =>
    owner.readQuarantinedOrderStatus(orderId),
  readXuanxueAiProductionStatus: (orderId: string) =>
    owner.readOrderStatus(orderId),
});
