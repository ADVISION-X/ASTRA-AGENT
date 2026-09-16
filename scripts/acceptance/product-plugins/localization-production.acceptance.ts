import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { hashCanonical, sha256 } from "../../../src/mediator/product-plugin-contract.js";
import { parseInput, parseSelector, SELECTOR_REASON_CODES } from "../../../src/plugins/localization-production/static-catalog-contract.js";
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
      source_resource_id: "resource:1", source_version: "v1", source_sha256: FIXTURE_HASH,
      policy_version: "localization-policy.v1",
    } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
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
  const articleTranslation = route.product_id === "localization_article_translation"
    && route.action_id === "article_translation";
  if (articleTranslation) assert.deepEqual(new Set(run.calls.map((call) => call.productStepId)),
    new Set(["article_synthesis"]), "article translation must continue the SEO article synthesis step");
  assert.deepEqual(run.calls.map((call) => call.child),
    articleTranslation ? sequence.slice(1) : sequence);
  const reasoningCall = run.calls.find((call) => call.child === "ensure_gpt_reasoning_requirement");
  assert(reasoningCall?.child === "ensure_gpt_reasoning_requirement");
  assert.deepEqual({
    profileRef: reasoningCall.input.profile.profileRef,
    accountCapabilityRef: reasoningCall.input.profile.accountCapabilityRef,
    modelDisplayName: reasoningCall.input.profile.modelDisplayName,
    modelFamily: reasoningCall.input.profile.modelFamily,
    reasoningRequirement: reasoningCall.input.profile.reasoningRequirement,
  }, articleTranslation ? {
    profileRef: "localization-production:article-translation:chatgpt-latest-extra-high",
    accountCapabilityRef: "openai-chatgpt:latest",
    modelDisplayName: "最新",
    modelFamily: "chatgpt-latest",
    reasoningRequirement: { selectionPolicy: "exact", requestedTier: "extra_high" },
  } : {
    profileRef: "localization-production:gpt-5.6-sol-pro-standard",
    accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
    modelDisplayName: "GPT-5.6 Sol",
    modelFamily: "gpt-5.6",
    reasoningRequirement: { selectionPolicy: "exact-or-observed-maximum", requestedTier: "pro_standard" },
  });
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.doesNotMatch(prompt, /Product Plugin|result_contract attachment/u);
  assert.match(prompt, /Website route result_contract/u);
  if (!review) {
    assert.match(prompt, /"output_schema_version":"terminal-localization-model-output\.v2"/u);
    assert.doesNotMatch(prompt, /localization-provider-output-request|"requested_fields":\[[^\]]*"action_id"/u);
    assert.equal(Object.hasOwn(run.completed.payload as object, "action_id"), false);
    assert.match(prompt, /可信来源.*确定事实.*核验依据.*当代用户问题/u);
    for (const requirement of [
      "translatable_json_pointers", "safety_json_pointers", "protected_json_pointers",
      "target_locale", "JSON 结构和事实不得变化", "只返回一个完整 JSON 对象",
    ]) assert.match(prompt, new RegExp(requirement, "u"));
  }
  assert.match(prompt, /Website 结果修订事实/u);
  assert.match(prompt, /Website 当前授权依据/u);
  assert.match(prompt, new RegExp(task.business_identity.authorization_ref, "u"));
  if (resultRevision) assert.match(prompt, /RESULT_SETTLED_UNUSABLE/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}

const staticRoute = productionRoutePolicies.find((route) => route.product_id === "localization_static_catalog"
  && route.action_id === "produce_locale_catalog");
