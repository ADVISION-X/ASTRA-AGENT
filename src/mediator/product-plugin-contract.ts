import { createHash } from "node:crypto";

import type {
  GptProviderContinuation,
  ProductGptTools,
} from "../capabilities/gpt/index.js";
import { TypedExecutionFailure, executionFailure } from "../lib/execution-failure.js";

export type ProductionHash = `sha256:${string}`;
export type ProductionProductId = string;
export type ProductionActionId = string;

export type ProductMaterial = Readonly<{
  material_id: string;
  ordinal: number;
  role: string;
  display_name: string;
  object_ref: string;
  sha256: ProductionHash;
  bytes: number;
  media_type: string;
  storage_class: "shared_static" | "private_owner_scoped";
  owner_scope_hash: ProductionHash | null;
  trust_class: "instruction" | "locked_fact" | "nonbinding_prior_interpretation"
    | "user_provided_data" | "classical_source_data" | "transport_evidence";
  may_issue_instruction: boolean;
}>;

export type LocalProductionMaterial = ProductMaterial & Readonly<{ local_path: string }>;

export interface WebsiteAgentTask {
  readonly schema_version: "website-agent-task.v1";
  readonly protocol_version: "xuanxue-ai-production-v6";
  readonly job_id: string;
  readonly source_task_id: string;
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
  readonly idempotency_key: string;
  readonly request_hash: ProductionHash;
  readonly task_contract_id: "website-agent-task";
  readonly task_contract_version: 1;
  readonly business_identity: Readonly<{
    owner_ref: string;
    subject_ref: string;
    authorization_ref: string;
  }>;
  readonly business_context_ref: string;
  readonly business_context_hash: ProductionHash;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly material_refs: readonly ProductMaterial[];
  readonly result_contract_id: "website-agent-result";
  readonly result_contract_version: 1;
  readonly privacy_subject_ref?: string | undefined;
  readonly continuation_ref?: string | undefined;
  readonly parent_task_ref?: string | undefined;
  readonly parent_result_ref?: string | undefined;
  readonly parent_result_hash?: ProductionHash | undefined;
  readonly subject_task_ref?: string | undefined;
  readonly subject_result_ref?: string | undefined;
  readonly subject_result_hash?: ProductionHash | undefined;
  readonly review_policy?: string | undefined;
}

export interface ProductCompletionReceipt {
  readonly schema_version: "website-agent-result.v1";
  readonly job_id: string;
  readonly source_task_id: string;
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
  readonly plugin_id: string;
  readonly plugin_version: number;
  readonly result_contract_id: "website-agent-result";
  readonly result_contract_version: 1;
  readonly result_payload_ref: string;
  readonly result_payload_hash: ProductionHash;
  readonly result_payload_bytes: number;
  readonly result_payload_media_type: string;
  readonly result_object_receipt: Readonly<{
    object_ref: string;
    sha256: ProductionHash;
    bytes: number;
    media_type: string;
    receipt_hash: ProductionHash;
  }>;
  readonly execution_context_object_receipt?: Readonly<{
    object_ref: string;
    sha256: ProductionHash;
    bytes: number;
    media_type: "application/json";
    receipt_hash: ProductionHash;
  }>;
  readonly evidence_refs: readonly string[];
  readonly execution_receipt_hash: ProductionHash;
  readonly continuation_ref?: string;
}

export interface ProductionRoutePolicy {
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
  readonly required_parameter_keys: readonly string[];
  readonly material_roles: readonly Readonly<{
    role: string;
    trust_class: ProductMaterial["trust_class"];
    may_issue_instruction: boolean;
    media_types: readonly string[];
    storage_class: ProductMaterial["storage_class"];
    owner_scope_policy: "required" | "forbidden";
  }>[];
  readonly result_schema_version: string;
  readonly result_contract?: Readonly<Record<string, unknown>> | undefined;
  readonly relation_kind: "primary" | "continuation" | "review";
}

export interface GeneratedImageArtifact {
  readonly artifact_id: string;
  readonly webp_bytes: Uint8Array;
  readonly original_bytes: Uint8Array;
  readonly sha256: ProductionHash;
  readonly original_sha256: ProductionHash;
  readonly bytes: number;
  readonly media_type: "image/webp";
  readonly width: 1200;
  readonly height: 630;
}

export interface GeneratedImageResultReceipt {
  readonly artifact_id: string;
  readonly object_ref: string;
  readonly sha256: ProductionHash;
  readonly receipt_hash: ProductionHash;
  readonly bytes: number;
  readonly mime_type: "image/webp";
  readonly width: number;
  readonly height: number;
}

