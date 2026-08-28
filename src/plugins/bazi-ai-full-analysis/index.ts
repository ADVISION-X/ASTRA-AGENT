import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "./result-contract.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "bazi_analysis", profileRef: "bazi-ai-full-analysis:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const baziAiFullAnalysisPlugin: ProductPlugin = {
  pluginId: "bazi-ai-full-analysis",
  pluginVersion: 3,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_ai_full_analysis", actionId: "produce" },
    { productId: "bazi_ai_full_analysis", actionId: "accuracy_challenge" },
    { productId: "bazi_ai_full_analysis", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核冻结的 subject_result 与 review_context。只返回 website-agent-review-output.v1 的合法 JSON：decision 与 issues；issue 必须含 category、target_type、target_ref、observation、evidence_refs、impact、confidence、suggested_inspection，不得改写网站裁决。", material_roles: ["subject_result", "review_context"], gpt_flow: freshGptTurnFlow, provider });
      return context.complete({ payload: parseRouteResult(task, finding.raw_text), evidence_refs: combineEvidence(finding) });
    }
    const analysis = await context.runTurn({ step_id: "analyze", instruction: "先依据 bazi_input_bundle 完成命盘结构、旺衰、格局、用忌与关键时间线的逐项分析，不急于写成报告。", material_roles: ["bazi_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
    const report = await context.runTurn({ step_id: "compose_report", instruction: "在同一会话中依据已完成分析写成正式报告。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段；保留证据层级和不确定性，不新增无依据事实。", material_roles: ["bazi_input_bundle", "result_contract"], gpt_flow: continuationGptTurnFlow, same_conversation_as: analysis, provider });
    return context.complete({ payload: parseRouteResult(task, report.raw_text), evidence_refs: combineEvidence(analysis, report), continuation: report.provider_continuation });
  },
};
