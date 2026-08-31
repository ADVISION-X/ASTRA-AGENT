import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const qimenReportFollowupPlugin: ProductPlugin = {
  pluginId: "qimen-report-followup", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "qimen_report_followup", actionId: "followup" },
    { productId: "qimen_report_followup", actionId: "accuracy_challenge" },
    { productId: "qimen_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
