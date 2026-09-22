import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "hehun-ai-analysis");
assert(plugin);
const initial = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核合婚事实" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, case_manifest_ref: "case:1", case_manifest_hash: FIXTURE_HASH, question_snapshot: "question" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    relationship_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    relationship_blocks: [{ section: "one" }], case_manifest_ref: task.parameters.case_manifest_ref,
    case_manifest_hash: task.parameters.case_manifest_hash, question_snapshot: "question",
    covered_question_unit_refs: ["question:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), initial);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：hehun-ai-analysis/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][hehun-ai-analysis] PASS\n");
