import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { zipSync, unzipSync } from "fflate";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { hashCanonical, sha256, type WebsiteAgentTask } from "../../../src/mediator/product-plugin-contract.js";
import {
  parseCandidate,
  parseContext,
} from "../../../src/plugins/localization-production/static-catalog-contract.js";
import { readLocalizationArchives, type LocalizationReference } from "../../../src/plugins/localization-production/material-archives.js";
import { STATIC_CATALOG_PRODUCTION_INSTRUCTION } from "../../../src/plugins/localization-production/static-catalog-flow.js";
import { executeIsolatedLocalizationJsonTurn } from "../../../src/plugins/localization-production/flow.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "localization-production");
assert(plugin);
const sequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response",
] as const;

function archivePair(task: WebsiteAgentTask, work: Record<string, unknown> = { source_content: { title: "原文" }, source_order: { "": ["title"] } }) {
  const scope = task.product_id === "localization_static_catalog" ? "static_catalog" : task.product_id === "localization_report_translation" ? "report" : "article";
  const reference: LocalizationReference = { layout_version: "localization-primary-archives.v1", scope,
    source_identity: { source_resource_id: String(task.parameters.source_resource_id), source_version: String(task.parameters.source_version),
      source_sha256: String(task.parameters.source_sha256) }, target_locale: String(task.parameters.target_locale), policy_version: String(task.parameters.policy_version),
    product_sources: scope === "static_catalog" ? Array.from({ length: 7 }, (_, i) => ({ source_ref: `product:${i}`,
      source_kind: i < 5 ? "product_blueprint" : i === 5 ? "product_vision" : "production_reference", utf8_text: `完整产品原件${i}`, sha256: sha256(`完整产品原件${i}`) })) : [],
    terminology: "{}", locale_policy: "{}", render_policy: "fixture-format-policy" };
  const encode = (root: string, source: unknown, extra: Record<string, Uint8Array>) => {
    const bytes = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8"), machine = bytes(source);
    const path = `${root}/研究材料/000_000.md`, reading = Buffer.from(JSON.stringify(source), "utf8");
    const files: Record<string, Uint8Array> = { ...extra, [path]: reading, [`${root}/01_阅读说明.md`]: Buffer.from("完整读取本包目录与正文"),
      [`${root}/机器核验/冻结原源.json`]: machine };
    files[`${root}/02_成员完整性.json`] = bytes({ schema_version: "localization-member-integrity.v1", entries: Object.keys(files).sort().map(path => ({ path, byte_count: files[path]!.length, sha256: sha256(files[path]!) })) });
    files[`${root}/00_资料目录.json`] = bytes({ schema_version: reference.layout_version, source_bundle_id: sha256(machine), source_bundle_hash: sha256(machine),
      book_bindings: [], book_path: null, book_root: null, machine_source: { path: `${root}/机器核验/冻结原源.json`, sha256: sha256(machine), byte_count: machine.length, format: "json" },
      record_pages: { research: { original_count: 1, pages: [{ path, source_pointer: root === "本地化依据" ? "/source_identity" : "/work", byte_count: reading.length }] } },
      entries: Object.keys(files).sort().map(path => ({ path, bindings: [{ archive_pointer: "", source_pointer: "" }] })) });
    return zipSync(files);
  };
  const originals: Record<string, Uint8Array> = {};
  reference.product_sources.forEach((source, i) => { originals[`本地化依据/产品原件/${String(i + 1).padStart(2, "0")}.md`] = Buffer.from(source.utf8_text); });
  for (const key of ["terminology", "locale_policy", "render_policy"] as const) originals[`本地化依据/语言政策/${key}.txt`] = Buffer.from(String(reference[key]));
  const { product_sources: _sources, terminology: _terms, locale_policy: _locale, render_policy: _render, ...common } = reference;
  return { reference, materials: {
    localization_reference_archive: encode("本地化依据", reference, originals),
    localization_work_archive: encode("本地化任务", { ...common, reference_source_hash: sha256(JSON.stringify(reference)), work }, {}),
  } };
}

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
  const primaryMaterials = review ? undefined : archivePair(task).materials;
  const run = await exerciseProductFlow(plugin, { task, output, ...(primaryMaterials ? { materialContents: primaryMaterials } : {}),
    ...(resultRevision ? { resultRevision } : {}) });
  const articleTranslation = route.product_id === "localization_article_translation"
    && route.action_id === "article_translation";
  if (articleTranslation) assert.deepEqual(new Set(run.calls.map((call) => call.productStepId)),
    new Set(["article_synthesis"]), "article translation must continue the SEO article synthesis step");
  assert.deepEqual(run.calls.map((call) => call.child),
    articleTranslation ? sequence.slice(1) : sequence);
  const reasoningCall = run.calls.find((call) => call.child === "select_gpt_reasoning_from_start_v3");
  assert(reasoningCall?.child === "select_gpt_reasoning_from_start_v3");
  assert.deepEqual({
    profileRef: reasoningCall.input.profile.profileRef,
    startModelDisplayName: reasoningCall.input.profile.startModelDisplayName,
    requestedReasoningValue: reasoningCall.input.profile.requestedReasoningValue,
  }, articleTranslation ? {
    profileRef: "localization-production:article-translation:chatgpt-latest-extra-high",
    startModelDisplayName: "最新", requestedReasoningValue: 3,
  } : {
    profileRef: "localization-production:gpt-5.6-sol-pro-standard",
    startModelDisplayName: "GPT-5.6 Sol", requestedReasoningValue: 5,
  });
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  const marker = `[GRASSEYE:${hashCanonical({ job_id: task.job_id,
    product_step_id: task.action_id }).slice(7, 31)}]`;
  assert.equal(prompt.split("\n")[0],
    `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`);
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
    const repeated = await exerciseProductFlow(plugin, { task, output, ...(primaryMaterials ? { materialContents: primaryMaterials } : {}),
      ...(resultRevision ? { resultRevision } : {}) });
    const repeatedPrompt = String(repeated.calls.find(
      (call) => call.child === "write_exact_gpt_prompt",
    )?.input.prompt);
    assert.equal(sha256(repeatedPrompt), sha256(prompt),
      "identical primary task facts must produce one stable prompt hash");
    assert.doesNotMatch(prompt, /unknown_field_policy/u);
    const recovered = await exerciseConfirmedSubmitRecovery(plugin, { task, output, ...(primaryMaterials ? { materialContents: primaryMaterials } : {}),
      ...(resultRevision ? { resultRevision } : {}) });
    assert.equal(recovered.physicalSubmitDispatches, 0);
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
const incidentPayload = { schema_version: "incident-shape.v1", source_refs: incidentSourceRefs, count: 2, nullable: null, enabled: false };
const incidentMaterials = archivePair(incidentShapeTask, { source_content: incidentPayload,
  source_order: { "": Object.keys(incidentPayload), ...Object.fromEntries(incidentSourceRefs.map((value, index) => [`/source_refs/${index}`, Object.keys(value)])) } }).materials;
