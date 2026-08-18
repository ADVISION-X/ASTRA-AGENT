import {
  createXuanxueAiProductionWorkbenchOwner,
  XuanxueAiInterventionRequestSchema,
} from "../../plugins/xuanxue-ai-production/index.js";

export const buildXuanxueAiProductionHandle = (
  owner: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>,
) => ({
  readXuanxueAiProductionStatus: (orderId: string) =>
    owner.readOrderStatus(orderId),
  pauseXuanxueAiProduction: (input: unknown) =>
    owner.requestIntervention("pause", XuanxueAiInterventionRequestSchema.parse(input)),
  cancelXuanxueAiProduction: (input: unknown) =>
    owner.requestIntervention("cancel", XuanxueAiInterventionRequestSchema.parse(input)),
  takeoverXuanxueAiProduction: (input: unknown) =>
    owner.requestIntervention("takeover", XuanxueAiInterventionRequestSchema.parse(input)),
  resumeXuanxueAiProduction: (input: unknown) =>
    owner.requestIntervention("resume", XuanxueAiInterventionRequestSchema.parse(input)),
});
