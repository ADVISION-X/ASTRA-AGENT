import { z } from "zod";

import { VISUAL_TARGET_CHAIN_FIELD_NAMES } from "./shared/visual-target-governance.js";

type ChainRecord = Record<string, unknown>;

type VisualTargetRuntimeProofLike = ChainRecord & {
  startedAt: string;
  endedAt: string;
  status: string;
  failureReason: string | null;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
};

type VisualTargetAbilityResultLike = ChainRecord & {
  status: string;
  output: unknown;
  visualTargetResultRef: string | null;
  failureReason: string | null;
  runtimeProof: VisualTargetRuntimeProofLike;
};

function addChainFieldRequirementIssues(record: ChainRecord, context: z.RefinementCtx, scope: "runtimeProof" | "result"): void {
  for (const fieldName of VISUAL_TARGET_CHAIN_FIELD_NAMES) {
    if (record[fieldName] == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required in ${scope}`, path: [fieldName] });
    }
  }
}

function validateVisualTargetRuntimeProofRefs(value: VisualTargetRuntimeProofLike, context: z.RefinementCtx): void {
  if (value.status === "success" && value.outputRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires outputRef", path: ["outputRef"] });
  }
  if (value.status !== "success" && value.outputRef !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must keep outputRef null", path: ["outputRef"] });
  }
  if (value.status !== "success" && value.diagnosticPayloadRef === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success proof must keep diagnosticPayloadRef", path: ["diagnosticPayloadRef"] });
  }
}

export function validateVisualTargetRuntimeProof(value: VisualTargetRuntimeProofLike, context: z.RefinementCtx): void {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (!(value.status === "failed" && value.failureReason === "input_schema_invalid")) {
    addChainFieldRequirementIssues(value, context, "runtimeProof");
  }
  validateVisualTargetRuntimeProofRefs(value, context);
}

function validateVisualTargetAbilityResultChainParity(
  resultRecord: ChainRecord,
  proofRecord: ChainRecord,
  isInvalidInputFailure: boolean,
  context: z.RefinementCtx,
): void {
  for (const fieldName of VISUAL_TARGET_CHAIN_FIELD_NAMES) {
    if (!isInvalidInputFailure && resultRecord[fieldName] == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} is required in result`, path: [fieldName] });
    }
    if (resultRecord[fieldName] !== proofRecord[fieldName]) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `runtimeProof.${fieldName} must equal result.${fieldName}`, path: ["runtimeProof", fieldName] });
    }
  }
}

export function validateVisualTargetAbilityResult(value: VisualTargetAbilityResultLike, context: z.RefinementCtx): void {
  const isInvalidInputFailure = value.status === "failed" && value.failureReason === "input_schema_invalid";
  const resultRecord = value as ChainRecord;
  const proofRecord = value.runtimeProof as ChainRecord;

  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.visualTargetResultRef !== value.runtimeProof.outputRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "visualTargetResultRef must equal runtimeProof.outputRef", path: ["visualTargetResultRef"] });
  }
  validateVisualTargetAbilityResultChainParity(resultRecord, proofRecord, isInvalidInputFailure, context);
  if (value.status === "success" && value.output === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output", path: ["output"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed/review_required result must keep output null", path: ["output"] });
  }
  if (value.status === "success" && value.output && typeof value.output === "object" && value.output !== null && "geometryGuardHandoff" in (value.output as Record<string, unknown>)) {
    const actionOutput = value.output as Record<string, unknown>;
    const handoff = actionOutput.geometryGuardHandoff;
    if (typeof handoff !== "object" || handoff === null || Array.isArray(handoff)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success action output requires geometryGuardHandoff object", path: ["output", "geometryGuardHandoff"] });
      return;
    }
    if ((handoff as Record<string, unknown>).sourceVisualTargetResultRef !== value.visualTargetResultRef) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "geometryGuardHandoff.sourceVisualTargetResultRef must equal visualTargetResultRef", path: ["output", "geometryGuardHandoff", "sourceVisualTargetResultRef"] });
    }
  }
}