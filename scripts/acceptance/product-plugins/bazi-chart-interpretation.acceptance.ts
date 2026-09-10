import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-chart-interpretation");
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
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核八字解读" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const };
    const task = buildProductTask(route, review);
    const run = await exerciseProductFlow(plugin, { task, output: { decision: "no_issue", issues: [] } });
    assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
    continue;
  }
  const privateContract = route.result_contract?.private_base;
  assert(privateContract && typeof privateContract === "object" && !Array.isArray(privateContract));
  const providerVisible = {
    schema_version: "bazi-private-base-input.v1", owner_scope_hash: FIXTURE_HASH_B,
    privacy_subject_ref: "privacy-subject:1", stable_base_authorization_ref: "authorization:stable",
    interpretive_mode: "deep", chart_snapshot: { snapshot_hash: FIXTURE_HASH },
    preflight: { verdict: "READY", ready_book_set_hash: FIXTURE_HASH },
    material_lineage: { lineage_hash: FIXTURE_HASH, rule_catalog_hash: FIXTURE_HASH },
    chart_field_manifest: [{ field_path: "chart.day_master", value_hash: FIXTURE_HASH }],
    ready_books: [{ book_id: "book:1" }], ready_book_manifest: [{ book_id: "book:1", index_hash: FIXTURE_HASH }],
    base_output_contract: privateContract,
  };
  const task = buildProductTask(route, { privacySubjectRef: "privacy-subject:1", parameters: {
    analysis_kind: "chart_interpretation", result_schema_version: route.result_schema_version,
    chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH,
    current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
    bazi_pdf_semantic_manifest_ref: "manifest:1",
    bazi_pdf_semantic_manifest_hash: FIXTURE_HASH,
  } });
  const output = {
    schema_version: route.result_schema_version,
    report_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    interpretation_blocks: [{ section: "one" }], chart_ref: task.parameters.chart_ref,
    chart_version: task.parameters.chart_version, chart_hash: task.parameters.chart_hash,
    bazi_pdf_semantic_manifest_ref: "manifest:1", manifest_hash: FIXTURE_HASH,
    covered_semantic_anchor_refs: ["anchor:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  const run = await exerciseProductFlow(plugin, {
    task, output, materialContents: { bazi_private_base_input: providerVisible, result_contract: route.result_contract },
  });
  assert.equal(run.physicalSubmitDispatches, 1);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
}
process.stdout.write("[ACCEPTANCE][bazi-chart-interpretation] PASS\n");
