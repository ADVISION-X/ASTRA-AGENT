import {
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";

const TARGET_LOCALES = new Set(["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"]);
const HASH = /^sha256:[a-f0-9]{64}$/u;
const STATIC_POLICY_VERSION = "target-language-review-v4-20260914";
const PUBLIC_VALUE_AUTHORITY_REFS = ["LAW-PROJECT-GOVERNANCE-010-V1", "LAW-USER-VALUE-INTERFACE-001-V4"] as const;
const PUBLIC_VALUE_AUTHORITY_HASHES = [
  "sha256:79f430599798e5bb10d73dd70cd32dfa1b4254709a99f32c363e82b06679fbd3",
  "sha256:b9e9f7f3af6fc703577c07906e1c096bb091995d29f3356af44b976258b0d6f1",
] as const;
export const SELECTOR_REASON_CODES = Object.freeze({
  blind_label: Object.freeze(["meaning-and-action-preserved", "candidate-quality-preferred"]), identical: Object.freeze(["identical-byte-match"]),
  blocked: Object.freeze(["blocking-finding"]),
} as const);

type TargetLocale = "zh-HK" | "zh-TW" | "en-US" | "ja-JP" | "ko-KR";
export type CandidateRole = "candidate_a" | "candidate_b";
export type FormalSelection = CandidateRole | "identical" | "blocked";

interface ContextItem {
  readonly message_id: string;
  readonly semantic_owner: string;
  readonly surface_ref: string;
  readonly surface_source_refs: readonly string[];
  readonly audience: string;
  readonly user_action: string;
  readonly user_outcome: string;
  readonly source_text: string;
  readonly source_hash: ProductionHash;
  readonly parameter_schema: readonly string[];
  readonly parameter_types: readonly Readonly<{ name: string; type: string }>[];
  readonly protected_tokens: readonly string[];
  readonly max_graphemes: number | null;
  readonly allow_wrapping: boolean;
  readonly [key: string]: unknown;
}

interface PublicValueBinding {
  readonly schema_version: "target-language-public-value-binding.v1";
  readonly authority_refs: readonly string[];
  readonly authority_hashes: readonly string[];
  readonly canonical_approval_ref: string;
  readonly source_owner_refs: readonly string[];
  readonly visible_evidence_refs: readonly string[];
  readonly tool_role: "not_present" | "approved_disclosure_only";
}

export interface ContextBundle {
  readonly schema_version: "target-language-context-bundle.v2";
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
  readonly public_value_binding: PublicValueBinding;
  readonly message_items: readonly ContextItem[];
}

export interface StaticCohort {
  readonly batch_id: string;
  readonly context_bundle_json: string;
  readonly context_bundle_hash: ProductionHash;
  readonly message_count: number;
}

export interface StaticCatalogInput {
  readonly schema_version: "localization-static-catalog-input.v1";
  readonly target_locale: TargetLocale;
  readonly source_resource_id: "website-fixed-copy-catalog";
  readonly source_version: string;
  readonly source_sha256: ProductionHash;
  readonly policy_version: string;
  readonly expected_message_count: number;
  readonly context_bundles: readonly StaticCohort[];
}

export interface CandidateItem {
  readonly message_id: string;
  readonly text: string;
  readonly finding_codes: readonly string[];
}

export interface CandidatePayload {
  readonly schema_version: "target-language-candidate.v1";
  readonly locale: TargetLocale;
  readonly context_bundle_hash: ProductionHash;
  readonly items: readonly CandidateItem[];
}

export interface CandidateReceipt {
  readonly role: CandidateRole;
  readonly context_bundle_hash: ProductionHash;
  readonly payload_json: string;
  readonly payload_hash: ProductionHash;
}

export interface BlindMappingItem {
  readonly blind_label: string;
  readonly candidate_role: CandidateRole;
  readonly candidate_payload_hash: ProductionHash;
}

export interface BlindMapping {
  readonly schema_version: "target-language-blind-mapping.v1";
  readonly locale: TargetLocale;
  readonly context_bundle_hash: ProductionHash;
  readonly first_pass_candidates: readonly [BlindMappingItem, BlindMappingItem];
  readonly nonce_ref: string;
}

export interface SelectorOutput {
  readonly schema_version: "target-language-selector-output.v1";
  readonly locale: TargetLocale;
  readonly pass: "first";
  readonly selections: readonly Readonly<{ message_id: string; selection: string; reason_code: string }>[];
}

export function selectorReasonAllowed(selection: string, reason: string, labels: ReadonlySet<string>): boolean {
  const kind = labels.has(selection) ? "blind_label" : selection === "identical" || selection === "blocked" ? selection : null;
  return kind !== null && SELECTOR_REASON_CODES[kind].some((code) => code === reason);
}

export function fail(code: string): never {
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

const sortedUnique = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();
const toolRole = (items: readonly ContextItem[]): PublicValueBinding["tool_role"] =>
  items.some((item) => /\b(?:AI|AGENT|GPT|Provider|Browser|Runtime)\b|人工智能|模型/iu.test(item.source_text))
    ? "approved_disclosure_only" : "not_present";
const canonicalApprovalRef = (sourceCatalogHash: ProductionHash): string =>
  `content/zh-CN/locales/messages.json#production-approved-${sourceCatalogHash}`;

function parseJsonObject(value: string, code: string): Record<string, unknown> {
  try { return objectValue(JSON.parse(value) as unknown, code); } catch { return fail(code); }
}

export function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function templateParameterNames(value: string): readonly string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/gu)]
    .map((match) => match[1]!)
    .sort();
}

