import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "qimen_analysis", profileRef: "qimen-report-followup:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const qimenReportFollowupPlugin: ProductPlugin = {
  pluginId: "qimen-report-followup",
  pluginVersion: 5,
  skillHash: skill.hash,
  checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "qimen_report_followup", actionId: "followup" },
    { productId: "qimen_report_followup", actionId: "accuracy_challenge" },
    { productId: "qimen_report_followup", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "followup";
    if (!review && !task.continuation_ref) throw new Error("QIMEN_FOLLOWUP_CONTINUATION_REQUIRED");
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "answer_followup",
      instruction: review ? "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。" : "在获准的原奇门会话和原盘局内回答续问；不得重新起局或切换到其他会话。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段。",
      material_roles: review ? ["subject_result", "review_context"] : ["qimen_followup_input", "result_contract"],
      use_task_continuation: !review,
      continuation_source_plugin_ids: ["qimen-professional-answer", "qimen-report-followup"],
      provider,
    });
    return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