assert(staticRoute);
const contextBundle = {
  schema_version: "target-language-context-bundle.v2",
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
  public_value_binding: {
    schema_version: "target-language-public-value-binding.v1",
    authority_refs: ["LAW-PROJECT-GOVERNANCE-010-V1", "LAW-USER-VALUE-INTERFACE-001-V4"],
    authority_hashes: [
      "sha256:79f430599798e5bb10d73dd70cd32dfa1b4254709a99f32c363e82b06679fbd3",
      "sha256:b9e9f7f3af6fc703577c07906e1c096bb091995d29f3356af44b976258b0d6f1",
    ],
    canonical_approval_ref: `content/zh-CN/locales/messages.json#production-approved-${FIXTURE_HASH}`,
    source_owner_refs: ["fixture"],
    visible_evidence_refs: ["fixture:surface"],
    tool_role: "not_present",
  },
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
  policy_version: "target-language-review-v4-20260914",
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
const missingBindingContext = { ...contextBundle } as Record<string, unknown>;
delete missingBindingContext.public_value_binding;
const missingBindingJson = JSON.stringify(missingBindingContext);
assert.throws(() => parseInput({ ...staticInput, context_bundles: [{ batch_id: contextBundle.batch_id,
  context_bundle_json: missingBindingJson, context_bundle_hash: sha256(missingBindingJson), message_count: 1 }] }, staticTask),
/LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING/u);
const alteredBindingContext = JSON.parse(contextBundleJson) as { public_value_binding: { authority_hashes: string[] } };
alteredBindingContext.public_value_binding.authority_hashes[0] = FIXTURE_HASH;
const alteredBindingJson = JSON.stringify(alteredBindingContext);
assert.throws(() => parseInput({ ...staticInput, context_bundles: [{ batch_id: contextBundle.batch_id,
  context_bundle_json: alteredBindingJson, context_bundle_hash: sha256(alteredBindingJson), message_count: 1 }] }, staticTask),
/LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING/u);
const missingUseContext = JSON.parse(contextBundleJson) as { message_items: Array<Record<string, unknown>> };
delete missingUseContext.message_items[0]!.user_action;
const missingUseJson = JSON.stringify(missingUseContext);
assert.throws(() => parseInput({ ...staticInput, context_bundles: [{ batch_id: contextBundle.batch_id,
  context_bundle_json: missingUseJson, context_bundle_hash: sha256(missingUseJson), message_count: 1 }] }, staticTask),
/LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING/u);
const staticStep = (role: "candidate_a" | "candidate_b" | "selector") => `static-catalog:${hashCanonical({
  source_resource_id: staticInput.source_resource_id,
  source_version: staticInput.source_version,
  source_sha256: staticInput.source_sha256,
  policy_version: staticInput.policy_version,
  authorization_ref: staticTask.business_identity.authorization_ref,
  message_ids: contextBundle.message_items.map((item) => item.message_id),
  role,
}).slice(7)}`;
const staticLocales = ["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const;
const staticRuns = [];
for (const locale of staticLocales) {
  const localeContext = { ...contextBundle, locale, batch_id: `${locale}-batch-001` };
  const localeContextJson = JSON.stringify(localeContext);
  const localeContextHash = sha256(localeContextJson);
  const localeInput = { ...staticInput, target_locale: locale, context_bundles: [{
    batch_id: localeContext.batch_id, context_bundle_json: localeContextJson,
    context_bundle_hash: localeContextHash, message_count: 1,
  }] };
  const localeTask = buildProductTask(staticRoute, { parameters: {
    ...staticTask.parameters, target_locale: locale,
  } });
  if (locale === "zh-HK") {
    delete (localeTask as { parent_task_ref?: string }).parent_task_ref;
    delete (localeTask as { parent_result_ref?: string }).parent_result_ref;
    delete (localeTask as { parent_result_hash?: string }).parent_result_hash;
  }
  staticRuns.push(await exerciseProductFlow(plugin, {
    task: localeTask, materialContents: { static_catalog_input: localeInput }, output: {},
    expectedSessionCount: 3,
    checkpointOutput: (call) => call.productStepId === staticStep("selector") ? {
      schema_version: "target-language-selector-output.v1", locale, pass: "first",
      selections: [{ message_id: "fixture.hello", selection: "identical",
        reason_code: "identical-byte-match" }],
    } : {
      schema_version: "target-language-candidate.v1", locale,
      context_bundle_hash: localeContextHash,
      items: [{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }],
    },
  }));
}
const staticRun = staticRuns[2]!;
assert.equal(staticRuns[0]!.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 3,
  "the zh-HK root must create exactly one fresh conversation per role");
assert.equal(staticRuns.slice(1).flatMap((run) => run.calls)
  .some((call) => call.child === "prepare_clean_gpt_chat"), false,
"direct-parent locales must continue the exact role conversations without preparing fresh chats");
assert.equal(staticRuns.reduce((count, run) => count + run.physicalSubmitDispatches, 0), 15);
assert.equal(new Set(staticRuns.flatMap((run) => run.calls
  .filter((call) => call.child === "submit_exact_gpt_turn_once")
  .map((call) => call.productStepId))).size, 3,
"five locale tasks must preserve exactly three locale-neutral cohort-role steps");
const staticReasoningCalls = staticRun.calls.filter(
  (call) => call.child === "ensure_gpt_reasoning_requirement",
);
assert.deepEqual(staticReasoningCalls.map((call) => ({
  productStepId: call.productStepId,
  profileRef: call.input.profile.profileRef,
  reasoningRequirement: call.input.profile.reasoningRequirement,
})), [
  {
    productStepId: staticStep("candidate_a"),
    profileRef: "localization-production:static-catalog:candidate-a:pro-standard",
    reasoningRequirement: {
      selectionPolicy: "exact-or-observed-maximum",
      requestedTier: "pro_standard",
    },
  },
  {
    productStepId: staticStep("candidate_b"),
    profileRef: "localization-production:static-catalog:candidate-b:high",
    reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  },
  {
    productStepId: staticStep("selector"),
    profileRef: "localization-production:static-catalog:selector:high",
    reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  },
]);
assert.equal(staticRun.physicalSubmitDispatches, 3);
const selectorWrite = staticRun.calls.find((call) => call.child === "write_exact_gpt_prompt"
  && call.productStepId === staticStep("selector"));
assert(selectorWrite?.child === "write_exact_gpt_prompt");
assert.match(String(selectorWrite.input.prompt), new RegExp(JSON.stringify(SELECTOR_REASON_CODES).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
assert.match(String(selectorWrite.input.prompt), /来源、事实边界、核验依据、当代用途与工具从属位置/u);
const candidateWrite = staticRun.calls.find((call) => call.child === "write_exact_gpt_prompt"
  && call.productStepId === staticStep("candidate_a"));
assert(candidateWrite?.child === "write_exact_gpt_prompt");
assert.match(String(candidateWrite.input.prompt), /PUBLIC_VALUE_SOURCE_ROLE_LOST.*PUBLIC_VALUE_TOOL_ROLE_PROMOTED/u);
assert.throws(() => parseSelector({ schema_version: "target-language-selector-output.v1", locale: "en-US", pass: "first",
  selections: [{ message_id: "fixture.hello", selection: "option_1", reason_code: "fidelity" }] }, contextBundle as never,
{ first_pass_candidates: [{ blind_label: "option_1" }, { blind_label: "option_2" }] } as never), /LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID/u);
const staticPayload = staticRun.completed.payload as Readonly<Record<string, unknown>>;
assert.equal(staticPayload.schema_version, "localization-static-catalog-result.v2");
assert.equal(staticPayload.decision, "production_approved");
assert.equal(Object.hasOwn(staticPayload, "cohort_results"), false);
assert.equal(staticPayload.selected_catalog_hash,
  hashCanonical([{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }]));
process.stdout.write("[ACCEPTANCE][localization-production] PASS\n");
