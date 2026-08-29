import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const hehunReportFollowupPlugin: ProductPlugin = {
  pluginId: "hehun-report-followup", pluginVersion: 6, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "hehun_report_followup", actionId: "followup" },
    { productId: "hehun_report_followup", actionId: "accuracy_challenge" },
    { productId: "hehun_report_followup", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:hehun-report-followup:${task.action_id}`);
  },
};
