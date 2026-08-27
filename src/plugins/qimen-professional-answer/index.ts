import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "../product-result-contract.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "qimen_analysis", profileRef: "qimen-professional-answer:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const qimenProfessionalAnswerPlugin: ProductPlugin = {
  pluginId: "qimen-professional-answer",
  pluginVersion: 2,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "qimen_professional_answer", actionId: "produce" },
    { productId: "qimen_professional_answer", actionId: "accuracy_challenge" },
    { productId: "qimen_professional_answer", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id !== "produce";
    const turn = await context.runTurn({
      step_id: review ? task.action_id : "professional_answer",
      instruction: review ? "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。" : "依据 qimen_business_input 的冻结盘局、问事背景和资料作专业回答。严格按 result_contract 返回一个合法 JSON 对象，不要代码围栏、解释或额外字段；先核盘面事实，再给判断、条件与时效。",
      material_roles: review ? ["subject_result", "review_context"] : ["qimen_business_input", "result_contract"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn), ...(review ? {} : { continuation: turn.provider_continuation }) });
  },
};