export interface ProductPluginOutput {
  readonly payload: unknown;
  readonly evidence_refs: readonly string[];
  readonly execution_context?: unknown | undefined;
  readonly continuation?: GptProviderContinuation | null | undefined;
}

export interface ProductSkill {
  readonly text: string;
  readonly hash: ProductionHash;
}

export interface SharedExecutionContext {
  readonly materials: readonly LocalProductionMaterial[];
  readonly routePolicy: ProductionRoutePolicy;
  readonly productSkill: ProductSkill;
  readonly gpt: ProductGptTools;
  readonly uploadGeneratedImage: (artifact: GeneratedImageArtifact) => Promise<GeneratedImageResultReceipt>;
  readonly complete: (output: ProductPluginOutput) => Promise<ProductCompletionReceipt>;
}

export interface ProductPlugin {
  readonly pluginId: string;
  readonly pluginVersion: number;
  readonly checkpointSchemaVersion: number;
  readonly accepts: readonly Readonly<{
    productId: ProductionProductId;
    actionId: ProductionActionId;
  }>[];
  execute(task: WebsiteAgentTask, context: SharedExecutionContext): Promise<ProductCompletionReceipt>;
}

export type ProductDispatchContext = Omit<SharedExecutionContext, "productSkill">;

export const sha256 = (value: string | Uint8Array): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const hashCanonical = (value: unknown): ProductionHash => {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
    return typeof input === "string" ? input.normalize("NFC") : input;
  };
  return sha256(JSON.stringify(canonical(value)));
};

type ProductCheckpointReceipt = Readonly<{
  artifactRef: string;
  rawDomHash: ProductionHash;
  semanticTextHash: ProductionHash;
}>;

type PostSubmitReadbackReceipt = Readonly<{
  causeCode: string;
  exactCallIdentityHash: ProductionHash;
  outcome: "CONFIRMED";
  terminalAt: string;
  readbackMutationOutcome: "no";
  evidenceRef: string;
  evidenceHash: ProductionHash;
}>;

type PostSubmitReadbackReceiptInput = Omit<PostSubmitReadbackReceipt, "outcome" | "readbackMutationOutcome">;

class ProductRuntimeHandoffFault<Receipt> extends TypedExecutionFailure {
  public override readonly name = "ProductRuntimeHandoffFault";
  public constructor(code: string, public readonly receipt: Receipt,
    evidence: Readonly<{ evidenceRef: string; evidenceHash: ProductionHash }>) {
    super("failed", code, undefined, Object.freeze({ mutationOutcome: "no", evidence }));
  }
}

const handoffReceipt = <Receipt>(error: unknown, prefix: string): Receipt | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof ProductRuntimeHandoffFault && current.code.startsWith(prefix)) {
      return current.receipt as Receipt;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const postCheckpointReceiverFault = (
  code: string,
  receipt: ProductCheckpointReceipt,
): TypedExecutionFailure => new ProductRuntimeHandoffFault(
  `POST_CHECKPOINT_RECEIVER_FAULT:${code}`,
  Object.freeze({ ...receipt }),
  Object.freeze({ evidenceRef: receipt.artifactRef, evidenceHash: receipt.semanticTextHash }),
);

export const postCheckpointReceiverReceipt = (error: unknown): ProductCheckpointReceipt | null =>
  handoffReceipt(error, "POST_CHECKPOINT_RECEIVER_FAULT:");

const RESULT_HASH = /^sha256:[a-f0-9]{64}$/u;
const MACHINE_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const resultFailure = (code: string): never => { throw executionFailure("failed", code); };

const postSubmitReadbackCauseCode = (code: string): string => {
  const root = code.split(":", 1)[0] ?? "";
  return MACHINE_CODE.test(root) ? root : "POST_SUBMIT_READBACK_FAULT";
};

export const postSubmitReadbackFault = (
  code: string,
  input: PostSubmitReadbackReceiptInput,
): TypedExecutionFailure => {
  const terminalAt = Date.parse(input.terminalAt);
  if (input.causeCode !== code || !Number.isFinite(terminalAt)
    || !RESULT_HASH.test(input.exactCallIdentityHash)
    || !input.evidenceRef.trim() || !RESULT_HASH.test(input.evidenceHash)) {
    return executionFailure("failed", code);
  }
  const receipt = Object.freeze({ ...input, causeCode: postSubmitReadbackCauseCode(code),
    outcome: "CONFIRMED" as const,
    readbackMutationOutcome: "no" as const });
  return new ProductRuntimeHandoffFault(`POST_SUBMIT_READBACK_FAULT:${code}`, receipt, receipt);
};

export const postSubmitReadbackReceipt = (error: unknown): PostSubmitReadbackReceipt | null =>
  handoffReceipt(error, "POST_SUBMIT_READBACK_FAULT:");

export const gptTextContinuationCheckpointInput = (
  sourceAttemptId: string,
  checkpoint: Readonly<{
    assistantTurnId: string;
    artifactRef: string;
    rawDomHash: ProductionHash;
    semanticTextHash: ProductionHash;
    canonicalConversationUrl: string;
    promptHash: ProductionHash;
    turnMarker: string;
    evidenceRef: string;
    evidenceHash: ProductionHash;
  }>,
) => Object.freeze({
  checkpointKind: "text" as const,
  sourceAttemptId,
  assistantTurnId: checkpoint.assistantTurnId,
  artifactRef: checkpoint.artifactRef,
  rawDomHash: checkpoint.rawDomHash,
  semanticTextHash: checkpoint.semanticTextHash,
  canonicalConversationUrl: checkpoint.canonicalConversationUrl,
  promptHash: checkpoint.promptHash,
  turnMarker: checkpoint.turnMarker,
  evidenceRef: checkpoint.evidenceRef,
  evidenceHash: checkpoint.evidenceHash,
});

type ParsedPluginObject = Readonly<{ start: number; end: number; value: Record<string, unknown> }>;

const pluginObjectAt = (raw: string, start: number): ParsedPluginObject | null => {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let cursor = start; cursor < raw.length; cursor += 1) {
    const character = raw[cursor]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") quoted = false;
      continue;
    }
    if (character === "\"") { quoted = true; continue; }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) return null;
    if (depth !== 0) continue;
    try {
      const value = JSON.parse(raw.slice(start, cursor + 1)) as unknown;
      return value && typeof value === "object" && !Array.isArray(value)
        ? { start, end: cursor + 1, value: value as Record<string, unknown> }
        : null;
    } catch { return null; }
  }
  return null;
};

