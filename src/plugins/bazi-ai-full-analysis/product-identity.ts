import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";

export const PLUGIN_ID = "bazi-ai-full-analysis";
export const PRODUCT_INSTRUCTION =
  "读取本轮已入场的完整父报告，围绕冻结主问题完成八字专项深度分析，覆盖全部问题单元并保留候选、不确定性、古籍证据与现实边界。";
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:chatgpt-latest-reasoning-4`,
  startModelDisplayName: "最新",
  requestedReasoningValue: 4,
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
