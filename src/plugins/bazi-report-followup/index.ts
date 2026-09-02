import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const baziReportFollowupPlugin: ProductPlugin = {
  pluginId: "bazi-report-followup", pluginVersion: 8, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_report_followup", actionId: "followup" },
    { productId: "bazi_report_followup", actionId: "accuracy_challenge" },
    { productId: "bazi_report_followup", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