function parsePluginJsonObject(raw: string, code: string): Readonly<Record<string, unknown>> {
  const completeObjects: ParsedPluginObject[] = [];
  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== "{") continue;
    const parsed = pluginObjectAt(raw, start);
    if (parsed) completeObjects.push(parsed);
  }
  const outermost = completeObjects.filter((candidate) => !completeObjects.some((other) =>
    other !== candidate && other.start <= candidate.start && other.end >= candidate.end
      && (other.start < candidate.start || other.end > candidate.end)));
  if (outermost.length !== 1) {
    return resultFailure(outermost.length === 0 ? `${code}_JSON_INVALID` : `${code}_JSON_AMBIGUOUS`);
  }
  return Object.freeze(outermost[0]!.value);
}

const resultObject = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return resultFailure(code);
  return value as Record<string, unknown>;
};

const resultExact = (value: Record<string, unknown>, keys: readonly string[], code: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    resultFailure(code);
  }
};

const resultText = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim() || value.includes("\uFFFD")) return resultFailure(code);
  return value;
};

const resultArray = (value: unknown, code: string, nonempty = false): readonly unknown[] => {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) return resultFailure(code);
  return value;
};

const resultStringArray = (value: unknown, code: string, nonempty = false): readonly string[] => {
  const items = resultArray(value, code, nonempty);
  if (items.some((item) => typeof item !== "string" || !item.trim())) return resultFailure(code);
  return items as readonly string[];
};

const resultDual = (value: unknown, code: string): void => {
  const row = resultObject(value, code);
  resultExact(row, ["professional_markdown", "reader_explanation_markdown"], code);
  resultText(row.professional_markdown, code);
  resultText(row.reader_explanation_markdown, code);
};

const resultHash = (value: unknown, code: string): void => {
  if (typeof value !== "string" || !RESULT_HASH.test(value)) resultFailure(code);
};

const commonReport = (output: Record<string, unknown>, summary: string, blocks: string): void => {
  resultDual(output[summary], "AGENT_RESULT_DUAL_LAYER_INVALID");
  resultArray(output[blocks], "AGENT_RESULT_BLOCKS_INVALID", true);
  resultArray(output.citations, "AGENT_RESULT_CITATIONS_INVALID");
  resultStringArray(output.uncertainties, "AGENT_RESULT_UNCERTAINTIES_INVALID");
  resultStringArray(output.limitations, "AGENT_RESULT_LIMITATIONS_INVALID");
  resultStringArray(output.safety_notes, "AGENT_RESULT_SAFETY_NOTES_INVALID");
};

