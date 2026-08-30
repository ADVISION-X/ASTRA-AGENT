import { readFileSync } from "node:fs";

import type {
  LocalProductionMaterial,
  ProductionActionId,
  ProductionHash,
  ProductionProductId,
  WebsiteAgentResult,
  WebsiteAgentTask,
} from "./contracts.js";
import { sha256 } from "./contracts.js";
import { executionFailure } from "../../typed-failure.js";
import type {
  GptChildCapabilityId,
  GptContinuationLane,
  GptProviderContinuation,
} from "../../../capabilities/gpt/index.js";

export interface GeneratedImageArtifact {
  readonly artifact_id: string;
  readonly local_path: string;
  readonly original_local_path: string;
  readonly sha256: ProductionHash;
  readonly original_sha256: ProductionHash;
  readonly bytes: number;
  readonly media_type: "image/webp";
  readonly width: 1200;
  readonly height: 630;
}

export interface SharedExecutionContext {
  readonly materials: readonly LocalProductionMaterial[];
  readonly gpt: ProductGptTools;
  readonly complete: (output: ProductPluginOutput) => Promise<WebsiteAgentResult>;
}

export type ProductGptChildResult = Readonly<{
  value: unknown;
  evidenceRef: string;
  evidenceHash: ProductionHash;
}>;

export type ProductGptCallInput = Readonly<{
  sessionKey?: string;
  productStepId: string;
  callId: string;
  child: GptChildCapabilityId;
  actionOrdinal: number;
  input: Readonly<Record<string, unknown>>;
}>;

export type ExactGptCallFacts = Readonly<{
  exactCallIdentityHash: ProductionHash;
  mutation: Readonly<{
    owner: "browser";
    effectScope: "target_local" | "provider_effect";
    outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    terminalAt: string | null;
  }> | null;
  evidence: Readonly<{
    owner: "forensics-persistence";
    evidenceRef: string;
    evidenceHash: ProductionHash;
    readbackVerified: true;
    artifactRefs: readonly string[];
  }> | null;
  continuation: Readonly<{
    owner: "gpt-session-controller";
    continuationRef: string;
    conversationIdentityHash: ProductionHash;
    laneVersion: number;
    contentReadbackVerified: true;
  }> | null;
}>;

export interface ProductGptTools {
  readonly attemptId: string;
  readContinuationForTurn(turnMarker: string): GptContinuationLane | null;
  execute(input: ProductGptCallInput & Readonly<{ sessionKey: string }>): Promise<ProductGptChildResult>;
  readCallFacts(input: ProductGptCallInput): Promise<ExactGptCallFacts>;
}

export interface ProductPluginOutput {
  readonly payload: unknown;
  readonly evidence_refs: readonly string[];
  readonly continuation?: GptProviderContinuation | null;
  readonly generated_image?: GeneratedImageArtifact;
}

export interface ProductPlugin {
  readonly pluginId: string;
  readonly pluginVersion: number;
  readonly skillHash: ProductionHash;
  readonly checkpointSchemaVersion: number;
  readonly accepts: readonly Readonly<{
    productId: ProductionProductId;
    actionId: ProductionActionId;
  }>[];
  readonly parseResult: (
    task: WebsiteAgentTask,
    value: unknown,
    phase: "draft" | "final",
  ) => Readonly<Record<string, unknown>>;
  execute(task: WebsiteAgentTask, context: SharedExecutionContext): Promise<WebsiteAgentResult>;
}

export const readProductSkill = (pluginModuleUrl: string): Readonly<{
  path: string;
  text: string;
  hash: ProductionHash;
}> => {
  const path = new URL("./SKILL.md", pluginModuleUrl).pathname;
  const text = readFileSync(path, "utf8").normalize("NFC");
  if (!text.trim()) throw new Error("PLUGIN_SKILL_EMPTY");
  return Object.freeze({ path, text, hash: sha256(text) });
};

export function parsePluginJsonObject(raw: string, code: string): Readonly<Record<string, unknown>> {
  const completeObjects: Array<Readonly<{ start: number; end: number; value: Record<string, unknown> }>> = [];
  for (let start = 0; start < raw.length; start += 1) {
    if (raw[start] !== "{") continue;
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
      if (character === "\"") {
        quoted = true;
        continue;
      }
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      if (depth < 0) break;
      if (depth !== 0) continue;
      let value: unknown;
      try { value = JSON.parse(raw.slice(start, cursor + 1)) as unknown; }
      catch { break; }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        completeObjects.push({ start, end: cursor + 1, value: value as Record<string, unknown> });
      }
      break;
    }
  }
  const outermost = completeObjects.filter((candidate) => !completeObjects.some((other) =>
    other !== candidate && other.start <= candidate.start && other.end >= candidate.end
      && (other.start < candidate.start || other.end > candidate.end)));
  if (outermost.length !== 1) {
    return resultFailure(outermost.length === 0 ? `${code}_JSON_INVALID` : `${code}_JSON_AMBIGUOUS`);
  }
  return Object.freeze(outermost[0]!.value);
}

const RESULT_HASH = /^sha256:[a-f0-9]{64}$/u;
const resultFailure = (code: string): never => { throw executionFailure("failed", code); };

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

/** Product-neutral validation primitives; each Product Plugin owns its business schema. */
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
