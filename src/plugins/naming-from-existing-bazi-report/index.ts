import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "naming_analysis", profileRef: "naming-from-existing-bazi-report:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const namingFromExistingBaziReportPlugin: ProductPlugin = {
  pluginId: "naming-from-existing-bazi-report",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "naming_from_existing_bazi_report", actionId: "produce" },
    { productId: "naming_from_existing_bazi_report", actionId: "accuracy_challenge" },
    { productId: "naming_from_existing_bazi_report", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "produce";
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "produce_names_from_report",
      instruction: review ? "复核原候选名与既有报告的绑定、字符事实和解释，只输出可核验 finding。" : "只依据这份已授权且哈希锁定的既有八字报告和当前起名要求生成候选；不得重新计算或串用其他命盘。",
      material_roles: review ? ["subject_result", "review_context", "existing_bazi_report"] : ["existing_bazi_report", "naming_requirements", "character_reference"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: review ? { findings: turn.raw_text } : { candidates: turn.raw_text }, evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
