import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { readFileSync } from "node:fs";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "qimen-professional-answer");
assert(plugin);
const skillText = readFileSync(new URL("../../../src/plugins/qimen-professional-answer/SKILL.md", import.meta.url), "utf8");
const initial = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核奇门事实" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, report_id: "report:1", chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    question_snapshot: { question_ref: "question:1", original_text: "是否继续合作？", unit_refs: ["question-unit:1"] },
    answer_blocks: [{ block_id: "block:1", reasoning_kind: "synthesis", candidate_scope: "all",
      semantic_anchor_refs: ["anchor:1"], evidence_refs: ["citation:1"], citation_ids: ["citation:1"],
      question_unit_refs: ["question-unit:1"], professional_markdown: "专业层", reader_explanation_markdown: "读者层" }],
    index_review_receipts: [{ book_id: "book:1", index_hash: FIXTURE_HASH, macro_entry_count: 1,
      navigation_node_count: 1, semantic_entry_count: 1, review_status: "complete", applicability_note: "已审阅" }],
    covered_question_unit_refs: ["question-unit:1"], covered_candidate_refs: ["candidate:1"],
    citations: [{ citation_id: "citation:1", source_kind: "user_input", evidence_relation: "limits",
      candidate_refs: [], source_ref: "question:1", locator: "question-unit:1", title: "问题", quote: "是否继续合作？",
      source_identity_hashes: { question_snapshot_hash: FIXTURE_HASH } }],
    uncertainties: [], limitations: [], safety_notes: ["不替代现实专业服务。"],
  };
  const run = await exerciseProductFlow(plugin, { task, output, productSkillText: skillText });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output, productSkillText: skillText });
  assert.deepEqual(run.calls.map((call) => call.child), initial);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.match(prompt, /当前 Product Plugin：qimen-professional-answer/u);
  assert.match(prompt, /question snapshot、全部 question unit、全部 candidate、anchor manifest、rule evaluation matrix 和全部 READY books\/receipt denominator/u);
  assert.match(prompt, /博彩、投注、加杠杆或借贷下注/u);
  assert.match(prompt, /未成年人/u);
  assert.match(prompt, /自伤、伤人/u);
  assert.match(prompt, /`safety_notes` 必须逐项写明/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][qimen-professional-answer] PASS\n");
