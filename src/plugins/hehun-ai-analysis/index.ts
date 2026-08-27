import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "../product-result-contract.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "hehun_analysis", profileRef: "hehun-ai-analysis:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const hehunAiAnalysisPlugin: ProductPlugin = {
  pluginId: "hehun-ai-analysis",
  pluginVersion: 2,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "hehun_ai_analysis", actionId: "produce" },
    { productId: "hehun_ai_analysis", actionId: "accuracy_challenge" },
    { productId: "hehun_ai_analysis", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。", material_roles: ["subject_result", "review_context"], gpt_flow: freshGptTurnFlow, provider });
      return context.complete({ payload: parseRouteResult(task, finding.raw_text), evidence_refs: combineEvidence(finding) });
    }
    const partyA = await context.runTurn({ step_id: "analyze_party_a", instruction: "只分析 hehun_input_bundle 中甲方冻结命盘与关系特征，保持与乙方分析隔离。", material_roles: ["hehun_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
    const partyB = await context.runTurn({ step_id: "analyze_party_b", instruction: "只分析 hehun_input_bundle 中乙方冻结命盘与关系特征，保持与甲方分析隔离。", material_roles: ["hehun_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
    const final = await context.runTurn({ step_id: "synthesize_compatibility", instruction: `比较双方分析并形成合婚报告。甲方分析哈希：${partyA.raw_hash}；乙方分析哈希：${partyB.raw_hash}。不得交换人物身份。严格按 result_contract 返回模型负责的合法 JSON 对象，不要代码围栏、解释、privacy_source_proof 或额外字段。`, material_roles: ["hehun_input_bundle", "result_contract"], gpt_flow: continuationGptTurnFlow, same_conversation_as: partyB, provider });
    return context.complete({ payload: parseRouteResult(task, final.raw_text), evidence_refs: combineEvidence(partyA, partyB, final), continuation: final.provider_continuation });
  },
};
