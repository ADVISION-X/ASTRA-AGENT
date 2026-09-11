import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-ai-full-analysis");
assert(plugin);
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  if (route.relation_kind === "review") {
    const review = route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核八字问答" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const };
    const task = buildProductTask(route, review);
    const run = await exerciseProductFlow(plugin, { task, output: { decision: "no_issue", issues: [] } });
    assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
    continue;
  }
  const task = buildProductTask(route, { privacySubjectRef: "privacy-subject:1", parameters: {
    analysis_kind: "ai_full_analysis", result_schema_version: route.result_schema_version,
    chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH, user_question: "请完整分析",
    current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
    consultation_root_ref: "source:bazi_chart_interpretation:produce",
    question_snapshot_ref: "question:1", question_snapshot_hash: FIXTURE_HASH,
  } });
  const output = {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    answer_blocks: [{ section: "one" }], question_snapshot: "question",
    covered_question_unit_refs: ["question:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const run = await exerciseProductFlow(plugin, {
    task, output, materialContents: { bazi_formal_input: {
      schema_version: "bazi-formal-input.v1",
      parent_report: {
        parent_report_ref: "report:parent", parent_raw_output_hash: task.parent_result_hash,
        parent_terminal_output: { schema_version: "bazi-chart-interpretation-output.v4" },
      },
    },
      result_contract: route.result_contract },
  });
  assert.equal(run.physicalSubmitDispatches, 1);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
}
process.stdout.write("[ACCEPTANCE][bazi-ai-full-analysis] PASS\n");
