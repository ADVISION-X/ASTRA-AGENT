import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/lib/local-runtime/production/catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "naming-bazi-analysis-and-naming");
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
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核起名结果" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: {
      analysis_kind: "chart_interpretation", result_schema_version: route.result_schema_version,
      chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH, user_question: "请分析并起名",
      naming_task_ref: "naming:1", naming_context_package_ref: "context:1",
      naming_context_package_hash: FIXTURE_HASH, naming_requirement_brief_ref: "brief:1",
      naming_requirement_brief_hash: FIXTURE_HASH_B,
    } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    bazi_analysis: {
      schema_version: "bazi-naming-basis-report-output.v1",
      report_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
      interpretation_blocks: [{ section: "one" }], chart_ref: task.parameters.chart_ref,
      chart_version: task.parameters.chart_version, chart_hash: task.parameters.chart_hash,
      bazi_pdf_semantic_manifest_ref: "manifest:1", manifest_hash: FIXTURE_HASH,
      naming_requirement_manifest_ref: "requirement:1", naming_requirement_manifest_hash: FIXTURE_HASH_B,
      covered_semantic_anchor_refs: ["anchor:1"], covered_requirement_anchor_refs: ["requirement:1"],
      citations: [], uncertainties: [], limitations: [], safety_notes: [],
    },
    naming: {
      schema_version: "naming-report-output.v2", requirement_manifest_ref: "requirement:1",
      requirement_manifest_hash: FIXTURE_HASH_B,
      naming_rationale: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
      candidates: [{ name: "one" }],
      comparison_or_selection_rationale: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
      uncertainties: [], limitations: [], safety_notes: [], covered_requirement_anchor_refs: ["requirement:1"],
    },
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), sequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：naming-bazi-analysis-and-naming/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][naming-bazi-analysis-and-naming] PASS\n");