function protectedOccurrenceCount(value: string, token: string): number {
  return token ? value.split(token).length - 1 : 0;
}

function assertPunctuation(locale: TargetLocale, value: string, protectedTokens: readonly string[]): void {
  if (!TARGET_LOCALES.has(locale) || !["zh-HK", "zh-TW", "ja-JP"].includes(locale)) return;
  const cjk = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}";
  const text = protectedTokens.reduce((current, token) => current.split(token).join(""), value);
  if (/\.\.\./u.test(text) || new RegExp(`[${cjk}][,;!?](?=[${cjk}]|$)`, "u").test(text)) {
    fail("LOCALIZATION_STATIC_CANDIDATE_PUNCTUATION_INVALID");
  }
}

function assertCandidateText(context: ContextItem, locale: TargetLocale, text: string): void {
  const schema = [...context.parameter_schema].sort();
  if (!sameStrings(templateParameterNames(text), schema)
    || context.protected_tokens.some((token) =>
      protectedOccurrenceCount(text, token) !== protectedOccurrenceCount(context.source_text, token))) {
    fail("LOCALIZATION_STATIC_CANDIDATE_MECHANICS_INVALID");
  }
  if (context.max_graphemes !== null
    && [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)].length > context.max_graphemes) {
    fail("LOCALIZATION_STATIC_CANDIDATE_LENGTH_INVALID");
  }
  assertPunctuation(locale, text, context.protected_tokens);
}

