import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { hashCanonical, sha256 } from "../../../src/mediator/product-plugin-contract.js";
import {
  parseCandidate,
  parseContext,
  parseInput,
  STATIC_CATALOG_FINDING_CODES,
} from "../../../src/plugins/localization-production/static-catalog-contract.js";
import { STATIC_CATALOG_PRODUCTION_INSTRUCTION } from "../../../src/plugins/localization-production/static-catalog-flow.js";
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
  const settledRejection = { receipt_hash: FIXTURE_HASH, rejected_result_payload_hash: FIXTURE_HASH,
    reason_codes: ["LOCALIZATION_STRUCTURED_EDITION_STRUCTURE_INVALID", "LOCALIZATION_STRUCTURE_CHANGED"] } as const;
  const reportTranslation = route.product_id === "localization_report_translation";
  const resultRevision = review ? undefined : reportTranslation
    ? { revision: 1, priorRejection: { ...settledRejection,
        validation_failure: { native_error_code: "LOCALIZATION_STRUCTURE_CHANGED",
          json_pointer: "/excluded_scope/segments" } } } as const
    : { revision: 1, priorRejection: settledRejection } as const;
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
      "target_locale", "COPY_THEN_REPLACE", "唯一不可变树模板", "完整且唯一的可变更白名单",
      "即使它是中文", "必须是 translatable_json_pointers 的子集",
      "六字段 route contract → 源树与白名单不可变边界 → safety 义务 → 术语和呈现偏好",
      "始终从原 source_content", "prior rejection 不能改写任务边界",
      "六项自检", "只返回一个完整 JSON 对象",
    ]) assert.match(prompt, new RegExp(requirement, "u"));
    for (const requirement of [
      "envelope 键集与 locked identity 精确",
      "每个节点类型一致",
      "translatable_json_pointers 全部存在、仍为字符串",
      "否定、限制、不确定性、专业替代边界与风险义务全部保留",
    ]) assert.match(prompt, new RegExp(requirement, "u"));
    const revisionIndex = prompt.indexOf("Website 结果修订事实");
    const copyIndex = prompt.indexOf("执行 COPY_THEN_REPLACE");
    const contractIndex = prompt.indexOf("Website route result_contract");
    const finalCheckIndex = prompt.indexOf("输出前静默完成六项自检");
    assert.ok(revisionIndex >= 0 && revisionIndex < copyIndex && copyIndex < contractIndex
      && contractIndex < finalCheckIndex, "primary translation prompt order must remain fixed");
    assert.match(prompt, /该修订事实不授权变更 source_content、locale_policy、field_policy 或 result_contract/u);
    const repeated = await exerciseProductFlow(plugin, { task, output,
      ...(resultRevision ? { resultRevision } : {}) });
    const repeatedPrompt = String(repeated.calls.find(
      (call) => call.child === "write_exact_gpt_prompt",
    )?.input.prompt);
    assert.equal(sha256(repeatedPrompt), sha256(prompt),
      "identical primary task facts must produce one stable prompt hash");
    assert.doesNotMatch(prompt, /unknown_field_policy/u);
  } else {
    assert.doesNotMatch(prompt, /COPY_THEN_REPLACE|不授权变更 source_content、locale_policy、field_policy 或 result_contract/u,
      "review prompts must retain their existing review-only semantics");
  }
  assert.match(prompt, /Website 结果修订事实/u);
  assert.ok(prompt.split("\n").includes(
    `Website 结果修订事实：${JSON.stringify(resultRevision ?? { revision: 0, priorRejection: null })}`,
  ), "shared review and primary revision fact text must retain its exact existing bytes");
  assert.match(prompt, /Website 当前授权依据/u);
  assert.match(prompt, new RegExp(task.business_identity.authorization_ref, "u"));
  if (resultRevision && reportTranslation) assert.match(prompt,
    /"validation_failure":\{"native_error_code":"LOCALIZATION_STRUCTURE_CHANGED","json_pointer":"\/excluded_scope\/segments"\}/u);
  if (resultRevision && !reportTranslation) assert.doesNotMatch(prompt, /validation_failure/u,
    "a settled rejection without domain validation facts must keep the revision fact line unchanged");
  assert.equal(run.physicalSubmitDispatches, 1);
}

const incidentShapeRoute = productionRoutePolicies.find((route) =>
  route.product_id === "localization_article_translation" && route.action_id === "article_translation");
