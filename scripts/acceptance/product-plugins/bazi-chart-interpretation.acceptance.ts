import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { parseProductResult } from "../../../src/plugins/bazi-chart-interpretation/result-contract.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-chart-interpretation");
assert(plugin);
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
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
    const flowFixture = { task, output: { decision: "no_issue", issues: [] } };
    const run = await exerciseProductFlow(plugin, flowFixture);
    await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
    const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
    const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
    assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
      startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
      requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
      profileRef: "bazi-chart-interpretation:chatgpt-latest-reasoning-4",
      startModelDisplayName: "最新", requestedReasoningValue: 4,
    });
    assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
    assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
    continue;
  }
  const task = buildProductTask(route, { privacySubjectRef: "privacy-subject:1", parameters: {
    analysis_kind: "chart_interpretation", result_schema_version: route.result_schema_version,
    chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH,
    current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
    consultation_root_ref: "source:bazi_chart_interpretation:produce",
    bazi_pdf_semantic_manifest_ref: "manifest:1",
    bazi_pdf_semantic_manifest_hash: FIXTURE_HASH,
  } });
  const output = {
    schema_version: route.result_schema_version,
    report_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    interpretation_blocks: [{ block_id: "one", professional_markdown: "# 自主标题\n专业层", reader_explanation_markdown: "# 自主标题\n读者层", semantic_anchor_refs: ["anchor:1"], candidate_scope: "all", evidence_refs: [], citation_ids: [] }], chart_ref: task.parameters.chart_ref,
    chart_version: task.parameters.chart_version, chart_hash: task.parameters.chart_hash,
    bazi_pdf_semantic_manifest_ref: "manifest:1", manifest_hash: FIXTURE_HASH,
    covered_semantic_anchor_refs: ["anchor:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  assert.deepEqual(parseProductResult(task, output, route), output);
  assert.throws(() => parseProductResult(task, { ...output, runtime_metadata: "private" }, route), /RESULT_FIELDS_INVALID/u);
  assert.throws(() => parseProductResult(task, { ...output, interpretation_blocks: [{ ...output.interpretation_blocks[0], title: "额外字段" }] }, route), /BLOCK_FIELDS_INVALID/u);
  assert.throws(() => parseProductResult(task, { ...output, covered_semantic_anchor_refs: ["anchor:other"] }, route), /COVERAGE_INVALID/u);
  const repeated = { ...output, interpretation_blocks: [...output.interpretation_blocks, { ...output.interpretation_blocks[0], block_id: "two", professional_markdown: "# 交叉综合\n同一命盘对象可再次参与综合解释。" }] };
  assert.equal((parseProductResult(task, repeated, route).interpretation_blocks as unknown[]).length, 2);
  const flowFixture = {
    task, output, materialContents: { bazi_formal_input: { schema_version: "bazi-formal-input.v3" },
      result_contract: route.result_contract },
  };
  const run = await exerciseProductFlow(plugin, flowFixture);
  await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
  assert.equal(run.physicalSubmitDispatches, 1);
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "bazi-chart-interpretation:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
}
process.stdout.write("[ACCEPTANCE][bazi-chart-interpretation] PASS\n");
