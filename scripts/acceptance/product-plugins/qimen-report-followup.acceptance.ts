import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { readFileSync } from "node:fs";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "qimen-report-followup");
assert(plugin);
const skillText = readFileSync(new URL("../../../src/plugins/qimen-report-followup/SKILL.md", import.meta.url), "utf8");
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
const followupSequence = [
  "prepare_clean_gpt_chat",
  "open_gpt_execution_profile", "open_gpt_model_selector_v3", "select_gpt_model_from_start_v3",
  "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile", "open_gpt_attachment_control",
  "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", "write_exact_gpt_prompt",
  "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核奇门追问" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, parent_report_ref: "report:parent", parent_raw_output_hash: FIXTURE_HASH, question_snapshot: "new question" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    answer_blocks: [{ block_id: "block:1", reasoning_kind: "synthesis", candidate_scope: "all",
      semantic_anchor_refs: ["anchor:1"], evidence_refs: ["citation:1"], citation_ids: ["citation:1"],
      question_unit_refs: ["question-unit:1"], professional_markdown: "专业层", reader_explanation_markdown: "读者层" }],
    parent_report_ref: task.parameters.parent_report_ref, parent_raw_output_hash: task.parameters.parent_raw_output_hash,
    new_question_snapshot: { question_ref: "question:1", original_text: "现在怎样推进？", unit_refs: ["question-unit:1"] },
    index_review_receipts: [{ book_id: "book:1", index_hash: FIXTURE_HASH, macro_entry_count: 1,
      navigation_node_count: 1, semantic_entry_count: 1, review_status: "complete", applicability_note: "已审阅" }],
    covered_question_unit_refs: ["question-unit:1"], covered_candidate_refs: ["candidate:1"],
    citations: [{ citation_id: "citation:1", source_kind: "user_input", evidence_relation: "limits",
      candidate_refs: [], source_ref: "question:1", locator: "question-unit:1", title: "问题", quote: "现在怎样推进？",
      source_identity_hashes: { question_snapshot_hash: FIXTURE_HASH } }],
    uncertainties: [], limitations: [], safety_notes: ["不替代现实专业服务。"],
  };
  const run = await exerciseProductFlow(plugin, { task, output, productSkillText: skillText });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output, productSkillText: skillText });
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "qimen-report-followup:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), review ? reviewSequence : followupSequence);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.match(prompt, /当前 Product Plugin：qimen-report-followup/u);
  assert.match(prompt, /不得读取、恢复、续接或依赖父任务的 Provider conversation、checkpoint/u);
  assert.match(prompt, /只回答本次新问题/u);
  assert.match(prompt, /parent report\/result identity/u);
  assert.match(prompt, /rule evaluation matrix/u);
  assert.match(prompt, /anchor manifest/u);
  assert.match(prompt, /全部 READY books\/receipt denominator/u);
  assert.match(prompt, /博彩、投注、加杠杆或借贷下注/u);
  assert.match(prompt, /未成年人/u);
  assert.match(prompt, /自伤、伤人/u);
  assert.match(prompt, /`safety_notes` 必须逐项写明/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][qimen-report-followup] PASS\n");
