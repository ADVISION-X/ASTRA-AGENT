import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";

export const qimenReportFollowupPlugin: ProductPlugin = {
  pluginId: "qimen-report-followup", pluginVersion: 8, checkpointSchemaVersion: 2,
  accepts: [
    { productId: "qimen_report_followup", actionId: "followup" },
    { productId: "qimen_report_followup", actionId: "accuracy_challenge" },
    { productId: "qimen_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
