import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { hashCanonical, sha256 } from "../../../src/mediator/product-plugin-contract.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "localization-production");
assert(plugin);
const sequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  if (route.product_id === "localization_static_catalog") continue;
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核本地化结果" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: {
      target_locale: "en-US",
      resource_kind: route.product_id === "localization_report_translation" ? "report" : "article",
      source_resource_id: "resource:1", source_version: "v1", source_sha256: FIXTURE_HASH,
      policy_version: "localization-policy.v1",
    } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version, action_id: route.product_id,
    source_resource_id: task.parameters.source_resource_id, source_version: task.parameters.source_version,
    source_sha256: task.parameters.source_sha256, target_locale: task.parameters.target_locale,
    localized_structured_payload: { title: "localized" },
  };
  const resultRevision = !review && route.product_id === "localization_report_translation"
    ? { revision: 1, priorRejection: {
        receipt_hash: FIXTURE_HASH, rejected_result_payload_hash: FIXTURE_HASH,
        reason_codes: ["RESULT_SETTLED_UNUSABLE"],
      } } as const
    : undefined;
  const run = await exerciseProductFlow(plugin, { task, output,
    ...(resultRevision ? { resultRevision } : {}) });
  assert.deepEqual(run.calls.map((call) => call.child), sequence);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.doesNotMatch(prompt, /Product Plugin|result_contract attachment/u);
  assert.match(prompt, /Website route result_contract/u);
  assert.match(prompt, /Website 结果修订事实/u);
  if (resultRevision) assert.match(prompt, /RESULT_SETTLED_UNUSABLE/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}

const staticRoute = productionRoutePolicies.find((route) => route.product_id === "localization_static_catalog"
  && route.action_id === "produce_locale_catalog");
assert(staticRoute);
const contextBundle = {
  schema_version: "target-language-context-bundle.v1",
  message_syntax: "typed-placeholder-v1",
  review_kind: "target_language_translation",
  locale: "en-US",
  source_locale: "zh-CN",
  source_catalog_hash: FIXTURE_HASH,
  batch_id: "en-US-batch-001",
  expression_policy_hash: sha256("{}"),
  expression_policy_json: "{}",
  terminology_hash: sha256("{}"),
  terminology_json: "{}",
  format_policy_hash: sha256("fixture-format-policy"),
  format_policy_source: "fixture-format-policy",
  message_items: [{
    message_id: "fixture.hello",
    semantic_owner: "fixture",
    surface_ref: "fixture:surface",
    surface_source_refs: ["fixture.ts:1"],
    copy_group_id: "fixture.hello",
    risk_class: "normal",
    audience: "site_visitor_or_customer",
    user_action: "read",
    user_outcome: "understand",
    surrounding_message_ids: [],
    control_role: "text",
    source_text: "<style>@page{size:A4}</style> 你好 {name}",
    source_hash: sha256("<style>@page{size:A4}</style> 你好 {name}"),
    existing_target_text: "<style>@page{size:A4}</style> Hello {name}",
    existing_target_hash: sha256("<style>@page{size:A4}</style> Hello {name}"),
    parameter_schema: ["name"],
    parameter_types: [{ name: "name", type: "string" }],
    protected_tokens: ["<style>", "{name}", "</style>"],
    max_graphemes: null,
    allow_wrapping: true,
    safety_owner_refs: [],
    legal_owner_refs: [],
    commercial_owner_refs: [],
  }],
} as const;
const contextBundleJson = JSON.stringify(contextBundle);
const contextBundleHash = sha256(contextBundleJson);
const staticInput = {
  schema_version: "localization-static-catalog-input.v1",
  target_locale: "en-US",
  source_resource_id: "website-fixed-copy-catalog",
  source_version: "fixture-v1",
  source_sha256: FIXTURE_HASH,
  policy_version: "target-language-review-v3-20260816",
  expected_message_count: 1,
  context_bundles: [{ batch_id: contextBundle.batch_id, context_bundle_json: contextBundleJson,
    context_bundle_hash: contextBundleHash, message_count: 1 }],
} as const;
const staticTask = buildProductTask(staticRoute, { parameters: {
  target_locale: staticInput.target_locale,
  source_resource_id: staticInput.source_resource_id,
  source_version: staticInput.source_version,
  source_sha256: staticInput.source_sha256,
  policy_version: staticInput.policy_version,
  result_schema_version: "localization-static-catalog-result.v2",
} });
const staticRun = await exerciseProductFlow(plugin, {
  task: staticTask,
  materialContents: { static_catalog_input: staticInput },
  output: {},
  expectedSessionCount: 3,
  checkpointOutput: (call) => call.productStepId.endsWith(":selector") ? {
    schema_version: "target-language-selector-output.v1",
    locale: "en-US",
    pass: "first",
    selections: [{
      message_id: "fixture.hello",
      selection: "identical",
      reason_code: "identical-byte-match",
    }],
  } : {
    schema_version: "target-language-candidate.v1",
    locale: "en-US",
    context_bundle_hash: contextBundleHash,
    items: [{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }],
  },
});
const staticReasoningCalls = staticRun.calls.filter(
  (call) => call.child === "ensure_gpt_reasoning_requirement",
);
assert.deepEqual(staticReasoningCalls.map((call) => ({
  productStepId: call.productStepId,
  profileRef: call.input.profile.profileRef,
  reasoningRequirement: call.input.profile.reasoningRequirement,
})), [
  {
    productStepId: "en-US-batch-001:candidate-a",
    profileRef: "localization-production:static-catalog:candidate-a:pro-standard",
    reasoningRequirement: {
      selectionPolicy: "exact-or-observed-maximum",
      requestedTier: "pro_standard",
    },
  },
  {
    productStepId: "en-US-batch-001:candidate-b",
    profileRef: "localization-production:static-catalog:candidate-b:high",
    reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  },
  {
    productStepId: "en-US-batch-001:selector",
    profileRef: "localization-production:static-catalog:selector:high",
    reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  },
]);
assert.equal(staticRun.physicalSubmitDispatches, 3);
const staticPayload = staticRun.completed.payload as Readonly<Record<string, unknown>>;
assert.equal(staticPayload.schema_version, "localization-static-catalog-result.v2");
assert.equal(staticPayload.decision, "production_approved");
assert.equal(Object.hasOwn(staticPayload, "cohort_results"), false);
assert.equal(staticPayload.selected_catalog_hash,
  hashCanonical([{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }]));
process.stdout.write("[ACCEPTANCE][localization-production] PASS\n");
