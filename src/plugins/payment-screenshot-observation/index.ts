import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "generic_ai", profileRef: "payment-screenshot-observation:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const paymentScreenshotObservationPlugin: ProductPlugin = {
  pluginId: "payment-screenshot-observation",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "payment_screenshot_observation", actionId: "observe" },
    { productId: "payment_screenshot_observation", actionId: "accuracy_challenge" },
    { productId: "payment_screenshot_observation", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "observe") {
      const review = await context.runTurn({
        step_id: task.action_id,
        instruction: "复核原付款截图观察是否逐项忠于可见像素、是否混入截图外推断、是否越权给出到账或订单裁决；只返回可核验 finding。",
        material_roles: ["subject_result", "review_context", "payment_screenshot", "expected_order_facts"],
        gpt_flow: freshGptTurnFlow,
        provider,
      });
      return context.complete({ payload: { findings: review.raw_text }, evidence_refs: combineEvidence(review) });
    }
    const turn = await context.runTurn({
      step_id: "observe_payment_screenshot",
      instruction: "只观察截图中可见的付款人、收款人、金额、币种、时间、状态、参考号和异常迹象；不可判定收款成功、不可批准订单、不可推断截图外事实。",
      material_roles: ["payment_screenshot", "expected_order_facts"],
      gpt_flow: freshGptTurnFlow,
      provider,
    });
    return context.complete({ payload: { observation: turn.raw_text, verdict: null }, evidence_refs: combineEvidence(turn) });
  },
};