const incidentShapeRun = await exerciseProductFlow(plugin, { task: incidentShapeTask, materialContents: incidentMaterials,
  productSkillText: "fixture product skill ".repeat(4_000), output: {
    schema_version: incidentShapeRoute.result_schema_version, source_resource_id: incidentShapeTask.parameters.source_resource_id,
    source_version: incidentShapeTask.parameters.source_version, source_sha256: incidentShapeTask.parameters.source_sha256,
    target_locale: incidentShapeTask.parameters.target_locale, localized_structured_payload: { title: "事故等形" },
  } });
assert.equal(incidentSourceRefs.length, 16);
assert.equal(incidentSourceRefs[15]?.label, "事故等形受保护中文标签");
const incidentShapePrompt = String(incidentShapeRun.calls.find(
  (call) => call.child === "write_exact_gpt_prompt",
)?.input.prompt);
assert.ok(Buffer.byteLength(incidentShapePrompt) > 63_412);
assert.ok(incidentShapePrompt.length > 10_201);
assert.match(incidentShapePrompt.slice(0, 10_201), /^把此不可变标记.*\[GRASSEYE:[a-f0-9]{24}\]/u);
assert.match(incidentShapePrompt, /即使它是中文、可读 label\/title/u);
assert.match(incidentShapePrompt, /protected_json_pointers.*逐值完全相同/u,
  "a high-cardinality protected Chinese label fixture must remain outside the translation whitelist");
