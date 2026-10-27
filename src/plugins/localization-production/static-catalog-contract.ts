import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { isDeepStrictEqual } from "node:util";
import type { LocalizationReference } from "./material-archives.js";
const HASH = /^sha256:[a-f0-9]{64}$/u;
const PUBLIC_VALUE_AUTHORITY_REFS = ["LAW-PROJECT-GOVERNANCE-010-V1", "LAW-USER-VALUE-INTERFACE-001-V4"] as const;
const PUBLIC_VALUE_AUTHORITY_HASHES = [
  "sha256:79f430599798e5bb10d73dd70cd32dfa1b4254709a99f32c363e82b06679fbd3",
  "sha256:b9e9f7f3af6fc703577c07906e1c096bb091995d29f3356af44b976258b0d6f1",
] as const;

type TargetLocale = "zh-HK" | "zh-TW" | "en-US" | "ja-JP" | "ko-KR";

interface ContextItem {
  readonly message_id: string;
  readonly semantic_owner: string;
  readonly surface_ref: string;
  readonly surface_source_refs: readonly string[];
  readonly source_text: string;
  readonly source_hash: ProductionHash;
  readonly parameter_schema: readonly string[];
  readonly parameter_types: readonly Readonly<{ name: string; type: string }>[];
  readonly protected_tokens: readonly string[];
  readonly max_graphemes: number | null;
  readonly allow_wrapping: boolean;
  readonly failure_code: string | null;
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

type Sibling = Readonly<{ message_id: string; source_text: string; source_hash: ProductionHash;
  text: string | null; text_hash: ProductionHash | null; origin_hash: ProductionHash | null }>;
export interface ContextBundle {
  readonly schema_version: "target-language-context-bundle.v4";
  readonly locale: TargetLocale;
  readonly source_catalog_hash: ProductionHash;
  readonly batch_id: string;
  readonly cohort_id: string;
  readonly cohort_message_ids: readonly string[];
  readonly ordered_pending_ids_hash: ProductionHash;
  readonly read_only_siblings: readonly Sibling[];
  readonly public_value_binding: PublicValueBinding;
  readonly message_items: readonly ContextItem[];
  readonly [key: string]: unknown;
}

export interface CandidateItem {
  readonly message_id: string;
  readonly text?: unknown;
}

export interface CandidatePayload {
  readonly schema_version: "target-language-candidate.v3";
  readonly locale: TargetLocale;
  readonly context_bundle_hash: ProductionHash;
  readonly items: readonly CandidateItem[];
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
const canonicalApprovalRef = (sourceCatalogHash: ProductionHash): string =>
  `content/zh-CN/locales/messages.json#production-approved-${sourceCatalogHash}`;

export function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function templateParameterNames(value: string): readonly string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/gu)].map((match) => match[1]!).sort();
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
  if (candidate.failure_code !== null && (typeof candidate.failure_code !== "string"
    || !/^[A-Z][A-Z0-9_]*$/u.test(candidate.failure_code))) fail("LOCALIZATION_STATIC_FAILURE_CODE_INVALID");
  if (candidate.correction_ref !== null && (typeof candidate.correction_ref !== "string"
    || !candidate.correction_ref.trim())) fail("LOCALIZATION_STATIC_CORRECTION_REF_INVALID");
  return { ...candidate, message_id: stringValue(candidate.message_id, "LOCALIZATION_STATIC_MESSAGE_ID_INVALID"),
    semantic_owner: stringValue(candidate.semantic_owner, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    surface_ref: stringValue(candidate.surface_ref, "LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING"),
    surface_source_refs: surfaceSourceRefs,
    source_text: sourceText, source_hash: sourceHash, parameter_schema: parameterSchema, parameter_types: parameterTypes,
    protected_tokens: stringArray(candidate.protected_tokens, "LOCALIZATION_STATIC_PROTECTED_TOKEN_INVALID"),
    max_graphemes: candidate.max_graphemes as number | null, allow_wrapping: candidate.allow_wrapping,
    failure_code: candidate.failure_code as string | null } as ContextItem;
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
    || !["not_present", "approved_disclosure_only"].includes(String(binding.tool_role))) {
    fail("LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  }
  return { schema_version: "target-language-public-value-binding.v1", authority_refs: authorityRefs,
    authority_hashes: authorityHashes, canonical_approval_ref: canonicalRef, source_owner_refs: sourceOwnerRefs,
    visible_evidence_refs: visibleEvidenceRefs, tool_role: binding.tool_role as PublicValueBinding["tool_role"] };
}

function parseSibling(value: unknown): Sibling {
  const code = "LOCALIZATION_STATIC_SIBLINGS_INVALID", raw = objectValue(value, code);
  exact(raw, ["message_id", "source_text", "source_hash", "text", "text_hash", "origin_hash"], code);
  const sourceText = stringValue(raw.source_text, code), sourceHash = hashValue(raw.source_hash, code);
  if (sha256(sourceText) !== sourceHash) fail(code);
  const nullable = [raw.text, raw.text_hash, raw.origin_hash];
  const allNull = nullable.every(item => item === null);
  if (!allNull && nullable.some(item => item === null)) fail(code);
  const target = allNull ? null : stringValue(raw.text, code);
  if (target !== null && raw.text_hash !== sha256(target)) fail(code);
  return { message_id: stringValue(raw.message_id, code), source_text: sourceText, source_hash: sourceHash,
    text: target, text_hash: allNull ? null : hashValue(raw.text_hash, code),
    origin_hash: allNull ? null : hashValue(raw.origin_hash, code) };
}

function checkPolicies(raw: Record<string, unknown>, reference: LocalizationReference): void {
  const refs = objectValue(raw.policy_refs, "LOCALIZATION_STATIC_POLICY_REF_INVALID");
  exact(refs, ["terminology", "locale_policy", "render_policy"], "LOCALIZATION_STATIC_POLICY_REF_INVALID");
  for (const [key, hashKey] of [["terminology", "terminology_hash"], ["locale_policy", "expression_policy_hash"],
    ["render_policy", "format_policy_hash"]] as const) {
    if (refs[key] !== `本地化依据/语言政策/${key}.txt` || typeof reference[key] !== "string"
      || raw[hashKey] !== sha256(reference[key] as string)) fail("LOCALIZATION_STATIC_POLICY_HASH_INVALID");
  }
  const expected = reference.product_sources.map(({ utf8_text: _text, ...identity }) => identity);
  if (!isDeepStrictEqual(raw.product_source_refs, expected)) fail("LOCALIZATION_STATIC_PRODUCT_REFS_INVALID");
}

function backgroundSources(values: readonly unknown[]): ReadonlyMap<string, Record<string, unknown>> {
  const code = "LOCALIZATION_STATIC_BACKGROUND_INVALID";
  const sources = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    const source = objectValue(value, code), id = stringValue(source.message_id, code);
    exact(source, ["message_id", "text", "semantic_owner", "parameter_schema", "source_hash", "occurrences", "product_context", "current_target"], code);
    if (sources.has(id) || source.source_hash !== sha256(stringValue(source.text, code))) fail(code);
    stringValue(source.semantic_owner, code); stringArray(source.parameter_schema, code);
    if (!Array.isArray(source.occurrences)) fail(code);
    if (source.current_target !== null) {
      const target = objectValue(source.current_target, code); exact(target, ["text", "text_hash", "origin_hash"], code);
      if (target.text_hash !== sha256(stringValue(target.text, code))) fail(code);
      hashValue(target.origin_hash, code);
    }
    sources.set(id, source);
  }
  return sources;
}