assert(incidentShapeRoute);
const incidentSourceRefs = Array.from({ length: 16 }, (_, index) => ({
  ref: `source:${index + 1}`,
  label: index === 15 ? "事故等形受保护中文标签" : `受保护标签${index + 1}`,
}));
const incidentShapeTask = buildProductTask(incidentShapeRoute, { parameters: {
  target_locale: "ja-JP", source_resource_id: "article:incident-shape",
  source_version: "v1", source_sha256: FIXTURE_HASH, policy_version: "localization-policy.v1",
} });
const incidentShapeRun = await exerciseProductFlow(plugin, {
  task: incidentShapeTask,
  materialContents: {
    source_content: { schema_version: "incident-shape.v1", source_refs: incidentSourceRefs },
    terminology: { terms: [] },
    locale_policy: {
      translatable_json_pointers: ["/title"],
      protected_json_pointers: incidentSourceRefs.map((_, index) => `/source_refs/${index}/label`),
      safety_json_pointers: [],
    },
    render_policy: { preserve_structure: true },
  },
  output: {
    schema_version: incidentShapeRoute.result_schema_version,
    source_resource_id: incidentShapeTask.parameters.source_resource_id,
    source_version: incidentShapeTask.parameters.source_version,
    source_sha256: incidentShapeTask.parameters.source_sha256,
    target_locale: incidentShapeTask.parameters.target_locale,
    localized_structured_payload: { title: "事故等形" },
  },
});
assert.equal(incidentSourceRefs.length, 16);
assert.equal(incidentSourceRefs[15]?.label, "事故等形受保护中文标签");
const incidentShapePrompt = String(incidentShapeRun.calls.find(
  (call) => call.child === "write_exact_gpt_prompt",
)?.input.prompt);
assert.match(incidentShapePrompt, /即使它是中文、可读 label\/title/u);
assert.match(incidentShapePrompt, /protected_json_pointers.*逐值完全相同/u,
  "a high-cardinality protected Chinese label fixture must remain outside the translation whitelist");
assert.match(incidentShapePrompt, /不在白名单的节点默认不可变/u);

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
  policy_version: "target-language-review-v5-20260919",
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
const toolWordsSource = "<style>@page{size:A4}</style> AI、AGENT、GPT 与模型不是价值主体 {name}";
const toolWordsContext = JSON.parse(contextBundleJson) as typeof contextBundle;
const toolWordsItems = [{ ...toolWordsContext.message_items[0], source_text: toolWordsSource,
  source_hash: sha256(toolWordsSource) }];