assert.match(incidentShapePrompt, /不在白名单的节点默认不可变/u);

const staticRoute = productionRoutePolicies.find((route) => route.product_id === "localization_static_catalog"
  && route.action_id === "produce_locale_catalog");
assert(staticRoute);
const sourceItems = ["fixture.hello", "fixture.goodbye"].map((message_id) => ({
  message_id, semantic_owner: "fixture", surface_ref: "fixture:surface",
  surface_source_refs: ["fixture.ts:1"], copy_group_id: "fixture",
  surrounding_message_ids: [], control_role: "text", source_text: `你好 {name} ${message_id}`,
  source_hash: sha256(`你好 {name} ${message_id}`), existing_target_text: `你好 {name} ${message_id}`,
  existing_target_hash: sha256(`你好 {name} ${message_id}`), parameter_schema: ["name"],
  parameter_types: [{ name: "name", type: "string" }], protected_tokens: ["{name}"],
  max_graphemes: null, allow_wrapping: true, failure_code: null, correction_ref: null,
}));
const contextBundle = {
  schema_version: "target-language-context-bundle.v4", message_syntax: "typed-placeholder-v1", review_kind: "target_language_translation",
  locale: "en-US", source_locale: "zh-CN", source_catalog_hash: FIXTURE_HASH, batch_id: "en-US-batch-001", cohort_id: "batch-001",
  cohort_message_ids: sourceItems.map(item => item.message_id), ordered_pending_ids_hash: hashCanonical(sourceItems.map(item => item.message_id)),
  read_only_siblings: [], expression_policy_hash: sha256("{}"), terminology_hash: sha256("{}"), format_policy_hash: sha256("fixture-format-policy"),
  policy_refs: { terminology: "本地化依据/语言政策/terminology.txt", locale_policy: "本地化依据/语言政策/locale_policy.txt", render_policy: "本地化依据/语言政策/render_policy.txt" },
  product_source_refs: Array.from({ length: 7 }, (_, i) => ({ source_ref: `product:${i}`, source_kind: i < 5 ? "product_blueprint" : i === 5 ? "product_vision" : "production_reference", sha256: sha256(`完整产品原件${i}`) })),
  page_contexts: [{ kind: "web_page", surface_ref: "/fixture", source_refs: ["fixture.ts"], ordered_message_ids: sourceItems.map(item => item.message_id) }],
  source_items: sourceItems.map(item => ({ message_id: item.message_id, text: item.source_text, source_hash: item.source_hash,
    semantic_owner: item.semantic_owner, parameter_schema: item.parameter_schema, occurrences: [], product_context: null, current_target: null })),
  public_value_binding: { schema_version: "target-language-public-value-binding.v1", authority_refs: ["LAW-PROJECT-GOVERNANCE-010-V1", "LAW-USER-VALUE-INTERFACE-001-V4"],
    authority_hashes: ["sha256:79f430599798e5bb10d73dd70cd32dfa1b4254709a99f32c363e82b06679fbd3", "sha256:b9e9f7f3af6fc703577c07906e1c096bb091995d29f3356af44b976258b0d6f1"],
    canonical_approval_ref: `content/zh-CN/locales/messages.json#production-approved-${FIXTURE_HASH}`,
    source_owner_refs: ["fixture"], visible_evidence_refs: ["fixture:surface"], tool_role: "not_present" },
  message_items: sourceItems,
};
const contextBundleJson = JSON.stringify(contextBundle);
const contextBundleHash = sha256(contextBundleJson);
const staticTask = buildProductTask(staticRoute, { parameters: {
  target_locale: "en-US", source_resource_id: "website-fixed-copy-catalog",
  source_version: "fixture-v1", source_sha256: FIXTURE_HASH, policy_version: "target-language-review-v6-20260924", cohort_id: contextBundle.cohort_id,
  ordered_pending_ids_hash: contextBundle.ordered_pending_ids_hash,
  result_schema_version: "localization-static-catalog-result.v3",
} });
const staticPair = archivePair(staticTask, contextBundle);
const parsedStaticContext = parseContext(contextBundle, staticPair.reference, staticTask);
const candidate = {
  schema_version: "target-language-candidate.v3", locale: "en-US", context_bundle_hash: contextBundleHash,
  items: [{ message_id: "fixture.hello", text: "Hello {name}" }],
};
assert.deepEqual(parseCandidate(candidate, parsedStaticContext, contextBundleHash).items, candidate.items,
  "a trusted ordered subset must be carried to Website without whole-cohort blocking");
