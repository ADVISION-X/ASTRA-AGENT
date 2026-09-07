import { readFile } from "node:fs/promises";

import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type SharedExecutionContext,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import {
  executeIsolatedLocalizationJsonTurn,
  type IsolatedLocalizationJsonTurn,
} from "./flow.js";

const REVIEW_AUTHORITY_REF = "APEX-LOCALIZATION-009-V5";
const TARGET_LOCALES = new Set(["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"]);
const HASH = /^sha256:[a-f0-9]{64}$/u;
const SELECTION_REASONS = new Set([
  "meaning-and-action-preserved",
  "candidate-quality-preferred",
  "identical-byte-match",
  "blocking-finding",
]);

type TargetLocale = "zh-HK" | "zh-TW" | "en-US" | "ja-JP" | "ko-KR";
type CandidateRole = "candidate_a" | "candidate_b";
type FormalSelection = CandidateRole | "identical" | "blocked";

interface ContextItem {
  readonly message_id: string;
  readonly source_text: string;
  readonly parameter_schema: readonly string[];
  readonly parameter_types: readonly Readonly<{ name: string; type: string }>[];
  readonly protected_tokens: readonly string[];
  readonly max_graphemes: number | null;
  readonly allow_wrapping: boolean;
  readonly [key: string]: unknown;
}

interface ContextBundle {
  readonly schema_version: "target-language-context-bundle.v1";
  readonly message_syntax: "typed-placeholder-v1";
  readonly review_kind: "target_language_translation";
  readonly locale: TargetLocale;
  readonly source_locale: "zh-CN";
  readonly source_catalog_hash: ProductionHash;
  readonly batch_id: string;
  readonly expression_policy_hash: ProductionHash;
  readonly expression_policy_json: string;
  readonly terminology_hash: ProductionHash;
  readonly terminology_json: string;
  readonly format_policy_hash: ProductionHash;
  readonly format_policy_source: string;
  readonly message_items: readonly ContextItem[];
}

interface StaticCohort {
  readonly batch_id: string;
  readonly context_bundle_json: string;
  readonly context_bundle_hash: ProductionHash;
  readonly message_count: number;
}

interface StaticCatalogInput {
  readonly schema_version: "localization-static-catalog-input.v1";
  readonly target_locale: TargetLocale;
  readonly source_resource_id: "website-fixed-copy-catalog";
  readonly source_version: string;
  readonly source_sha256: ProductionHash;
  readonly policy_version: string;
  readonly expected_message_count: number;
  readonly context_bundles: readonly StaticCohort[];
}

interface CandidateItem {
  readonly message_id: string;
  readonly text: string;
  readonly finding_codes: readonly string[];
}

interface CandidatePayload {
  readonly schema_version: "target-language-candidate.v1";
  readonly locale: TargetLocale;
  readonly context_bundle_hash: ProductionHash;
  readonly items: readonly CandidateItem[];
}

interface CandidateReceipt {
  readonly role: CandidateRole;
  readonly producer_ref: string;
  readonly provider_ref: "gpt-web-chat";
  readonly model_family_ref: "gpt-5.6";
  readonly model_revision_ref: string;
  readonly provider_job_id: string;
  readonly provider_execution_id: string;
  readonly provider_lease_id: string;
  readonly model_identity_proof_json: string;
  readonly model_identity_proof_hash: ProductionHash;
  readonly reasoning_effort: "xhigh" | "high";
  readonly conversation_ref: string;
  readonly started_at: string;
  readonly completed_at: string;
  readonly context_bundle_hash: ProductionHash;
  readonly request_json: string;
  readonly request_hash: ProductionHash;
  readonly payload_json: string;
  readonly payload_hash: ProductionHash;
  readonly provider_transcript_jsonl: string;
  readonly provider_transcript_hash: ProductionHash;
}

interface BlindMappingItem {
  readonly blind_label: string;
  readonly candidate_role: CandidateRole;
  readonly candidate_payload_hash: ProductionHash;
}

interface BlindMapping {
  readonly schema_version: "target-language-blind-mapping.v1";
  readonly locale: TargetLocale;
  readonly context_bundle_hash: ProductionHash;
  readonly first_pass_candidates: readonly [BlindMappingItem, BlindMappingItem];
  readonly nonce_ref: string;
}