const assertLocked = (output: Record<string, unknown>, task: WebsiteAgentTask, fields: readonly string[]): void => {
  for (const field of fields) {
    if (output[field] !== task.parameters[field]) resultFailure(`AGENT_RESULT_LOCKED_IDENTITY_INVALID:${field}`);
  }
};

const parseReview = (raw: string): Readonly<Record<string, unknown>> => {
  const output = parsePluginJsonObject(raw, "AGENT_REVIEW_OUTPUT");
  resultExact(output as Record<string, unknown>, ["decision", "issues"], "AGENT_REVIEW_OUTPUT_FIELDS_INVALID");
  const issues = resultArray(output.issues, "AGENT_REVIEW_ISSUES_INVALID");
  if ((output.decision === "no_issue" && issues.length !== 0)
    || (output.decision === "issues" && (issues.length < 1 || issues.length > 50))
    || (output.decision !== "no_issue" && output.decision !== "issues")) {
    resultFailure("AGENT_REVIEW_DECISION_INVALID");
  }
  const categories = new Set([
    "source_text_possible_error", "index_navigation_friction", "missing_condition_or_exception",
    "citation_locator_problem", "prompt_ambiguity", "missing_input", "output_contract_friction",
    "reasoning_depth_gap", "safety_boundary_conflict", "conversation_context_loss",
    "provider_or_tooling_issue",
  ]);
  for (const rawIssue of issues) {
    const issue = resultObject(rawIssue, "AGENT_REVIEW_ISSUE_INVALID");
    resultExact(issue, ["category", "target_type", "target_ref", "observation", "evidence_refs", "impact", "confidence", "suggested_inspection"], "AGENT_REVIEW_ISSUE_FIELDS_INVALID");
    if (!categories.has(resultText(issue.category, "AGENT_REVIEW_CATEGORY_INVALID"))
      || !["low", "medium", "high"].includes(String(issue.confidence))) {
      resultFailure("AGENT_REVIEW_ISSUE_INVALID");
    }
    for (const field of ["target_type", "target_ref", "observation", "impact", "suggested_inspection"] as const) {
      resultText(issue[field], "AGENT_REVIEW_ISSUE_INVALID");
    }
    resultStringArray(issue.evidence_refs, "AGENT_REVIEW_EVIDENCE_REQUIRED", true);
  }
  return Object.freeze(output);
};

export const productResultValidation = Object.freeze({
  array: resultArray,
  commonReport,
  dual: resultDual,
  exact: resultExact,
  fail: resultFailure,
  hash: resultHash,
  locked: assertLocked,
  object: resultObject,
  parseJsonObject: parsePluginJsonObject,
  parseReview,
  stringArray: resultStringArray,
  text: resultText,
});

export function evaluateExactNestedResultContract(input: Readonly<{
  artifactHash: ProductionHash;
  value: Readonly<Record<string, unknown>>;
  contract: Readonly<Record<string, unknown>>;
  topLevelFieldsKey: string;
  nestedArrayFields: Readonly<Record<string, string>>;
}>): Readonly<{
  artifact_hash: ProductionHash;
  contract_hash: ProductionHash;
  outcome: "accepted";
  evaluation_hash: ProductionHash;
}> {
  const expectedTop = input.contract[input.topLevelFieldsKey];
  if (!Array.isArray(expectedTop) || !expectedTop.every((field) => typeof field === "string")
    || Object.keys(input.value).sort().join("\0") !== [...expectedTop].sort().join("\0")) {
    throw new Error("EXACT_NESTED_RESULT_CONTRACT_TOP_LEVEL_INVALID");
  }
  for (const [valueKey, contractKey] of Object.entries(input.nestedArrayFields)) {
    const expectedFields = input.contract[contractKey];
    const values = input.value[valueKey];
    if (!Array.isArray(expectedFields) || !expectedFields.every((field) => typeof field === "string")
      || !Array.isArray(values)) throw new Error("EXACT_NESTED_RESULT_CONTRACT_ARRAY_INVALID");
    for (const child of values) {
      if (!child || typeof child !== "object" || Array.isArray(child)
        || Object.keys(child).sort().join("\0") !== [...expectedFields].sort().join("\0")) {
        throw new Error("EXACT_NESTED_RESULT_CONTRACT_CHILD_INVALID");
      }
    }
  }
  const contractHash = hashCanonical(input.contract);
  const stable = { kind: "exact-nested-result-contract-evaluation.v1",
    artifact_hash: input.artifactHash, contract_hash: contractHash, outcome: "accepted" as const };
  return Object.freeze({ ...stable, evaluation_hash: hashCanonical(stable) });
}
