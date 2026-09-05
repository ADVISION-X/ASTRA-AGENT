import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";
import { sha256 } from "../../mediator/product-plugin-contract.js";

const turn = Object.freeze({
  schemaVersion: "bazi-private-base-turn-contract.v1",
  profile: Object.freeze({
    profileRef: "bazi-private-base:gpt-5.6-sol-pro-standard",
    accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
    modelDisplayName: "GPT-5.6 Sol",
    modelFamily: "gpt-5.6",
    reasoningRequirement: Object.freeze({
      selectionPolicy: "exact-or-observed-maximum" as const,
      requestedTier: "pro_standard" as const,
    }),
    executorIdentityRef: "bazi-private-base-turn",
    acceptanceRef: "bazi-private-base:production",
    acceptanceVersion: "v1",
  }),
  markerNamespace: "BAZI-PRIVATE-BASE-V1",
  outputSchemaVersion: "bazi-base-interpretation-output-v2",
  prompt: [
    "你只执行八字私有基础解读，不生成用户正式报告。",
    "只读取 bazi_private_base_input；物理上不得接收问题、经历、订单、支付或 Product Skill。",
    "完整复核锁定命盘、候选集、派生事实、最终裁决、运势时序、完整 READY 古籍与索引及规则谱系。",
    "按附件 base_output_contract 返回一个 JSON 对象；基础判断只是后续正式回合的非约束 prior，必须保留不确定性和完整索引复核回执。",
  ].join("\n"),
});

export const localBaziPrivateBaseTurnBytes = JSON.stringify(turn);
export const localBaziPrivateBaseTurnHash = sha256(localBaziPrivateBaseTurnBytes);
const EXPECTED_PRIVATE_BASE_TURN_HASH = "sha256:83da2e426774bd269d40d202b5968609b031b465b6a3346a95190bd264b12e18";
if (localBaziPrivateBaseTurnHash !== EXPECTED_PRIVATE_BASE_TURN_HASH) {
  throw new Error("BAZI_PRIVATE_BASE_TURN_CONTRACT_DRIFT");
}
export const localBaziPrivateBaseTurn = Object.freeze({
  ...turn,
  profile: buildGptExecutionProfile(turn.profile),
  contractHash: localBaziPrivateBaseTurnHash,
});
