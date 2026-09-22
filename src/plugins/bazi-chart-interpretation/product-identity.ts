import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";

export const PLUGIN_ID = "bazi-chart-interpretation";
export const PRODUCT_INSTRUCTION =
  "围绕锁定命盘完成全盘正式解读，覆盖候选范围、命盘语义对象、古籍证据、条件、反证与现实边界。";
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:gpt-5.6-sol-pro-standard`,
  startModelDisplayName: "GPT-5.6 Sol",
  startReasoningTier: "pro_standard",
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
