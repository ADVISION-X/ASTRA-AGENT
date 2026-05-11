import { randomUUID } from "node:crypto";

import {
  VISUAL_TARGET_ABILITY_GROUP_ID,
  type ParsedVisualTargetAbilityInput,
  type VisualTargetAbilityResult,
  type VisualTargetRuntimeProof,
} from "../contract.js";

export function buildVisualTargetProof(params: {
  input: ParsedVisualTargetAbilityInput;
  status: "success" | "failed" | "review_required";
  targetResultRef: string | null;
  candidateRef: string | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}): VisualTargetRuntimeProof {
  return {
    proofId: randomUUID(),
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: params.input.childCapabilityId,
    missionId: params.input.missionId ?? null,
    runId: params.input.runId ?? null,
    sessionId: params.input.sessionId ?? "unknown",
    roundId: params.input.roundId ?? null,
    stepId: params.input.stepId ?? null,
    capabilityCallId: params.input.capabilityCallId ?? null,
    nerveBusEnvelopeId: params.input.nerveBusEnvelopeId ?? null,
    inputRef: params.input.inputRef ?? null,
    sourceRef: params.input.sourceRef ?? null,
    sourceScreenshotEvidenceRef: params.input.sourceScreenshotEvidenceRef,
    targetResultRef: params.targetResultRef,
    candidateRef: params.candidateRef,
    status: params.status,
    failureReason: params.failureReason,
    reviewRequiredReason: params.reviewRequiredReason,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationMs: params.durationMs,
  };
}

export function buildVisualTargetSuccessResult(params: {
  input: ParsedVisualTargetAbilityInput;
  proof: VisualTargetRuntimeProof;
  targetResultRef: string;
  candidateRef: string;
  targetPackage: import("../contract.js").VisualTargetPackage;
}): VisualTargetAbilityResult {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: params.input.childCapabilityId,
    status: "success",
    targetResultRef: params.targetResultRef,
    candidateRef: params.candidateRef,
    output: {
      childCapabilityId: params.input.childCapabilityId,
      targetResultRef: params.targetResultRef,
      candidateRef: params.candidateRef,
      targetPackage: params.targetPackage,
      sourceScreenshotEvidenceRef: params.input.sourceScreenshotEvidenceRef,
    },
    failureReason: null,
    reviewRequiredReason: null,
    runtimeProof: params.proof,
    startedAt: params.proof.startedAt,
    endedAt: params.proof.endedAt,
    durationMs: params.proof.durationMs,
  };
}

export function buildVisualTargetFailedResult(params: {
  input: ParsedVisualTargetAbilityInput;
  proof: VisualTargetRuntimeProof;
  failureReason: string;
}): VisualTargetAbilityResult {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: params.input.childCapabilityId,
    status: "failed",
    targetResultRef: null,
    candidateRef: null,
    output: null,
    failureReason: params.failureReason,
    reviewRequiredReason: null,
    runtimeProof: params.proof,
    startedAt: params.proof.startedAt,
    endedAt: params.proof.endedAt,
    durationMs: params.proof.durationMs,
  };
}

export function buildVisualTargetInputInvalidResult(
  rawInput: unknown,
  startedAt: string,
  endedAt: string,
  durationMs: number,
): VisualTargetAbilityResult {
  const raw = rawInput as Record<string, unknown>;
  const childCapabilityId =
    typeof raw.childCapabilityId === "string"
      ? (raw.childCapabilityId as VisualTargetAbilityResult["childCapabilityId"])
      : "package-grid-cell-target-once";
  const sessionId =
    typeof raw.sessionId === "string" ? raw.sessionId : "unknown";
  const proofId = `visual-target:input-invalid:${Date.now()}`;
  const proof: VisualTargetRuntimeProof = {
    proofId,
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId,
    missionId: null,
    runId: null,
    sessionId,
    roundId: null,
    stepId: null,
    capabilityCallId: null,
    nerveBusEnvelopeId: null,
    inputRef: null,
    sourceRef: null,
    sourceScreenshotEvidenceRef: null,
    targetResultRef: null,
    candidateRef: null,
    status: "failed",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    startedAt,
    endedAt,
    durationMs,
  };
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId,
    status: "failed",
    targetResultRef: null,
    candidateRef: null,
    output: null,
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    runtimeProof: proof,
    startedAt,
    endedAt,
    durationMs,
  };
}
