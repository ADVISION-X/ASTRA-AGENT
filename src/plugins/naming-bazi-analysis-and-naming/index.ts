import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "naming_analysis", profileRef: "naming-bazi-analysis-and-naming:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const namingBaziAnalysisAndNamingPlugin: ProductPlugin = {
  pluginId: "naming-bazi-analysis-and-naming",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "naming_bazi_analysis_and_naming", actionId: "produce" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "accuracy_challenge" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核原起名结果的命盘依据、字符事实与候选解释，只输出可核验 finding。", material_roles: ["subject_result", "review_context", "chart_material"], gpt_flow: freshGptTurnFlow, provider });
      return context.complete({ payload: { findings: finding.raw_text }, evidence_refs: combineEvidence(finding) });
    }
    const analysis = await context.runTurn({ step_id: "analyze_bazi_for_naming", instruction: "只为起名目的分析冻结八字的结构与取用方向，列出明确约束。", material_roles: ["chart_material", "frozen_subject", "corpus_material"], gpt_flow: freshGptTurnFlow, provider });
    const names = await context.runTurn({ step_id: "produce_names", instruction: "依据同一任务的起名约束、姓氏、语言和禁用条件生成候选并逐名解释；不得改变前一步命盘结论。", material_roles: ["naming_requirements", "character_reference"], gpt_flow: continuationGptTurnFlow, same_conversation_as: analysis, provider });
    return context.complete({ payload: { naming_analysis: analysis.raw_text, candidates: names.raw_text }, evidence_refs: combineEvidence(analysis, names), continuation: names.provider_continuation });
  },
};
