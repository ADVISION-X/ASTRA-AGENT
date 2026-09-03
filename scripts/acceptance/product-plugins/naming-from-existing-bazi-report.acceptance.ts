import assert from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/lib/local-runtime/production/catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "naming-from-existing-bazi-report");
assert(plugin);
const sequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "ensure_exact_gpt_reasoning_tier", "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核既有八字起名" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { project_ref: "project:1", context_package_ref: "context:1", requirement_manifest_ref: "requirement:1", requirement_manifest_hash: FIXTURE_HASH, output_contract_ref: "contract:1" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    requirement_manifest_ref: task.parameters.requirement_manifest_ref,
    requirement_manifest_hash: task.parameters.requirement_manifest_hash,
    naming_rationale: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    candidates: [{ name: "one" }],
    comparison_or_selection_rationale: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    uncertainties: [], limitations: [], safety_notes: [], covered_requirement_anchor_refs: ["requirement:1"],
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), sequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：naming-from-existing-bazi-report/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][naming-from-existing-bazi-report] PASS\n");
