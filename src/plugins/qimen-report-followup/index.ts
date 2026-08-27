import { combineEvidence, parsePluginJsonObject, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "qimen_analysis", profileRef: "qimen-report-followup:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const qimenReportFollowupPlugin: ProductPlugin = {
  pluginId: "qimen-report-followup",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
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
      instruction: review ? "复核原奇门续问结果，只返回可核验 finding。" : "在获准的原奇门会话和原盘局内回答续问；不得重新起局或切换到其他会话。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段。",
      material_roles: review ? ["subject_result", "review_context"] : ["qimen_followup_input", "result_contract"],
      gpt_flow: review ? freshGptTurnFlow : continuationGptTurnFlow,
      use_task_continuation: !review,
      continuation_source_plugin_ids: ["qimen-professional-answer", "qimen-report-followup"],
      provider,
    });
    return context.complete({ payload: review ? { findings: turn.raw_text } : parsePluginJsonObject(turn.raw_text, "QIMEN_FOLLOWUP_RESULT"), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