assert.doesNotThrow(() => parseCandidate({ ...candidate, items: [{ message_id: "fixture.unknown", text: "Hello {name}" }] },
  parsedStaticContext, contextBundleHash), "Website rejects whole-set identity errors on the same job");
assert.doesNotThrow(() => parseCandidate({ ...candidate, items: [{ message_id: "fixture.hello", text: null }] },
  parsedStaticContext, contextBundleHash), "individual malformed text is a Website field verdict");
const staticRun = await exerciseProductFlow(plugin, {
  task: staticTask, materialContents: staticPair.materials, output: {},
  expectedSessionCount: 1, checkpointOutput: () => candidate,
});
assert.equal(staticRun.physicalSubmitDispatches, 1);
assert.equal(staticRun.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 0);
const staticAttach = staticRun.calls.find(call => call.child === "attach_approved_gpt_files_once");
assert(staticAttach?.child === "attach_approved_gpt_files_once");
assert.deepEqual(staticAttach.input.files.map(file => [file.sha256, file.bytes]),
  Object.values(staticPair.materials).map(bytes => [sha256(bytes), bytes.length]),
  "the two approved ZIPs must be uploaded intact, with no derived material");
const staticSubmit = staticRun.calls.find(call => call.child === "submit_exact_gpt_turn_once");
assert(staticSubmit?.child === "submit_exact_gpt_turn_once");
assert.equal(staticSubmit.actionOrdinal, 13);
assert.equal(staticSubmit.input.files.length, 2);
const staticRootTask = { ...staticTask };
delete (staticRootTask as Partial<typeof staticRootTask>).parent_task_ref;
delete (staticRootTask as Partial<typeof staticRootTask>).parent_result_ref;
delete (staticRootTask as Partial<typeof staticRootTask>).parent_result_hash;
const staticRootRun = await exerciseProductFlow(plugin, {
  task: staticRootTask, materialContents: staticPair.materials, output: {},
  expectedSessionCount: 1, checkpointOutput: () => candidate,
});
assert.equal(staticRootRun.physicalSubmitDispatches, 1);
assert.equal(staticRootRun.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 1);
for (const run of [staticRootRun, staticRun]) {
  const write = run.calls.find((call) => call.child === "write_exact_gpt_prompt");
  assert(write?.child === "write_exact_gpt_prompt");
  const marker = `[GRASSEYE:${hashCanonical({ job_id: staticTask.job_id,
    product_step_id: write.productStepId }).slice(7, 31)}]`;
  assert.equal(write.input.prompt.split("\n")[0],
    `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`);
  const modelCall = run.calls.find((call) => call.child === "select_gpt_model_from_start_v3");
  const reasoningCall = run.calls.find((call) => call.child === "select_gpt_reasoning_from_start_v3");
  assert(modelCall?.child === "select_gpt_model_from_start_v3");
  assert(reasoningCall?.child === "select_gpt_reasoning_from_start_v3");
  assert.deepEqual({
    profileRef: modelCall.input.profile.profileRef,
    startModelDisplayName: modelCall.input.profile.startModelDisplayName,
    requestedReasoningValue: reasoningCall.input.profile.requestedReasoningValue,
  }, {
    profileRef: "localization-production:static-catalog:production:chatgpt-latest-extra-high",
    startModelDisplayName: "最新", requestedReasoningValue: 3,
  });
  assert.deepEqual(modelCall.input.profile, reasoningCall.input.profile,
    "fixed-copy model and reasoning selection must consume the same profile");
}
for (const task of [staticRootTask, staticTask]) assert.deepEqual((await exerciseConfirmedSubmitRecovery(plugin, {
  task, materialContents: staticPair.materials, output: {},
  expectedSessionCount: 1, checkpointOutput: () => candidate,
})).calls.map((call) => call.child), ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"]);
const staticPrompt = String(staticRun.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
assert.equal(staticPrompt.includes(contextBundleJson), false);
assert.match(staticPrompt, /ContextBundle\.v4/u);
assert.match(staticPrompt, /本地化依据.*本地化任务/u);
assert.match(staticPrompt, new RegExp(contextBundleHash, "u"));
assert.ok(staticSubmit.input.files[0]?.providerDisplayName
  && staticPrompt.includes(staticSubmit.input.files[0].providerDisplayName));
assert.deepEqual(staticRun.calls.map(call => call.child), sequence.slice(1));
const staticRepeated = await exerciseProductFlow(plugin, { task: staticTask,
  materialContents: staticPair.materials, output: {},
  expectedSessionCount: 1, checkpointOutput: () => candidate });
assert.equal(staticRepeated.calls.find(call => call.child === "write_exact_gpt_prompt")?.input.prompt, staticPrompt);
const largeSource = `${"原冻结完整材料".repeat(8_000)} {name}`;
const largeContext = { ...contextBundle,
  message_items: [{ ...sourceItems[0]!, source_text: largeSource, source_hash: sha256(largeSource) }, sourceItems[1]!],
  source_items: contextBundle.source_items.map((item, index) => index === 0 ? { ...item, text: largeSource, source_hash: sha256(largeSource) } : item) };
const largeContextJson = JSON.stringify(largeContext), largePair = archivePair(staticTask, largeContext);
assert.ok(Buffer.byteLength(largeContextJson) > 63_412);
const largeRun = await exerciseProductFlow(plugin, { task: staticTask,
  materialContents: largePair.materials, output: {}, expectedSessionCount: 1,
  checkpointOutput: () => ({ ...candidate, context_bundle_hash: sha256(largeContextJson) }) });
const largeWrite = largeRun.calls.find(call => call.child === "write_exact_gpt_prompt");
assert(largeWrite?.child === "write_exact_gpt_prompt");
assert.equal(largeWrite.input.prompt.includes(largeSource), false);
assert.ok(largeWrite.input.prompt.length < 10_201, "incident-sized material stays in its two original ZIPs");
assert.equal(largeRun.physicalSubmitDispatches, 1);
const profileCall = staticRun.calls.find((call) => call.child === "select_gpt_model_from_start_v3");
assert(profileCall?.child === "select_gpt_model_from_start_v3");
const oldConfirmed = await exerciseProductFlow({ ...plugin, execute: async (task, context) => {
  const turn = await executeIsolatedLocalizationJsonTurn(task, context, {
    stepId: "old-confirmed-fixture", sessionSuffix: "old-confirmed-fixture",
    prompt: staticPrompt, profile: profileCall.input.profile,
  });
  return context.complete({ payload: { promptHash: turn.checkpoint.promptHash }, evidence_refs: turn.evidenceRefs });
} }, { task: staticTask, materialContents: staticPair.materials, output: candidate, confirmedSubmit: true, confirmedPromptHash: FIXTURE_HASH });
const oldSubmitRead = oldConfirmed.confirmedSubmitReads[0];
assert(oldSubmitRead?.child === "submit_exact_gpt_turn_once");
assert.notEqual(oldSubmitRead.input.promptHash, FIXTURE_HASH);
const oldConfirmedPayload = oldConfirmed.completed.payload;
assert(oldConfirmedPayload && typeof oldConfirmedPayload === "object" && "promptHash" in oldConfirmedPayload);
assert.equal(oldConfirmedPayload.promptHash, FIXTURE_HASH);
assert.deepEqual(oldConfirmed.calls.map((call) => call.child), ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"]);
assert.equal(oldConfirmed.physicalSubmitDispatches, 0);
assert.match(staticPrompt, /read_only_siblings/u);
assert.doesNotMatch(staticPrompt, /"finding_codes"\s*:|五个 locale turn/u);
const staticPayload = staticRun.completed.payload as Readonly<Record<string, unknown>>;
assert.equal(staticPayload.schema_version, "localization-static-catalog-result.v3");
assert.equal(staticPayload.decision, "candidate_submitted");
assert.equal(staticPayload.message_count, 1);
assert.equal(staticPayload.selected_catalog_hash, hashCanonical(candidate.items));
assert.match(STATIC_CATALOG_PRODUCTION_INSTRUCTION, /网站负责机械验收/u);
// Exercise the same approved ZIPs with one mechanical fault at a time, before any Provider action.
const probe = { ...plugin, execute: async (task: WebsiteAgentTask, context: Parameters<typeof plugin.execute>[1]) => {
  const decoded = await readLocalizationArchives(task, context.materials);
  return context.complete({ payload: decoded.work, evidence_refs: [] });
} };
const decoded = await exerciseProductFlow(probe, { task: incidentShapeTask, materialContents: incidentMaterials, output: {}, expectedSessionCount: 0 });
assert.deepEqual(decoded.completed.payload, { source_content: incidentPayload,
  source_order: { "": Object.keys(incidentPayload), ...Object.fromEntries(incidentSourceRefs.map((value, index) => [`/source_refs/${index}`, Object.keys(value)])) } });
const sibling = { message_id: sourceItems[1]!.message_id, source_text: sourceItems[1]!.source_text,
  source_hash: sourceItems[1]!.source_hash, text: null, text_hash: null, origin_hash: null };
const partialContext = { ...contextBundle, message_items: [sourceItems[0]!], read_only_siblings: [sibling],
  ordered_pending_ids_hash: hashCanonical([sourceItems[0]!.message_id]) };
const partialTask = { ...staticTask, parameters: { ...staticTask.parameters, ordered_pending_ids_hash: partialContext.ordered_pending_ids_hash } };
assert.equal(parseContext(partialContext, staticPair.reference, partialTask).message_items.length, 1);
assert.doesNotThrow(() => parseContext({ ...partialContext, read_only_siblings: [{ ...sibling, text: "Existing", text_hash: sha256("Existing"), origin_hash: FIXTURE_HASH }] }, staticPair.reference, partialTask));
for (const change of [
  { read_only_siblings: [{ ...sibling, text_hash: FIXTURE_HASH }] },
  { read_only_siblings: [] }, { message_items: [sourceItems[0], sourceItems[0]] },
  { policy_refs: { ...contextBundle.policy_refs, terminology: "foreign" } },
  { source_items: [] }, { schema_version: "target-language-context-bundle.v3" },
]) assert.throws(() => parseContext({ ...partialContext, ...change }, staticPair.reference, partialTask));
for (const parameter of ["source_resource_id", "source_version", "source_sha256", "target_locale", "policy_version"]) {
  await assert.rejects(() => exerciseProductFlow(plugin, { task: { ...staticTask, parameters: { ...staticTask.parameters, [parameter]: "foreign" } },
    materialContents: staticPair.materials, output: {}, onChildCall: () => assert.fail("invalid archive reached Provider") }), /LOCALIZATION_ARCHIVE/u);
}
for (const refs of [staticTask.material_refs.slice(0, 1), [...staticTask.material_refs].reverse(),
  [...staticTask.material_refs, { ...staticTask.material_refs[0]!, ordinal: 2, display_name: "extra.zip" }]]) {
  await assert.rejects(() => exerciseProductFlow(plugin, { task: { ...staticTask, material_refs: refs }, materialContents: staticPair.materials,
    output: {}, onChildCall: () => assert.fail("invalid pair reached Provider") }), /LOCALIZATION_ARCHIVE/u);
}
const originalWorkFiles = unzipSync(staticPair.materials.localization_work_archive);
for (const mutate of [
  (files: Record<string, Uint8Array>) => { delete files["本地化任务/机器核验/冻结原源.json"]; },
  (files: Record<string, Uint8Array>) => { files["本地化任务/extra.txt"] = Buffer.from("unexpected"); },
  (files: Record<string, Uint8Array>) => { files["本地化任务/../escape.txt"] = Buffer.from("unsafe"); },
  (files: Record<string, Uint8Array>) => { files["本地化任务/研究材料/000_000.md"] = new Uint8Array([0xff]); },
  (files: Record<string, Uint8Array>) => { files["本地化任务/研究材料/000_000.md"] = Buffer.from("tampered"); },
]) {
  const files = { ...originalWorkFiles }; mutate(files);
  await assert.rejects(() => exerciseProductFlow(plugin, { task: staticTask, materialContents: { ...staticPair.materials,
    localization_work_archive: zipSync(files) }, output: {}, onChildCall: () => assert.fail("invalid member reached Provider") }), /LOCALIZATION_ARCHIVE/u);
}
const duplicateFiles = { ...originalWorkFiles, "本地化任务/研究材料/000_001.md": Buffer.from("duplicate") };
const duplicateZip = Buffer.from(zipSync(duplicateFiles));
for (let index = duplicateZip.indexOf("000_001"); index >= 0; index = duplicateZip.indexOf("000_001", index + 7)) {
  duplicateZip.write("000_000", index, "utf8");
}
const expansionZip = Buffer.from(staticPair.materials.localization_work_archive);
const zipView = new DataView(expansionZip.buffer, expansionZip.byteOffset, expansionZip.byteLength);
let header = zipView.getUint32(expansionZip.length - 6, true);
while (zipView.getUint32(header, true) === 0x02014b50) {
  const length = zipView.getUint16(header + 28, true);
  if (expansionZip.subarray(header + 46, header + 46 + length).toString("utf8").endsWith("00_资料目录.json")) {
    zipView.setUint32(header + 24, 1, true);
    zipView.setUint32(zipView.getUint32(header + 42, true) + 22, 1, true);
    break;
  }
  header += 46 + length + zipView.getUint16(header + 30, true) + zipView.getUint16(header + 32, true);
}
for (const [bytes, code] of [[duplicateZip, /HEADER_INVALID/u], [expansionZip, /EXPANSION_INVALID/u]] as const) await assert.rejects(() => exerciseProductFlow(plugin, {
  task: staticTask, materialContents: { ...staticPair.materials, localization_work_archive: bytes }, output: {},
  onChildCall: () => assert.fail("duplicate/expanding member reached Provider"),
}), code);
await assert.rejects(() => exerciseProductFlow({ ...plugin, execute: (task, context) => plugin.execute(task, {
  ...context, materials: context.materials.map((material, index) => index ? material : { ...material, sha256: FIXTURE_HASH }),
}) }, { task: staticTask, materialContents: staticPair.materials, output: {},
  onChildCall: () => assert.fail("bad outer hash reached Provider") }), /LOCALIZATION_ARCHIVE/u);
const badOrder = archivePair(incidentShapeTask, { source_content: incidentPayload, source_order: { "": [] } });
await assert.rejects(() => exerciseProductFlow(plugin, { task: incidentShapeTask, materialContents: badOrder.materials,
  output: {}, onChildCall: () => assert.fail("bad source order reached Provider") }), /LOCALIZATION_ARCHIVE/u);
process.stdout.write("[ACCEPTANCE][localization-production] PASS\n");
