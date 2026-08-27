import { combineEvidence, parsePluginJsonObject, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "hehun_analysis", profileRef: "hehun-report-followup:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const hehunReportFollowupPlugin: ProductPlugin = {
  pluginId: "hehun-report-followup",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "hehun_report_followup", actionId: "followup" },
    { productId: "hehun_report_followup", actionId: "accuracy_challenge" },
    { productId: "hehun_report_followup", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "followup";
    if (!review && !task.continuation_ref) throw new Error("HEHUN_FOLLOWUP_CONTINUATION_REQUIRED");
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "answer_followup",
      instruction: review ? "复核原合婚续问，只返回可核验 finding。" : "在已授权的原合婚会话中回答续问，保持甲乙身份和原报告不变。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段。",
      material_roles: review ? ["subject_result", "review_context"] : ["hehun_followup_input", "result_contract"],
      gpt_flow: review ? freshGptTurnFlow : continuationGptTurnFlow,
      use_task_continuation: !review,
      continuation_source_plugin_ids: ["hehun-ai-analysis", "hehun-report-followup"],
      provider,
    });
    return context.complete({ payload: review ? { findings: turn.raw_text } : parsePluginJsonObject(turn.raw_text, "HEHUN_FOLLOWUP_RESULT"), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
