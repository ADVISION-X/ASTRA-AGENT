import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "qimen-professional-answer");
assert(plugin);
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
    answer_blocks: [{ section: "one" }], question_snapshot: "question",
    index_review_receipts: [{ index: "one" }], covered_question_unit_refs: ["question:1"],
    covered_candidate_refs: ["candidate:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), initial);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：qimen-professional-answer/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][qimen-professional-answer] PASS\n");
