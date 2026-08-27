import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "../product-result-contract.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "generic_ai", profileRef: "payment-screenshot-observation:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation",
  pluginVersion: 2,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
    { productId: "payment_screenshot_observation", actionId: "accuracy_challenge" },
    { productId: "payment_screenshot_observation", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "observe") {
      const review = await context.runTurn({
        step_id: task.action_id,
        instruction: "复核冻结的 subject_result 与 review_context 是否忠于可见像素、是否混入截图外推断、是否越权给出到账或订单裁决；只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。",
        material_roles: ["subject_result", "review_context"],
        gpt_flow: freshGptTurnFlow,
        provider,
      });
      return context.complete({ payload: parseRouteResult(task, review.raw_text), evidence_refs: combineEvidence(review) });
    }
    const turn = await context.runTurn({
      step_id: "observe_payment_screenshot",
      instruction: "只观察截图中可见信息，不可判定实际到账、不可批准订单、不可推断截图外事实。严格按 result_contract 返回 payment-screenshot-observation-v1 JSON：schema_version、page_kind、payment_app、success_visible、visible_amount_minor_units、reason_code，不要代码围栏、解释或额外字段。",
      material_roles: ["payment_screenshot", "result_contract"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn) });
  },
};
