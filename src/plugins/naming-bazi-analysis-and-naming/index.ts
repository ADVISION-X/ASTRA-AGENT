import { combineEvidence, parsePluginJsonObject, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { assertRouteResultPayload, parseProductResult, parseRouteResult } from "../product-result-contract.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "naming_analysis", profileRef: "naming-bazi-analysis-and-naming:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const namingBaziAnalysisAndNamingPlugin: ProductPlugin = {
  pluginId: "naming-bazi-analysis-and-naming",
  pluginVersion: 2,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_bazi_analysis_and_naming", actionId: "produce" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "accuracy_challenge" },
    { productId: "naming_bazi_analysis_and_naming", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。", material_roles: ["subject_result", "review_context"], gpt_flow: freshGptTurnFlow, provider });
      return context.complete({ payload: parseRouteResult(task, finding.raw_text), evidence_refs: combineEvidence(finding) });
    }
    const analysis = await context.runTurn({ step_id: "analyze_bazi_for_naming", instruction: "只为起名目的分析 bazi_input_bundle 的冻结八字，严格返回 bazi-naming-basis-report-output.v1 合法 JSON，不要代码围栏、解释或额外字段。", material_roles: ["bazi_input_bundle", "naming_business_input", "result_contract"], gpt_flow: freshGptTurnFlow, provider });
    const names = await context.runTurn({ step_id: "produce_names", instruction: "依据同一任务的 naming_business_input 与前一步命盘约束生成候选，严格返回 naming-report-output.v2 合法 JSON，不得改变前一步命盘结论，不要代码围栏、解释或额外字段。", material_roles: ["bazi_input_bundle", "naming_business_input", "result_contract"], gpt_flow: continuationGptTurnFlow, same_conversation_as: analysis, provider });
    const payload = assertRouteResultPayload(task, {
      schema_version: "naming-bazi-analysis-and-naming-result.v1",
      bazi_analysis: parsePluginJsonObject(analysis.raw_text, "NAMING_BAZI_ANALYSIS_RESULT"),
      naming: parsePluginJsonObject(names.raw_text, "NAMING_RESULT"),
    });
    return context.complete({ payload, evidence_refs: combineEvidence(analysis, names), continuation: names.provider_continuation });
  },
};
