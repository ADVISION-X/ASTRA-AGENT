import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";

const TARGET_LOCALES = new Set(["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"]);
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

export interface ContextBundle {
  readonly schema_version: "target-language-context-bundle.v3";
  readonly message_syntax: "typed-placeholder-v1";
  readonly review_kind: "target_language_translation";
  readonly locale: TargetLocale;
  readonly source_locale: "zh-CN";
  readonly source_catalog_hash: ProductionHash;
  readonly batch_id: string;
  readonly cohort_id: string;
  readonly cohort_message_ids: readonly string[];
  readonly ordered_pending_ids_hash: ProductionHash;
  readonly read_only_siblings: readonly Readonly<{
    message_id: string;
    source_text: string;
    source_hash: ProductionHash;
    text: string;
    text_hash: ProductionHash;
    origin_hash: ProductionHash;
  }>[];
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
  readonly context_bundles: readonly [StaticCohort];
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

function parseJsonObject(value: string, code: string): Record<string, unknown> {
  try { return objectValue(JSON.parse(value) as unknown, code); } catch { return fail(code); }
}

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

export function parseContext(cohort: StaticCohort, input: StaticCatalogInput): ContextBundle {
  if (sha256(cohort.context_bundle_json) !== cohort.context_bundle_hash) fail("LOCALIZATION_STATIC_CONTEXT_HASH_INVALID");
  const raw = parseJsonObject(cohort.context_bundle_json, "LOCALIZATION_STATIC_CONTEXT_JSON_INVALID");
  if (!raw.public_value_binding) fail("LOCALIZATION_PUBLIC_VALUE_CONTEXT_MISSING");
  exact(raw, ["schema_version", "message_syntax", "review_kind", "locale", "source_locale", "source_catalog_hash",
    "batch_id", "cohort_id", "cohort_message_ids", "ordered_pending_ids_hash", "read_only_siblings",
    "expression_policy_hash", "expression_policy_json", "terminology_hash", "terminology_json",
    "format_policy_hash", "format_policy_source", "public_value_binding", "message_items"],
  "LOCALIZATION_STATIC_CONTEXT_FIELDS_INVALID");
  const rawItems = Array.isArray(raw.message_items) ? raw.message_items : [];
  if (![raw.schema_version === "target-language-context-bundle.v3", raw.message_syntax === "typed-placeholder-v1",
    raw.review_kind === "target_language_translation", raw.locale === input.target_locale, raw.source_locale === "zh-CN",
    raw.source_catalog_hash === input.source_sha256, raw.batch_id === cohort.batch_id,
    rawItems.length === cohort.message_count, rawItems.length > 0].every(Boolean)) fail("LOCALIZATION_STATIC_CONTEXT_IDENTITY_INVALID");
  for (const pair of [[raw.expression_policy_json, raw.expression_policy_hash],
    [raw.terminology_json, raw.terminology_hash], [raw.format_policy_source, raw.format_policy_hash]] as const) {
    if (typeof pair[0] !== "string" || sha256(pair[0]) !== pair[1]) fail("LOCALIZATION_STATIC_POLICY_HASH_INVALID");
  }
  const items = rawItems.map(parseContextItem);
  if (new Set(items.map((item) => item.message_id)).size !== items.length) fail("LOCALIZATION_STATIC_MESSAGE_ID_INVALID");
  const pendingHash = hashCanonical(items.map((item) => item.message_id));
  if (raw.ordered_pending_ids_hash !== pendingHash) fail("LOCALIZATION_STATIC_PENDING_IDS_HASH_INVALID");
  if (!Array.isArray(raw.read_only_siblings)) fail("LOCALIZATION_STATIC_SIBLINGS_INVALID");
  const siblings = raw.read_only_siblings.map((entry) => {
    const sibling = objectValue(entry, "LOCALIZATION_STATIC_SIBLINGS_INVALID");
    exact(sibling, ["message_id", "source_text", "source_hash", "text", "text_hash", "origin_hash"],
      "LOCALIZATION_STATIC_SIBLINGS_INVALID");
    const sourceText = stringValue(sibling.source_text, "LOCALIZATION_STATIC_SIBLINGS_INVALID");
    const targetText = stringValue(sibling.text, "LOCALIZATION_STATIC_SIBLINGS_INVALID");
    if (sibling.source_hash !== sha256(sourceText) || sibling.text_hash !== sha256(targetText)) {
      fail("LOCALIZATION_STATIC_SIBLINGS_INVALID");
    }
    return { message_id: stringValue(sibling.message_id, "LOCALIZATION_STATIC_SIBLINGS_INVALID"),
      source_text: sourceText, source_hash: sibling.source_hash as ProductionHash, text: targetText,
      text_hash: sibling.text_hash as ProductionHash,
      origin_hash: hashValue(sibling.origin_hash, "LOCALIZATION_STATIC_SIBLINGS_INVALID") };
  });
  const allIds = [...items.map((item) => item.message_id), ...siblings.map((item) => item.message_id)];
  if (new Set(allIds).size !== allIds.length) fail("LOCALIZATION_STATIC_SIBLINGS_INVALID");
  const cohortIds = stringArray(raw.cohort_message_ids, "LOCALIZATION_STATIC_COHORT_IDENTITY_INVALID");
  if (new Set(cohortIds).size !== cohortIds.length
    || !sameStrings([...cohortIds].sort(), [...allIds].sort())) {
    fail("LOCALIZATION_STATIC_COHORT_IDENTITY_INVALID");
  }
  const sourceCatalogHash = hashValue(raw.source_catalog_hash, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID");
  return {
    schema_version: "target-language-context-bundle.v3", message_syntax: "typed-placeholder-v1",
    review_kind: "target_language_translation", locale: input.target_locale, source_locale: "zh-CN",
    source_catalog_hash: sourceCatalogHash,
    batch_id: stringValue(raw.batch_id, "LOCALIZATION_STATIC_BATCH_ID_INVALID"),
    cohort_id: stringValue(raw.cohort_id, "LOCALIZATION_STATIC_COHORT_ID_INVALID"),
    cohort_message_ids: cohortIds,
    ordered_pending_ids_hash: hashValue(raw.ordered_pending_ids_hash, "LOCALIZATION_STATIC_PENDING_IDS_HASH_INVALID"),
    read_only_siblings: siblings,
    expression_policy_hash: hashValue(raw.expression_policy_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    expression_policy_json: stringValue(raw.expression_policy_json, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    terminology_hash: hashValue(raw.terminology_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    terminology_json: stringValue(raw.terminology_json, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    format_policy_hash: hashValue(raw.format_policy_hash, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    format_policy_source: stringValue(raw.format_policy_source, "LOCALIZATION_STATIC_POLICY_HASH_INVALID"),
    public_value_binding: parsePublicValueBinding(raw.public_value_binding, items, sourceCatalogHash),
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
    || !Number.isSafeInteger(input.expected_message_count) || Number(input.expected_message_count) < 1
    || !Array.isArray(input.context_bundles) || input.context_bundles.length !== 1) {
    fail("LOCALIZATION_STATIC_INPUT_IDENTITY_INVALID");
  }
  for (const key of ["target_locale", "source_resource_id", "source_version", "source_sha256", "policy_version"] as const) {
    if (input[key] !== task.parameters[key]) fail("LOCALIZATION_STATIC_TASK_INPUT_MISMATCH");
  }
  const rawCohort = objectValue(input.context_bundles[0], "LOCALIZATION_STATIC_COHORT_INVALID");
  exact(rawCohort, ["batch_id", "context_bundle_json", "context_bundle_hash", "message_count"],
    "LOCALIZATION_STATIC_COHORT_FIELDS_INVALID");
  if (!Number.isSafeInteger(rawCohort.message_count) || Number(rawCohort.message_count) < 1) {
    fail("LOCALIZATION_STATIC_COHORT_COUNT_INVALID");
  }
  const cohort: StaticCohort = {
    batch_id: stringValue(rawCohort.batch_id, "LOCALIZATION_STATIC_BATCH_ID_INVALID"),
    context_bundle_json: stringValue(rawCohort.context_bundle_json, "LOCALIZATION_STATIC_CONTEXT_JSON_INVALID"),
    context_bundle_hash: hashValue(rawCohort.context_bundle_hash, "LOCALIZATION_STATIC_CONTEXT_HASH_INVALID"),
    message_count: Number(rawCohort.message_count),
  };
  const parsed: StaticCatalogInput = {
    schema_version: "localization-static-catalog-input.v1",
    target_locale: input.target_locale as TargetLocale,
    source_resource_id: "website-fixed-copy-catalog",
    source_sha256: hashValue(input.source_sha256, "LOCALIZATION_STATIC_SOURCE_HASH_INVALID"),
    source_version: stringValue(input.source_version, "LOCALIZATION_STATIC_SOURCE_VERSION_INVALID"),
    policy_version: stringValue(input.policy_version, "LOCALIZATION_STATIC_POLICY_VERSION_INVALID"),
    expected_message_count: Number(input.expected_message_count),
    context_bundles: [cohort],
  };
  const context = parseContext(cohort, parsed);
  if (context.message_items.length !== parsed.expected_message_count) fail("LOCALIZATION_STATIC_INPUT_DENOMINATOR_INVALID");
  if (context.cohort_id !== task.parameters.cohort_id
    || context.ordered_pending_ids_hash !== task.parameters.ordered_pending_ids_hash) {
    fail("LOCALIZATION_STATIC_TASK_INPUT_MISMATCH");
  }
  return parsed;
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
