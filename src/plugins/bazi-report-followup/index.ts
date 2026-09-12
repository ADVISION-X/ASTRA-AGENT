import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const baziReportFollowupPlugin: ProductPlugin = {
  pluginId: "bazi-report-followup",
  accepts: [
    { productId: "bazi_report_followup", actionId: "followup" },
    { productId: "bazi_report_followup", actionId: "accuracy_challenge" },
    { productId: "bazi_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
