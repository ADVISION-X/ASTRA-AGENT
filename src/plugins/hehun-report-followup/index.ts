import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const hehunReportFollowupPlugin: ProductPlugin = {
  pluginId: "hehun-report-followup", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "hehun_report_followup", actionId: "followup" },
    { productId: "hehun_report_followup", actionId: "accuracy_challenge" },
    { productId: "hehun_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
