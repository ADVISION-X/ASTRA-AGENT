import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";
import { readProductSkill } from "../../lib/local-runtime/production/plugin.js";

export const PLUGIN_ID = "bazi-ai-full-analysis";
export const PRODUCT_INSTRUCTION =
  "围绕冻结主问题完成八字专项深度分析，覆盖全部问题单元并保留候选、不确定性、古籍证据与现实边界。";
export const skill = readProductSkill(import.meta.url);
export const productSkillHash = skill.hash;
export const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:gpt-5.6-sol-pro-standard`,
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:production`,
  acceptanceVersion: "v1",
});
