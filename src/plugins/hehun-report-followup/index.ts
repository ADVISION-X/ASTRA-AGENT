import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const hehunReportFollowupPlugin: ProductPlugin = {
  pluginId: "hehun-report-followup", pluginVersion: 8,
  accepts: [
    { productId: "hehun_report_followup", actionId: "followup" },
    { productId: "hehun_report_followup", actionId: "accuracy_challenge" },
    { productId: "hehun_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
