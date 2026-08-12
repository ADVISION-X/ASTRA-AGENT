import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionOrderSchema,
  type XuanxueAiProductionRuntime,
} from "../plugins/xuanxue-ai-production/index.js";

export const runXuanxueAiProductionRoute = (
  rawInput: unknown,
  runtime: XuanxueAiProductionRuntime,
) => createXuanxueAiProductionOrder(
  runtime,
  XuanxueAiProductionOrderSchema.parse(rawInput),
);
