import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "hehun-report-followup");
assert(plugin);
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
] as const;
const followupSequence = [
  "acquire_gpt_continuation_lane", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
  "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
  "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile", "open_gpt_attachment_control",
  "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", "write_exact_gpt_prompt",
  "reconcile_gpt_draft", "submit_exact_gpt_turn_once", "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_text", "checkpoint_gpt_text_response", "advance_gpt_continuation_lane",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核合婚追问" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, thread_ref: "continuation:1", parent_report_ref: "report:parent", parent_raw_output_hash: FIXTURE_HASH, question_snapshot: "new question" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    answer_blocks: [{ section: "one" }], thread_ref: task.parameters.thread_ref,
    parent_report_ref: task.parameters.parent_report_ref, parent_raw_output_hash: task.parameters.parent_raw_output_hash,
    new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), review ? reviewSequence : followupSequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：hehun-report-followup/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][hehun-report-followup] PASS\n");
