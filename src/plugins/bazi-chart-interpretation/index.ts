import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "./result-contract.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "bazi_analysis", profileRef: "bazi-chart-interpretation:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const baziChartInterpretationPlugin: ProductPlugin = {
  pluginId: "bazi-chart-interpretation",
  pluginVersion: 3,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "bazi_chart_interpretation", actionId: "produce" },
    { productId: "bazi_chart_interpretation", actionId: "accuracy_challenge" },
    { productId: "bazi_chart_interpretation", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "produce";
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "interpret_chart",
      instruction: review
        ? "复核冻结的 subject_result 与 review_context。只返回 website-agent-review-output.v1 的合法 JSON：decision 与 issues；issue 必须含 category、target_type、target_ref、observation、evidence_refs、impact、confidence、suggested_inspection，不改写网站裁决。"
        : "依据 bazi_input_bundle 的冻结事实完成命盘解读。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段；区分盘面事实、经典依据、推断和不确定性。",
      material_roles: review ? ["subject_result", "review_context"] : ["bazi_input_bundle", "result_contract"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