interface SelectorOutputItem {
  readonly message_id: string;
  readonly selection: string;
  readonly reason_code: string;
}

interface SelectorOutput {
  readonly schema_version: "target-language-selector-output.v1";
  readonly locale: TargetLocale;
  readonly pass: "first";
  readonly selections: readonly SelectorOutputItem[];
}

const candidateAProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:candidate-a:xhigh",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier: "extra_high" },
  executorIdentityRef: "localization-production:static-catalog:candidate-a",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

const candidateBProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:candidate-b:high",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  executorIdentityRef: "localization-production:static-catalog:candidate-b",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

const selectorProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:selector:high",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  executorIdentityRef: "localization-production:static-catalog:selector",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

function fail(code: string): never {
  throw executionFailure("failed", code);
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[], code: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(code);
}

function stringValue(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
}

function hashValue(value: unknown, code: string): ProductionHash {
  if (typeof value !== "string" || !HASH.test(value)) fail(code);
  return value as ProductionHash;
}

function stringArray(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) fail(code);
  return value as readonly string[];
}

function parseJsonObject(value: string, code: string): Record<string, unknown> {
  try { return objectValue(JSON.parse(value) as unknown, code); } catch { return fail(code); }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function placeholderNames(value: string): readonly string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/gu)]
    .map((match) => match[1]!)
    .sort();
}

function machineTokens(value: string): readonly string[] {
  return [...value.matchAll(/(?:\{[A-Za-z0-9_.-]+\}|https?:\/\/[^\s<]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d+(?:\.\d+)?%|<\/?[A-Za-z][^>]*>)/gu)]
    .map((match) => match[0]!.replace(/lang="[^"]+"/gu, "lang=\"<locale>\"")).sort();
}

function punctuationText(value: string): string {
  return value.replace(/(?:\{[A-Za-z0-9_.-]+\}|https?:\/\/[^\s<]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d+(?:\.\d+)?%|<\/?[A-Za-z][^>]*>)/gu, "");
}

function assertPunctuation(locale: TargetLocale, value: string): void {
  if (!TARGET_LOCALES.has(locale) || !["zh-HK", "zh-TW", "ja-JP"].includes(locale)) return;
  const cjk = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}";
  const text = punctuationText(value);
  if (/\.\.\./u.test(text) || new RegExp(`[${cjk}][,;!?](?=[${cjk}]|$)`, "u").test(text)) {
    fail("LOCALIZATION_STATIC_CANDIDATE_PUNCTUATION_INVALID");
  }
}

function assertCandidateText(context: ContextItem, locale: TargetLocale, text: string): void {
  const schema = [...context.parameter_schema].sort();
  if (!sameStrings(placeholderNames(text), schema)
    || !sameStrings(machineTokens(text), machineTokens(context.source_text))
    || context.protected_tokens.some((token) => !text.includes(token))) {
    fail("LOCALIZATION_STATIC_CANDIDATE_MECHANICS_INVALID");
  }
  if (context.max_graphemes !== null
    && [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)].length > context.max_graphemes) {
    fail("LOCALIZATION_STATIC_CANDIDATE_LENGTH_INVALID");
  }
  assertPunctuation(locale, text);
}

