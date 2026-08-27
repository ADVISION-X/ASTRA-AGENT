import { hashCanonical } from "../../lib/local-runtime/production/contracts.js";
import { combineEvidence, parsePluginJsonObject, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "hehun_analysis", profileRef: "hehun-ai-analysis:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

export const hehunAiAnalysisPlugin: ProductPlugin = {
  pluginId: "hehun-ai-analysis",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "hehun_ai_analysis", actionId: "produce" },
    { productId: "hehun_ai_analysis", actionId: "accuracy_challenge" },
    { productId: "hehun_ai_analysis", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核原合婚报告的双方事实、比较方法和合并结论，只输出可核验 finding。", material_roles: ["subject_result", "review_context", "hehun_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
      return context.complete({ payload: { findings: finding.raw_text }, evidence_refs: combineEvidence(finding) });
    }
    const partyA = await context.runTurn({ step_id: "analyze_party_a", instruction: "只分析 hehun_input_bundle 中甲方冻结命盘与关系特征，保持与乙方分析隔离。", material_roles: ["hehun_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
    const partyB = await context.runTurn({ step_id: "analyze_party_b", instruction: "只分析 hehun_input_bundle 中乙方冻结命盘与关系特征，保持与甲方分析隔离。", material_roles: ["hehun_input_bundle"], gpt_flow: freshGptTurnFlow, provider });
    const final = await context.runTurn({ step_id: "synthesize_compatibility", instruction: `比较双方分析并形成合婚报告。甲方分析哈希：${partyA.raw_hash}；乙方分析哈希：${partyB.raw_hash}。不得交换人物身份。严格按 result_contract 返回模型负责的合法 JSON 对象，不要代码围栏、解释、privacy_source_proof 或额外字段。`, material_roles: ["hehun_input_bundle", "result_contract"], gpt_flow: continuationGptTurnFlow, same_conversation_as: partyB, provider });
    const output = parsePluginJsonObject(final.raw_text, "HEHUN_ANALYSIS_RESULT");
    const privacyStable = {
      schema_version: "hehun-privacy-source-proof.v1" as const,
      party_a_job_ref: `${task.job_id}:analyze_party_a`,
      party_a_raw_hash: partyA.raw_hash,
      party_b_job_ref: `${task.job_id}:analyze_party_b`,
      party_b_raw_hash: partyB.raw_hash,
      relationship_conversation_ref: final.provider_continuation?.prior_task_id ?? `${task.job_id}:synthesize_compatibility`,
      public_block_source: "final_relationship_raw_only" as const,
      private_output_public_leak_count: 0 as const,
    };
    return context.complete({ payload: { ...output, privacy_source_proof: { ...privacyStable, proof_hash: hashCanonical(privacyStable) } }, evidence_refs: combineEvidence(partyA, partyB, final), continuation: final.provider_continuation });
  },
};
