import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "./result-contract.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "naming_analysis", profileRef: "naming-from-existing-bazi-report:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const namingFromExistingBaziReportPlugin: ProductPlugin = {
  pluginId: "naming-from-existing-bazi-report",
  pluginVersion: 3,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_from_existing_bazi_report", actionId: "produce" },
    { productId: "naming_from_existing_bazi_report", actionId: "accuracy_challenge" },
    { productId: "naming_from_existing_bazi_report", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "produce";
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "produce_names_from_report",
      instruction: review ? "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。" : "只依据 naming_context_package、naming_requirement_brief 与 naming_prior_feedback 生成候选；严格按 result_contract 返回 naming-report-output.v2 合法 JSON，不得重新计算或串用其他命盘，不要代码围栏、解释或额外字段。",
      material_roles: review ? ["subject_result", "review_context"] : ["naming_context_package", "naming_requirement_brief", "naming_prior_feedback", "result_contract"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