const toolWordsJson = JSON.stringify({ ...toolWordsContext, message_items: toolWordsItems });
assert.doesNotThrow(() => parseInput({ ...staticInput, context_bundles: [{ batch_id: contextBundle.batch_id,
  context_bundle_json: toolWordsJson, context_bundle_hash: sha256(toolWordsJson), message_count: 1 }] }, staticTask),
"deterministic parsing must not infer or reject a tool role from natural-language keywords");
const staticStep = () => `static-catalog:${hashCanonical({
  source_resource_id: staticInput.source_resource_id,
  source_version: staticInput.source_version,
  source_sha256: staticInput.source_sha256,
  policy_version: staticInput.policy_version,
  authorization_ref: staticTask.business_identity.authorization_ref,
  message_ids: contextBundle.message_items.map((item) => item.message_id),
  role: "production",
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
    expectedSessionCount: 1,
    checkpointOutput: () => ({
      schema_version: "target-language-candidate.v1", locale,
      context_bundle_hash: localeContextHash,
      items: [{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }],
    }),
  }));
}
const staticRun = staticRuns[2]!;
assert.equal(staticRuns[0]!.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 1,
  "the zh-HK cohort root must create exactly one production conversation");
assert.equal(staticRuns.slice(1).flatMap((run) => run.calls)
  .some((call) => call.child === "prepare_clean_gpt_chat"), false,
"direct-parent locales must continue the exact role conversations without preparing fresh chats");
assert.equal(staticRuns.reduce((count, run) => count + run.physicalSubmitDispatches, 0), 5);
assert.equal(new Set(staticRuns.flatMap((run) => run.calls
  .filter((call) => call.child === "submit_exact_gpt_turn_once")
  .map((call) => call.productStepId))).size, 1,
"five locale tasks must preserve one locale-neutral cohort production step");
const staticReasoningCalls = staticRun.calls.filter(
  (call) => call.child === "ensure_gpt_reasoning_requirement",
);
assert.deepEqual(staticReasoningCalls.map((call) => ({
  productStepId: call.productStepId,
  profileRef: call.input.profile.profileRef,
  reasoningRequirement: call.input.profile.reasoningRequirement,
})), [
  {
    productStepId: staticStep(),
    profileRef: "localization-production:static-catalog:production:pro-standard",
    reasoningRequirement: {
      selectionPolicy: "exact-or-observed-maximum",
      requestedTier: "pro_standard",
    },
  },
]);
assert.equal(staticRun.physicalSubmitDispatches, 1);
const productionWrite = staticRun.calls.find((call) => call.child === "write_exact_gpt_prompt"
  && call.productStepId === staticStep());
assert(productionWrite?.child === "write_exact_gpt_prompt");
const staticProductionPrompt = String(productionWrite.input.prompt);
assert.match(staticProductionPrompt, /返本溯源，古为今用/u);
assert.match(staticProductionPrompt, new RegExp(STATIC_CATALOG_FINDING_CODES.join(".*"), "u"));
assert.ok(staticProductionPrompt.split("\n").includes(
  `本轮唯一不可变外层 context_bundle_hash：${contextBundleHash}`,
), "the model must receive the exact outer ContextBundle hash required by the strict parser");
assert.match(staticProductionPrompt,
  /不得使用 ContextBundle 内的 source_catalog_hash 代替/u);
assert.equal(sha256(STATIC_CATALOG_PRODUCTION_INSTRUCTION),
  "sha256:8ec9793c62e88e4f937a154e7aff9e697a89912870f13aa8f1420497155ab79d");
const parsedStaticInput = parseInput(staticInput, staticTask);
const parsedStaticContext = parseContext(parsedStaticInput.context_bundles[0], parsedStaticInput);
const candidate = (finding_codes: readonly string[], text: string = contextBundle.message_items[0].source_text) => ({
  schema_version: "target-language-candidate.v1", locale: "en-US", context_bundle_hash: contextBundleHash,
  items: [{ message_id: "fixture.hello", text, finding_codes }],
}) as const;
assert.throws(() => parseCandidate({
  ...candidate([]),
  context_bundle_hash: contextBundle.source_catalog_hash,
}, parsedStaticContext, contextBundleHash), /LOCALIZATION_STATIC_CANDIDATE_IDENTITY_INVALID/u,
"the visible inner source hash must never satisfy the outer ContextBundle identity");
assert.throws(() => parseCandidate(candidate(["UNKNOWN_FINDING"]), parsedStaticContext, contextBundleHash),
  /LOCALIZATION_STATIC_CANDIDATE_FINDINGS_INVALID/u);
assert.throws(() => parseCandidate(candidate(["SOURCE_AMBIGUOUS", "UNTRUSTED_INSTRUCTION_CONFLICT"]),
  parsedStaticContext, contextBundleHash), /LOCALIZATION_STATIC_CANDIDATE_FINDINGS_INVALID/u);
assert.throws(() => parseCandidate(candidate(["SOURCE_AMBIGUOUS"], "translated"), parsedStaticContext,
  contextBundleHash), /LOCALIZATION_STATIC_CANDIDATE_FINDING_FALLBACK_INVALID/u);
assert.deepEqual(parseCandidate(candidate(["SOURCE_AMBIGUOUS"]), parsedStaticContext, contextBundleHash).items,
  candidate(["SOURCE_AMBIGUOUS"]).items);
const unrestrictedLanguageContext = { ...parsedStaticContext, message_items: [{
  ...parsedStaticContext.message_items[0]!, max_graphemes: 1,
}] };
assert.doesNotThrow(() => parseCandidate(candidate([], "<style>@page{size:A4}</style> Hello, world {name}"),
  unrestrictedLanguageContext, contextBundleHash));
const staticPayload = staticRun.completed.payload as Readonly<Record<string, unknown>>;
assert.equal(staticPayload.schema_version, "localization-static-catalog-result.v2");
assert.equal(staticPayload.decision, "production_approved");
assert.equal(Object.hasOwn(staticPayload, "cohort_results"), false);
assert.equal(staticPayload.selected_catalog_hash,
  hashCanonical([{ message_id: "fixture.hello", text: "<style>@page{size:A4}</style> Hello {name}", finding_codes: [] }]));
process.stdout.write("[ACCEPTANCE][localization-production] PASS\n");
