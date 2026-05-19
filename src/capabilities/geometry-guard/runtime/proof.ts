import { randomUUID } from "node:crypto";

import {
  type ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../schema-constants.js";
import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
} from "../geometry-types.js";
import type { GeometryGuardRuntimeProof } from "../geometry-io-types.js";

type ProofIdentity = Pick<
  GeometryGuardRuntimeProof,
  | "missionId"
  | "runId"
  | "sessionId"
  | "roundId"
  | "stepId"
  | "capabilityCallId"
  | "nerveBusEnvelopeId"
  | "inputRef"
  | "sourceRef"
  | "sourceScreenshotEvidenceRef"
  | "sourceAbilityGroupId"
  | "sourceChildCapabilityId"
  | "gridSpecRef"
>;

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
    ...buildProofIdentity(params.input),
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

function buildProofIdentity(
  input: ParsedGeometryGuardAbilityInput,
): ProofIdentity {
  return {
    missionId: input.missionId ?? null,
    runId: input.runId ?? null,
    sessionId: input.sessionId ?? "unknown",
    roundId: input.roundId ?? null,
    stepId: input.stepId ?? null,
    capabilityCallId: input.capabilityCallId ?? null,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId ?? null,
    inputRef: input.inputRef ?? null,
    sourceRef: input.sourceRef ?? null,
    sourceScreenshotEvidenceRef: input.sourceScreenshotEvidenceRef ?? null,
    sourceAbilityGroupId: input.sourceAbilityGroupId ?? null,
    sourceChildCapabilityId: input.sourceChildCapabilityId ?? null,
    gridSpecRef: input.gridSpecRef ?? null,
  };
}