function parseContext(cohort: StaticCohort, input: StaticCatalogInput): ContextBundle {
  if (sha256(cohort.context_bundle_json) !== cohort.context_bundle_hash) fail("LOCALIZATION_STATIC_CONTEXT_HASH_INVALID");
  const raw = parseJsonObject(cohort.context_bundle_json, "LOCALIZATION_STATIC_CONTEXT_JSON_INVALID");
  if (raw.schema_version !== "target-language-context-bundle.v1"
    || raw.message_syntax !== "typed-placeholder-v1"
    || raw.review_kind !== "target_language_translation"
    || raw.locale !== input.target_locale
    || raw.source_locale !== "zh-CN"
    || raw.source_catalog_hash !== input.source_sha256
    || raw.batch_id !== cohort.batch_id
    || !Array.isArray(raw.message_items)
    || raw.message_items.length !== cohort.message_count
    || raw.message_items.length < 1) {
    fail("LOCALIZATION_STATIC_CONTEXT_IDENTITY_INVALID");
  }
  for (const pair of [[raw.expression_policy_json, raw.expression_policy_hash],
    [raw.terminology_json, raw.terminology_hash], [raw.format_policy_source, raw.format_policy_hash]] as const) {
    if (typeof pair[0] !== "string" || sha256(pair[0]) !== pair[1]) fail("LOCALIZATION_STATIC_POLICY_HASH_INVALID");
  }
  const items = raw.message_items.map((item) => {
    const candidate = objectValue(item, "LOCALIZATION_STATIC_CONTEXT_ITEM_INVALID");
    const parameterSchema = stringArray(candidate.parameter_schema, "LOCALIZATION_STATIC_PARAMETER_SCHEMA_INVALID");
    const parameterTypes = Array.isArray(candidate.parameter_types) ? candidate.parameter_types.map((entry) => {
      const parameter = objectValue(entry, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID");
      return { name: stringValue(parameter.name, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID"),
        type: stringValue(parameter.type, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID") };
    }) : fail("LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID");
    const typedNames = parameterTypes.map((entry) => entry.name).sort();
    const sourceText = stringValue(candidate.source_text, "LOCALIZATION_STATIC_SOURCE_TEXT_INVALID");
    if (!sameStrings([...parameterSchema].sort(), typedNames)
      || !sameStrings(placeholderNames(sourceText), [...parameterSchema].sort())
      || !Number.isSafeInteger(candidate.max_graphemes) && candidate.max_graphemes !== null
      || typeof candidate.allow_wrapping !== "boolean") {
      fail("LOCALIZATION_STATIC_SOURCE_MECHANICS_INVALID");
    }
    return { ...candidate, message_id: stringValue(candidate.message_id, "LOCALIZATION_STATIC_MESSAGE_ID_INVALID"),
      source_text: sourceText, parameter_schema: parameterSchema, parameter_types: parameterTypes,
      protected_tokens: stringArray(candidate.protected_tokens, "LOCALIZATION_STATIC_PROTECTED_TOKEN_INVALID"),
      max_graphemes: candidate.max_graphemes as number | null,
      allow_wrapping: candidate.allow_wrapping } as ContextItem;
  });
  const ids = items.map((item) => item.message_id);
  if (new Set(ids).size !== ids.length) fail("LOCALIZATION_STATIC_MESSAGE_ID_INVALID");
  return { ...raw, message_items: items } as unknown as ContextBundle;
}

function parseInput(value: unknown, task: WebsiteAgentTask): StaticCatalogInput {
  const input = objectValue(value, "LOCALIZATION_STATIC_INPUT_INVALID");
  exact(input, ["schema_version", "target_locale", "source_resource_id", "source_version", "source_sha256",
    "policy_version", "expected_message_count", "context_bundles"], "LOCALIZATION_STATIC_INPUT_FIELDS_INVALID");
  if (input.schema_version !== "localization-static-catalog-input.v1"
    || !TARGET_LOCALES.has(String(input.target_locale))
    || input.source_resource_id !== "website-fixed-copy-catalog"
    || !Number.isSafeInteger(input.expected_message_count) || Number(input.expected_message_count) < 1
    || !Array.isArray(input.context_bundles) || input.context_bundles.length < 1) {
    fail("LOCALIZATION_STATIC_INPUT_IDENTITY_INVALID");
  }
  for (const key of ["target_locale", "source_resource_id", "source_version", "source_sha256", "policy_version"] as const) {
    if (input[key] !== task.parameters[key]) fail("LOCALIZATION_STATIC_TASK_INPUT_MISMATCH");
  }
  const cohorts = input.context_bundles.map((value) => {
    const cohort = objectValue(value, "LOCALIZATION_STATIC_COHORT_INVALID");
    exact(cohort, ["batch_id", "context_bundle_json", "context_bundle_hash", "message_count"], "LOCALIZATION_STATIC_COHORT_FIELDS_INVALID");
    if (!Number.isSafeInteger(cohort.message_count) || Number(cohort.message_count) < 1) fail("LOCALIZATION_STATIC_COHORT_COUNT_INVALID");
    return { batch_id: stringValue(cohort.batch_id, "LOCALIZATION_STATIC_BATCH_ID_INVALID"),
      context_bundle_json: stringValue(cohort.context_bundle_json, "LOCALIZATION_STATIC_CONTEXT_JSON_INVALID"),
      context_bundle_hash: hashValue(cohort.context_bundle_hash, "LOCALIZATION_STATIC_CONTEXT_HASH_INVALID"),
      message_count: Number(cohort.message_count) } as StaticCohort;
  });
  const parsed: StaticCatalogInput = { schema_version: "localization-static-catalog-input.v1",
    target_locale: input.target_locale as TargetLocale,
    source_resource_id: "website-fixed-copy-catalog",
    source_sha256: hashValue(input.source_sha256, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID"),
    source_version: stringValue(input.source_version, "LOCALIZATION_STATIC_SOURCE_VERSION_INVALID"),
    policy_version: stringValue(input.policy_version, "LOCALIZATION_STATIC_POLICY_VERSION_INVALID"),
    expected_message_count: Number(input.expected_message_count), context_bundles: cohorts };
  const batches = cohorts.map((cohort) => cohort.batch_id);
  const contexts = cohorts.map((cohort) => parseContext(cohort, parsed));
  const ids = contexts.flatMap((context) => context.message_items.map((item) => item.message_id));
  if (new Set(batches).size !== batches.length || new Set(ids).size !== ids.length
    || ids.length !== parsed.expected_message_count) fail("LOCALIZATION_STATIC_INPUT_DENOMINATOR_INVALID");
  return parsed;
}

function parseCandidate(
  value: Readonly<Record<string, unknown>>,
  context: ContextBundle,
  contextHash: ProductionHash,
): CandidatePayload {
  exact(value, ["schema_version", "locale", "context_bundle_hash", "items"], "LOCALIZATION_STATIC_CANDIDATE_FIELDS_INVALID");
  if (value.schema_version !== "target-language-candidate.v1" || value.locale !== context.locale
    || value.context_bundle_hash !== contextHash || !Array.isArray(value.items)) {
    fail("LOCALIZATION_STATIC_CANDIDATE_IDENTITY_INVALID");
  }
  const items = value.items.map((raw) => {
    const item = objectValue(raw, "LOCALIZATION_STATIC_CANDIDATE_ITEM_INVALID");
    exact(item, ["message_id", "text", "finding_codes"], "LOCALIZATION_STATIC_CANDIDATE_ITEM_FIELDS_INVALID");
    return { message_id: stringValue(item.message_id, "LOCALIZATION_STATIC_CANDIDATE_ITEM_INVALID"),
      text: stringValue(item.text, "LOCALIZATION_STATIC_CANDIDATE_ITEM_INVALID"),
      finding_codes: stringArray(item.finding_codes, "LOCALIZATION_STATIC_CANDIDATE_FINDINGS_INVALID") } as CandidateItem;
  });
  const expectedIds = context.message_items.map((item) => item.message_id);
  if (!sameStrings(items.map((item) => item.message_id), expectedIds)) fail("LOCALIZATION_STATIC_CANDIDATE_DENOMINATOR_INVALID");
  items.forEach((item, index) => assertCandidateText(context.message_items[index]!, context.locale, item.text));
  return { schema_version: "target-language-candidate.v1", locale: context.locale,
    context_bundle_hash: contextHash, items };
}

function transcript(turn: IsolatedLocalizationJsonTurn, payloadJson: string): string {
  return [
    JSON.stringify({ type: "thread.started", thread_id: turn.checkpoint.canonicalConversationUrl }),
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: payloadJson } }),
  ].join("\n");
}

function candidateReceipt(input: Readonly<{
  role: CandidateRole;
  reasoningEffort: "xhigh" | "high";
  requestJson: string;
  contextHash: ProductionHash;
  payloadJson: string;
  turn: IsolatedLocalizationJsonTurn;
  batchId: string;
}>): CandidateReceipt {
  const providerTranscript = transcript(input.turn, input.payloadJson);
  return Object.freeze({
    role: input.role,
    producer_ref: `localization-production:${input.batchId}:${input.role}:${input.turn.checkpoint.submitExactCallIdentityHash}`,
    provider_ref: "gpt-web-chat",
    model_family_ref: "gpt-5.6",
    model_revision_ref: `GPT-5.6 Sol:${input.reasoningEffort}`,
    provider_job_id: input.turn.checkpoint.canonicalConversationUrl,
    provider_execution_id: input.turn.checkpoint.submitExactCallIdentityHash,
    provider_lease_id: input.turn.checkpoint.submitEvidenceRef,
    model_identity_proof_json: input.turn.modelIdentityProofJson,
    model_identity_proof_hash: input.turn.modelIdentityProofHash,
    reasoning_effort: input.reasoningEffort,
    conversation_ref: input.turn.checkpoint.canonicalConversationUrl,
    started_at: input.turn.checkpoint.submitTerminalAt,
    completed_at: input.turn.checkpoint.submitTerminalAt,
    context_bundle_hash: input.contextHash,
    request_json: input.requestJson,
    request_hash: sha256(input.requestJson),
    payload_json: input.payloadJson,
    payload_hash: sha256(input.payloadJson),
    provider_transcript_jsonl: providerTranscript,
    provider_transcript_hash: sha256(providerTranscript),
  });
}

function candidatePrompt(context: SharedExecutionContext, role: CandidateRole, requestJson: string): string {
  return [context.productSkill.text, "", `当前职责：${role === "candidate_a" ? "独立候选 A" : "独立候选 B"}。`,
    "只处理下面同一份冻结请求。不得读取或猜测另一候选；不得发布、写仓库或改变源文事实。",
    "逐条生成目标 locale 的自然固定网页文案。保留全部占位符、URL、邮箱、数字百分比、标签、专名与风险强度。",
    "无法安全保真时仍返回机械合法文本，并在 finding_codes 写入稳定问题码；不得省略消息。",
    "冻结请求 JSON：", requestJson,
    "只返回一个 JSON 对象：schema_version=target-language-candidate.v1、locale、context_bundle_hash、items。",
    "items 必须与上下文 message_items 同顺序同数量；每项只能有 message_id、text、finding_codes。不要代码围栏。",
  ].join("\n");
}

function blindMapping(task: WebsiteAgentTask, context: ContextBundle, a: CandidateReceipt, b: CandidateReceipt): BlindMapping {
  const seed = hashCanonical({ job_id: task.job_id, batch_id: context.batch_id,
    context_bundle_hash: a.context_bundle_hash, candidate_a: a.payload_hash, candidate_b: b.payload_hash });
  const aFirst = Number.parseInt(seed.slice(7, 9), 16) % 2 === 0;
  const roles: readonly [CandidateRole, CandidateRole] = aFirst ? ["candidate_a", "candidate_b"] : ["candidate_b", "candidate_a"];
  const receipts = { candidate_a: a, candidate_b: b } as const;
  return Object.freeze({
    schema_version: "target-language-blind-mapping.v1",
    locale: context.locale,
    context_bundle_hash: a.context_bundle_hash,
    first_pass_candidates: roles.map((role, index) => Object.freeze({
      blind_label: `option_${index + 1}_${hashCanonical({ seed, index }).slice(7, 19)}`,
      candidate_role: role,
      candidate_payload_hash: receipts[role].payload_hash,
    })) as unknown as readonly [BlindMappingItem, BlindMappingItem],
    nonce_ref: `nonce:${seed.slice(7)}`,
  });
}

function parseSelector(value: Readonly<Record<string, unknown>>, context: ContextBundle,
  mapping: BlindMapping): SelectorOutput {
  exact(value, ["schema_version", "locale", "pass", "selections"], "LOCALIZATION_STATIC_SELECTOR_FIELDS_INVALID");
  if (value.schema_version !== "target-language-selector-output.v1" || value.locale !== context.locale
    || value.pass !== "first" || !Array.isArray(value.selections)) fail("LOCALIZATION_STATIC_SELECTOR_IDENTITY_INVALID");
  const labels = new Set(mapping.first_pass_candidates.map((item) => item.blind_label));
  const selections = value.selections.map((raw) => {
    const item = objectValue(raw, "LOCALIZATION_STATIC_SELECTOR_ITEM_INVALID");
    exact(item, ["message_id", "selection", "reason_code"], "LOCALIZATION_STATIC_SELECTOR_ITEM_FIELDS_INVALID");
    const selection = stringValue(item.selection, "LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID");
    const reason = stringValue(item.reason_code, "LOCALIZATION_STATIC_SELECTOR_REASON_INVALID");
    if ((!labels.has(selection) && selection !== "identical" && selection !== "blocked")
      || !SELECTION_REASONS.has(reason)) fail("LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID");
    return { message_id: stringValue(item.message_id, "LOCALIZATION_STATIC_SELECTOR_ITEM_INVALID"),
      selection, reason_code: reason };
  });
  if (!sameStrings(selections.map((item) => item.message_id), context.message_items.map((item) => item.message_id))) {
    fail("LOCALIZATION_STATIC_SELECTOR_DENOMINATOR_INVALID");
  }
  return { schema_version: "target-language-selector-output.v1", locale: context.locale,
    pass: "first", selections };
}

function selectorPrompt(context: SharedExecutionContext, selectorInputJson: string): string {
  return [context.productSkill.text, "", "当前职责：独立盲选器。候选身份已隐藏。不得推断生产者，不得重写任何候选文案。",
    "逐条选择更忠实、自然且满足上下文机械合同的 blind_label；字节完全相同可选 identical；不能安全选择则 blocked。",
    "冻结盲选输入 JSON：", selectorInputJson,
    "只返回一个 JSON 对象：schema_version=target-language-selector-output.v1、locale、pass=first、selections。",
    "selections 必须与上下文消息同顺序同数量；每项只能有 message_id、selection、reason_code。不要代码围栏。",
  ].join("\n");
}

async function executeCohort(task: WebsiteAgentTask, execution: SharedExecutionContext,
  input: StaticCatalogInput, cohort: StaticCohort): Promise<Readonly<{
    evidence: Readonly<Record<string, unknown>>;
    selected: readonly CandidateItem[];
    evidenceRefs: readonly string[];
    blocked: boolean;
  }>> {
  const context = parseContext(cohort, input);
  const requestJson = JSON.stringify({
    schema_version: "target-language-candidate-request.v1",
    locale: context.locale,
    context_bundle_json: cohort.context_bundle_json,
    context_bundle_hash: cohort.context_bundle_hash,
    requirements: ["preserve-meaning-and-action", "preserve-typed-placeholders-and-protected-tokens",
      "obey-expression-terminology-format-policies", "return-complete-denominator", "record-blocking-findings"],
  });
  const candidateATurn = await executeIsolatedLocalizationJsonTurn(task, execution, {
    stepId: `${cohort.batch_id}:candidate-a`, sessionSuffix: `${cohort.batch_id}:candidate-a`,
    prompt: candidatePrompt(execution, "candidate_a", requestJson), profile: candidateAProfile,
    reasoningEffort: "xhigh",
  });
  const candidateA = parseCandidate(candidateATurn.value, context, cohort.context_bundle_hash);
  const candidateAJson = JSON.stringify(candidateA);
  const receiptA = candidateReceipt({ role: "candidate_a", reasoningEffort: "xhigh", requestJson,
    contextHash: cohort.context_bundle_hash, payloadJson: candidateAJson, turn: candidateATurn, batchId: cohort.batch_id });
  const candidateBTurn = await executeIsolatedLocalizationJsonTurn(task, execution, {
    stepId: `${cohort.batch_id}:candidate-b`, sessionSuffix: `${cohort.batch_id}:candidate-b`,
    prompt: candidatePrompt(execution, "candidate_b", requestJson), profile: candidateBProfile,
    reasoningEffort: "high",
  });
  const candidateB = parseCandidate(candidateBTurn.value, context, cohort.context_bundle_hash);
  const candidateBJson = JSON.stringify(candidateB);
  const receiptB = candidateReceipt({ role: "candidate_b", reasoningEffort: "high", requestJson,
    contextHash: cohort.context_bundle_hash, payloadJson: candidateBJson, turn: candidateBTurn, batchId: cohort.batch_id });
  const mapping = blindMapping(task, context, receiptA, receiptB);
  const mappingJson = JSON.stringify(mapping);
  const receipts = { candidate_a: receiptA, candidate_b: receiptB } as const;
  const selectorInput = {
    schema_version: "target-language-selector-input.v1",
    locale: context.locale,
    pass: "first",
    review_instructions: ["select-one-anonymous-candidate-per-message", "never-rewrite-candidate-text",
      "use-identical-only-for-byte-identical-text", "block-when-no-safe-selection"],
    context_bundle_json: cohort.context_bundle_json,
    context_bundle_hash: cohort.context_bundle_hash,
    anonymous_candidates: mapping.first_pass_candidates.map((item) => Object.freeze({
      blind_label: item.blind_label,
      payload_json: receipts[item.candidate_role].payload_json,
      payload_hash: receipts[item.candidate_role].payload_hash,
    })),
  };
  const selectorInputJson = JSON.stringify(selectorInput);
  const selectorTurn = await executeIsolatedLocalizationJsonTurn(task, execution, {
    stepId: `${cohort.batch_id}:selector`, sessionSuffix: `${cohort.batch_id}:selector`,
    prompt: selectorPrompt(execution, selectorInputJson), profile: selectorProfile, reasoningEffort: "high",
  });
  const selectorOutput = parseSelector(selectorTurn.value, context, mapping);
  const selectorOutputJson = JSON.stringify(selectorOutput);
  const candidateByRole = { candidate_a: candidateA, candidate_b: candidateB } as const;
  let blocked = false;
  const formalSelections = selectorOutput.selections.map((choice, index) => {
    const a = candidateA.items[index]!;
    const b = candidateB.items[index]!;
    const mapped = mapping.first_pass_candidates.find((item) => item.blind_label === choice.selection)?.candidate_role;
    let selection: FormalSelection;
    if (choice.selection === "identical") {
      if (a.text !== b.text || choice.reason_code !== "identical-byte-match") fail("LOCALIZATION_STATIC_SELECTOR_IDENTICAL_INVALID");
      selection = "identical";
    } else if (choice.selection === "blocked") {
      if (choice.reason_code !== "blocking-finding") fail("LOCALIZATION_STATIC_SELECTOR_BLOCK_INVALID");
      selection = "blocked";
    } else {
      if (!mapped || !["meaning-and-action-preserved", "candidate-quality-preferred"].includes(choice.reason_code)) {
        fail("LOCALIZATION_STATIC_SELECTOR_CHOICE_INVALID");
      }
      selection = mapped;
    }
    const selectedText = selection === "candidate_b" ? b.text : a.text;
    const selectedFindings = selection === "candidate_a" ? a.finding_codes
      : selection === "candidate_b" ? b.finding_codes
        : selection === "identical" && sameStrings(a.finding_codes, b.finding_codes) ? a.finding_codes : [];
    blocked = blocked || selection === "blocked" || selectedFindings.length > 0
      || selection === "identical" && (!sameStrings(a.finding_codes, b.finding_codes) || a.finding_codes.length > 0);
    return { choice: Object.freeze({ message_id: choice.message_id, selection,
      ...(selection === "blocked" ? {} : { selected_text_hash: sha256(selectedText) }),
      reason_code: choice.reason_code }),
    selected: Object.freeze({ message_id: choice.message_id, text: selectedText, finding_codes: selectedFindings }) };
  });
  const selectedPayload: CandidatePayload = Object.freeze({
    schema_version: "target-language-candidate.v1", locale: context.locale,
    context_bundle_hash: cohort.context_bundle_hash,
    items: Object.freeze(formalSelections.map((item) => item.selected)),
  });
  const selectedJson = JSON.stringify(selectedPayload);
  const selectorTranscript = transcript(selectorTurn, selectorOutputJson);
  const selectorBase = {
    selector_ref: `localization-production:${cohort.batch_id}:selector:${selectorTurn.checkpoint.submitExactCallIdentityHash}`,
    provider_ref: "gpt-web-chat",
    model_family_ref: "gpt-5.6",
    model_revision_ref: "GPT-5.6 Sol:high",
    provider_job_id: selectorTurn.checkpoint.canonicalConversationUrl,
    provider_execution_id: selectorTurn.checkpoint.submitExactCallIdentityHash,
    provider_lease_id: selectorTurn.checkpoint.submitEvidenceRef,
    model_identity_proof_json: selectorTurn.modelIdentityProofJson,
    model_identity_proof_hash: selectorTurn.modelIdentityProofHash,
    reasoning_effort: "high",
    conversation_ref: selectorTurn.checkpoint.canonicalConversationUrl,
    started_at: selectorTurn.checkpoint.submitTerminalAt,
    completed_at: selectorTurn.checkpoint.submitTerminalAt,
    first_pass_input_json: selectorInputJson,
    first_pass_input_hash: sha256(selectorInputJson),
    first_pass_payload_json: selectorOutputJson,
    first_pass_payload_hash: sha256(selectorOutputJson),
    first_pass_order: mapping.first_pass_candidates.map((item) => item.candidate_role),
    selections: formalSelections.map((item) => item.choice),
    first_pass_blind_selections: selectorOutput.selections.map((item) => ({ message_id: item.message_id, selection: item.selection })),
    first_pass_provider_transcript_jsonl: selectorTranscript,
    first_pass_provider_transcript_hash: sha256(selectorTranscript),
  };
  const selector = Object.freeze({ ...selectorBase, receipt_hash: sha256(JSON.stringify(selectorBase)) });
  const evidence = Object.freeze({
    schema_version: "target-language-review-evidence.v1",
    locale: context.locale,
    review_mode: "ai_independent_dual_candidate_selector",
    human_linguistic_review: false,
    review_authority_ref: REVIEW_AUTHORITY_REF,
    context_bundle_json: cohort.context_bundle_json,
    context_bundle_hash: cohort.context_bundle_hash,
    candidate_a: receiptA,
    candidate_b: receiptB,
    blind_mapping_json: mappingJson,
    blind_mapping_hash: sha256(mappingJson),
    selector,
    selected_catalog_json: selectedJson,
    selected_catalog_hash: sha256(selectedJson),
    decision: blocked ? "blocked" : "production_approved",
  });
  return Object.freeze({ evidence, selected: selectedPayload.items,
    evidenceRefs: Object.freeze([...candidateATurn.evidenceRefs, ...candidateBTurn.evidenceRefs, ...selectorTurn.evidenceRefs]),
    blocked });
}

export const executeStaticCatalogFlow = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  if (task.product_id !== "localization_static_catalog" || task.action_id !== "produce_locale_catalog"
    || context.materials.length !== 1 || context.materials[0]?.role !== "static_catalog_input") {
    fail("LOCALIZATION_STATIC_OWNER_MISMATCH");
  }
  const material = context.materials[0]!;
  const bytes = await readFile(material.local_path);
  if (bytes.byteLength !== material.bytes || sha256(bytes) !== material.sha256) fail("LOCALIZATION_STATIC_MATERIAL_MISMATCH");
  const input = parseInput(JSON.parse(bytes.toString("utf8")) as unknown, task);
  const results: Awaited<ReturnType<typeof executeCohort>>[] = [];
  for (const cohort of input.context_bundles) results.push(await executeCohort(task, context, input, cohort));
  const selectedMessages = Object.freeze(results.flatMap((result) => result.selected));
  const payload = Object.freeze({
    schema_version: "localization-static-catalog-result.v1",
    action_id: "localization_static_catalog",
    source_resource_id: input.source_resource_id,
    source_version: input.source_version,
    source_sha256: input.source_sha256,
    target_locale: input.target_locale,
    policy_version: input.policy_version,
    message_count: selectedMessages.length,
    cohort_results: Object.freeze(results.map((result) => result.evidence)),
    selected_messages: selectedMessages,
    selected_catalog_hash: hashCanonical(selectedMessages),
    decision: results.some((result) => result.blocked) ? "blocked" : "production_approved",
  });
  if (payload.message_count !== input.expected_message_count) fail("LOCALIZATION_STATIC_RESULT_DENOMINATOR_INVALID");
  return context.complete({ payload,
    evidence_refs: Object.freeze(results.flatMap((result) => result.evidenceRefs)) });
};
