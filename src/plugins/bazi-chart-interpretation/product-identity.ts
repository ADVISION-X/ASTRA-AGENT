import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";

export const PLUGIN_ID = "bazi-chart-interpretation";
export const PRODUCT_INSTRUCTION =
  "完整阅读本轮四部分命盘资料、全部联合条件和事实语义清单，完成全盘双层解释；遍历实际 READY 古籍完整索引并核相关原文。PDF 仅消费真实可选绑定，不作为前置；没有专项问题。按当前公开结果合同一次交正式 JSON。";
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:chatgpt-latest-reasoning-4`,
  startModelDisplayName: "最新",
  requestedReasoningValue: 4,
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
