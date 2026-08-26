import { z } from "zod";

import { xuanxueLocalOrderNode } from "./xuanxue-ai-production-product-contracts.js";
import type { XuanxueAiStoredOrder } from "./xuanxue-ai-production.schema.js";

const issue = (
  context: z.RefinementCtx,
  message: string,
  path: Array<string | number>,
): void => context.addIssue({ code: z.ZodIssueCode.custom, message, path });

export const inspectXuanxueContinuationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  try {
    xuanxueLocalOrderNode(order);
  } catch (error) {
    issue(
      context,
      error instanceof Error ? error.message : "XUANXUE_PRODUCT_EXECUTION_LOCAL_ORDER_INVALID",
      ["materials"],
    );
  }
};

export const inspectXuanxueLocalizationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (order.serviceClass === "localization") {
    if (order.contractManifestHash === null
      || order.localizationRole === null
      || order.materials.length !== 1
      || order.joinParents.length !== 0) {
      issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_ORDER_INVALID", ["localizationRole"]);
    }
    return;
  }
  if (order.contractManifestHash !== null || order.localizationRole !== null) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_IDENTITY_FORBIDDEN", ["localizationRole"]);
  }
};