function checkBackground(raw: Record<string, unknown>, items: readonly ContextItem[], siblings: readonly Sibling[]): void {
  const code = "LOCALIZATION_STATIC_BACKGROUND_INVALID";
  if (!Array.isArray(raw.source_items) || !Array.isArray(raw.page_contexts) || !raw.page_contexts.length) fail(code);
  const sources = backgroundSources(raw.source_items);
  const covered = new Set<string>();
  for (const value of raw.page_contexts) {
    const page = objectValue(value, code); exact(page, ["kind", "surface_ref", "source_refs", "ordered_message_ids"], code);
    if (!["web_page", "operation_unit"].includes(String(page.kind)) || !stringArray(page.source_refs, code).length) fail(code);
    stringValue(page.surface_ref, code);
    const ids = stringArray(page.ordered_message_ids, code);
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !sources.has(id))) fail(code);
    ids.forEach(id => covered.add(id));
  }
  if (!sameStrings([...covered].sort(), [...sources.keys()].sort())) fail(code);
  for (const item of [...items, ...siblings]) {
    const source = sources.get(item.message_id);
    if (!source || source.text !== item.source_text || source.source_hash !== item.source_hash) fail(code);
  }
}

export function parseContext(value: unknown, reference: LocalizationReference, task: WebsiteAgentTask): ContextBundle {
  const raw = objectValue(value, "LOCALIZATION_STATIC_CONTEXT_INVALID");
  exact(raw, ["schema_version", "message_syntax", "review_kind", "locale", "source_locale", "source_catalog_hash",
    "batch_id", "cohort_id", "cohort_message_ids", "ordered_pending_ids_hash", "read_only_siblings", "expression_policy_hash",
    "terminology_hash", "format_policy_hash", "policy_refs", "product_source_refs", "page_contexts", "source_items",
    "public_value_binding", "message_items"], "LOCALIZATION_STATIC_CONTEXT_FIELDS_INVALID");
  if (raw.schema_version !== "target-language-context-bundle.v4" || raw.message_syntax !== "typed-placeholder-v1"
    || raw.review_kind !== "target_language_translation" || raw.source_locale !== "zh-CN" || raw.locale !== reference.target_locale
    || raw.source_catalog_hash !== reference.source_identity.source_sha256 || raw.cohort_id !== task.parameters.cohort_id
    || raw.ordered_pending_ids_hash !== task.parameters.ordered_pending_ids_hash
    || !Array.isArray(raw.message_items) || !raw.message_items.length || !Array.isArray(raw.read_only_siblings)) {
    fail("LOCALIZATION_STATIC_CONTEXT_IDENTITY_INVALID");
  }
  checkPolicies(raw, reference);
  const items = raw.message_items.map(parseContextItem), siblings = raw.read_only_siblings.map(parseSibling);
  const ids = [...items.map(item => item.message_id), ...siblings.map(item => item.message_id)];
  const cohortIds = stringArray(raw.cohort_message_ids, "LOCALIZATION_STATIC_COHORT_IDENTITY_INVALID");
  if (new Set(ids).size !== ids.length || new Set(cohortIds).size !== cohortIds.length
    || !sameStrings([...cohortIds].sort(), [...ids].sort())
    || raw.ordered_pending_ids_hash !== hashCanonical(items.map(item => item.message_id))) fail("LOCALIZATION_STATIC_COHORT_IDENTITY_INVALID");
  checkBackground(raw, items, siblings);
  const sourceHash = hashValue(raw.source_catalog_hash, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID");
  return { ...raw, schema_version: "target-language-context-bundle.v4", locale: reference.target_locale as TargetLocale,
    source_catalog_hash: sourceHash, batch_id: stringValue(raw.batch_id, "LOCALIZATION_STATIC_BATCH_ID_INVALID"),
    cohort_id: stringValue(raw.cohort_id, "LOCALIZATION_STATIC_COHORT_IDENTITY_INVALID"), cohort_message_ids: cohortIds,
    ordered_pending_ids_hash: hashValue(raw.ordered_pending_ids_hash, "LOCALIZATION_STATIC_PENDING_IDS_HASH_INVALID"),
    read_only_siblings: siblings, public_value_binding: parsePublicValueBinding(raw.public_value_binding, items, sourceHash), message_items: items };
}

export function parseCandidate(
  value: Readonly<Record<string, unknown>>,
  context: ContextBundle,
  contextHash: ProductionHash,
): CandidatePayload {
  exact(value, ["schema_version", "locale", "context_bundle_hash", "items"], "LOCALIZATION_STATIC_CANDIDATE_FIELDS_INVALID");
  if (value.schema_version !== "target-language-candidate.v3" || value.locale !== context.locale
    || value.context_bundle_hash !== contextHash || !Array.isArray(value.items)) {
    fail("LOCALIZATION_STATIC_CANDIDATE_IDENTITY_INVALID");
  }
  // Website owns the only message identity and field mechanics verdict.
  const items = value.items as CandidateItem[];
  return { schema_version: "target-language-candidate.v3", locale: context.locale,
    context_bundle_hash: contextHash, items };
}
