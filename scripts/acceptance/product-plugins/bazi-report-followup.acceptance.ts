import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-report-followup");
assert(plugin);
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "open_gpt_execution_profile", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核八字追问" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: {
      analysis_kind: "report_followup", result_schema_version: route.result_schema_version,
      chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH, user_question: "请继续解释",
      parent_report_ref: "report:parent", parent_raw_output_hash: FIXTURE_HASH,
      current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
      consultation_root_ref: "source:bazi_chart_interpretation:produce",
      question_snapshot_ref: "question:1",
      question_snapshot_hash: FIXTURE_HASH,
    } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    answer_blocks: [{ section: "one" }],
    parent_report_ref: task.parameters.parent_report_ref, parent_raw_output_hash: task.parameters.parent_raw_output_hash,
    new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const flowFixture = {
    task,
    output,
    ...(!review ? { materialContents: {
      bazi_input_bundle: {
        schema_version: "bazi-ai-input-bundle-v6",
        parent_report: {
          parent_report_ref: task.parameters.parent_report_ref,
          parent_raw_output_hash: task.parent_result_hash,
          parent_terminal_output: { schema_version: "bazi-initial-question-answer-output.v1" },
        },
      },
      result_contract: route.result_contract,
    } } : {}),
  };
  const run = await exerciseProductFlow(plugin, flowFixture);
  await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：bazi-report-followup/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][bazi-report-followup] PASS\n");