function parseContextItem(value: unknown): ContextItem {
  const candidate = objectValue(value, "LOCALIZATION_STATIC_CONTEXT_ITEM_INVALID");
  const parameterSchema = stringArray(candidate.parameter_schema, "LOCALIZATION_STATIC_PARAMETER_SCHEMA_INVALID");
  const parameterTypes = Array.isArray(candidate.parameter_types) ? candidate.parameter_types.map((entry) => {
    const parameter = objectValue(entry, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID");
    return { name: stringValue(parameter.name, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID"),
      type: stringValue(parameter.type, "LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID") };
  }) : fail("LOCALIZATION_STATIC_PARAMETER_TYPE_INVALID");
  const sourceText = stringValue(candidate.source_text, "LOCALIZATION_STATIC_SOURCE_TEXT_INVALID");
  const sourceHash = hashValue(candidate.source_hash, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID");
  const surfaceSourceRefs = stringArray(candidate.surface_source_refs, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  if (surfaceSourceRefs.length === 0) fail("LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  if (sourceHash !== sha256(sourceText)
    || !sameStrings([...parameterSchema].sort(), parameterTypes.map((entry) => entry.name).sort())
    || !sameStrings(templateParameterNames(sourceText), [...parameterSchema].sort())
    || !Number.isSafeInteger(candidate.max_graphemes) && candidate.max_graphemes !== null
    || typeof candidate.allow_wrapping !== "boolean") fail("LOCALIZATION_STATIC_SOURCE_MECHANICS_INVALID");
  return { ...candidate, message_id: stringValue(candidate.message_id, "LOCALIZATION_STATIC_MESSAGE_ID_INVALID"),
    semantic_owner: stringValue(candidate.semantic_owner, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    surface_ref: stringValue(candidate.surface_ref, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    surface_source_refs: surfaceSourceRefs,
    audience: stringValue(candidate.audience, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    user_action: stringValue(candidate.user_action, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    user_outcome: stringValue(candidate.user_outcome, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    source_text: sourceText, source_hash: sourceHash, parameter_schema: parameterSchema, parameter_types: parameterTypes,
    protected_tokens: stringArray(candidate.protected_tokens, "LOCALIZATION_STATIC_PROTECTED_TOKEN_INVALID"),
    max_graphemes: candidate.max_graphemes as number | null, allow_wrapping: candidate.allow_wrapping } as ContextItem;
}

function parsePublicValueBinding(value: unknown, items: readonly ContextItem[], sourceCatalogHash: ProductionHash): PublicValueBinding {
  const binding = objectValue(value, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  exact(binding, ["schema_version", "authority_refs", "authority_hashes", "canonical_approval_ref",
    "source_owner_refs", "visible_evidence_refs", "tool_role"], "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  const authorityRefs = stringArray(binding.authority_refs, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  const authorityHashes = stringArray(binding.authority_hashes, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  const sourceOwnerRefs = stringArray(binding.source_owner_refs, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  const visibleEvidenceRefs = stringArray(binding.visible_evidence_refs, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  const canonicalRef = stringValue(binding.canonical_approval_ref, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  if (binding.schema_version !== "target-language-public-value-binding.v1"
    || !sameStrings(authorityRefs, PUBLIC_VALUE_AUTHORITY_REFS) || !sameStrings(authorityHashes, PUBLIC_VALUE_AUTHORITY_HASHES)
    || canonicalRef !== canonicalApprovalRef(sourceCatalogHash)
    || !sameStrings(sourceOwnerRefs, sortedUnique(items.map((item) => item.semantic_owner)))
    || !sameStrings(visibleEvidenceRefs, sortedUnique(items.map((item) => item.surface_ref)))
    || binding.tool_role !== toolRole(items)) fail("LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  return { schema_version: "target-language-public-value-binding.v1", authority_refs: authorityRefs,
    authority_hashes: authorityHashes, canonical_approval_ref: canonicalRef, source_owner_refs: sourceOwnerRefs,
    visible_evidence_refs: visibleEvidenceRefs, tool_role: binding.tool_role as PublicValueBinding["tool_role"] };
}

export function parseContext(cohort: StaticCohort, input: StaticCatalogInput): ContextBundle {
  if (sha256(cohort.context_bundle_json) !== cohort.context_bundle_hash) fail("LOCALIZATION_STATIC_CONTEXT_HASH_INVALID");
  const raw = parseJsonObject(cohort.context_bundle_json, "LOCALIZATION_STATIC_CONTEXT_JSON_INVALID");
  if (!raw.public_value_binding) fail("LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  exact(raw, ["schema_version", "message_syntax", "review_kind", "locale", "source_locale", "source_catalog_hash",
    "batch_id", "expression_policy_hash", "expression_policy_json", "terminology_hash", "terminology_json",
    "format_policy_hash", "format_policy_source", "public_value_binding", "message_items"],
  "LOCALIZATION_STATIC_CONTEXT_FIELDS_INVALID");
  if (raw.schema_version !== "target-language-context-bundle.v2"
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
  const items = raw.message_items.map(parseContextItem);
  const ids = items.map((item) => item.message_id);
  if (new Set(ids).size !== ids.length) fail("LOCALIZATION_STATIC_MESSAGE_ID_INVALID");
  const sourceCatalogHash=hashValue(raw.source_catalog_hash, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID");
  const binding = parsePublicValueBinding(raw.public_value_binding, items, sourceCatalogHash);
  return {
    schema_version: "target-language-context-bundle.v2",
    message_syntax: "typed-placeholder-v1",
    review_kind: "target_language_translation",
    locale: input.target_locale,
    source_locale: "zh-CN",
    source_catalog_hash: sourceCatalogHash,
    batch_id: stringValue(raw.batch_id, "LOCALIZATION_STATIC_BATCH_ID_INVALID"),
    expression_policy_hash: hashValue(raw.expression_policy_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    expression_policy_json: stringValue(raw.expression_policy_json, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    terminology_hash: hashValue(raw.terminology_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    terminology_json: stringValue(raw.terminology_json, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    format_policy_hash: hashValue(raw.format_policy_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    format_policy_source: stringValue(raw.format_policy_source, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    public_value_binding: binding,
    message_items: items,
  };
}

export function parseInput(value: unknown, task: WebsiteAgentTask): StaticCatalogInput {
  const input = objectValue(value, "LOCALIZATION_STATIC_INPUT_INVALID");
  exact(input, ["schema_version", "target_locale", "source_resource_id", "source_version", "source_sha256",
    "policy_version", "expected_message_count", "context_bundles"], "LOCALIZATION_STATIC_INPUT_FIELDS_INVALID");
  if (input.schema_version !== "localization-static-catalog-input.v1"
    || !TARGET_LOCALES.has(String(input.target_locale))
    || input.source_resource_id !== "website-fixed-copy-catalog"
    || input.policy_version !== STATIC_POLICY_VERSION
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

export function parseCandidate(
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

export function parseSelector(value: Readonly<Record<string, unknown>>, context: ContextBundle,
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
    if (!selectorReasonAllowed(selection, reason, labels)) fail("LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID");
    return { message_id: stringValue(item.message_id, "LOCALIZATION_STATIC_SELECTOR_ITEM_INVALID"),
      selection, reason_code: reason };
  });
  if (!sameStrings(selections.map((item) => item.message_id), context.message_items.map((item) => item.message_id))) {
    fail("LOCALIZATION_STATIC_SELECTOR_DENOMINATOR_INVALID");
  }
  return { schema_version: "target-language-selector-output.v1", locale: context.locale,
    pass: "first", selections };
}
