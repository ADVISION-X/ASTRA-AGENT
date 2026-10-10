import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";

export const PLUGIN_ID = "bazi-chart-interpretation";
export const PRODUCT_INSTRUCTION =
  "依当前 Product Skill 读完两个冻结附件：对来源 PDF 的实际语义对象作完整双层伴读，再自主组织全盘综合、证据、候选条件与现实边界。机器身份仅复制到结构字段。同轮自查后一次提交正式 v4 JSON。";
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:chatgpt-latest-reasoning-4`,
  startModelDisplayName: "最新",
  requestedReasoningValue: 4,
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
