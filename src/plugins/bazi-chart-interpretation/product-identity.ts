import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";

export const PLUGIN_ID = "bazi-chart-interpretation";
export const PRODUCT_INSTRUCTION =
  "本次produce是无需专项问题、个人经历或父报告的独立全盘解读。按同根Product Skill，以完整获准事实和联合条件形成专业与白话同源的整体研究；全部古籍索引逐书完整读完，核心判断回读相关原文及上下文，不用索引标签或模型记忆代替依据。按当前route.result_contract一次交付完整正式JSON。";
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:chatgpt-latest-reasoning-4`,
  startModelDisplayName: "最新",
  requestedReasoningValue: 4,
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
