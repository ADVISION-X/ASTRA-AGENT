import { randomUUID } from "node:crypto";

import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  type GeometryGuardRuntimeProof,
  type ParsedGeometryGuardAbilityInput,
  type GeometryGuardPoint,
  type GeometryGuardBoundingBox,
} from "../contract.js";

export function buildGeometryGuardProof(params: {
  input: ParsedGeometryGuardAbilityInput;
  guardDecision: "allow" | "deny" | "review_required";
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}): GeometryGuardRuntimeProof {
  return {
    proofId: randomUUID(),
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
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
    sourceScreenshotEvidenceRef:
      params.input.sourceScreenshotEvidenceRef ?? null,
    sourceAbilityGroupId: params.input.sourceAbilityGroupId ?? null,
    sourceChildCapabilityId: params.input.sourceChildCapabilityId ?? null,
    gridSpecRef: params.input.gridSpecRef ?? null,
    sourceCoordinateSpace: params.input.sourceCoordinateSpace,
    requestedExecutionSpace: params.input.requestedExecutionSpace,
    normalizedCoordinateSpace:
      params.guardDecision === "allow" ? "browserViewport" : null,
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
    guardDecision: params.guardDecision,
    failureReason: params.failureReason,
    reviewRequiredReason: params.reviewRequiredReason,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationMs: params.durationMs,
  };
}
