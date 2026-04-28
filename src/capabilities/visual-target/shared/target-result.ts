import { createId } from "../../../lib/local-runtime/ids.js";
import type {
  VisualTarget,
  VisualTargetAbilityInput,
  VisualTargetChildCapabilityId,
  VisualTargetFailureReason,
} from "../contract.js";

function createBaseResult(input: {
  childCapabilityId: VisualTargetChildCapabilityId;
  request: VisualTargetAbilityInput;
  startedAt: string;
}) {
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(input.startedAt));
  return {
    abilityGroupId: "visual-target" as const,
    childCapabilityId: input.childCapabilityId,
    targetType: input.request.targetType,
    sourceScreenshotEvidenceId: input.request.sourceScreenshotEvidenceId,
    sourceAiResultRef: input.request.sourceAiResultRef,
    requiresGeometryGuard: true,
    debugLogRef: createId("visual_target_log"),
    startedAt: input.startedAt,
    endedAt,
    createdAt: endedAt,
    durationMs,
  };
}

export function buildSuccessfulVisualTargetResult(input: {
  childCapabilityId: VisualTargetChildCapabilityId;
  request: VisualTargetAbilityInput;
  startedAt: string;
  sourceCandidateRef: string | null;
  coordinateSpace: VisualTarget["coordinateSpace"];
  boundingBox: NonNullable<VisualTarget["boundingBox"]>;
  clickPoint: NonNullable<VisualTarget["clickPoint"]>;
  confidence: number;
  detectionMethod: string;
  visibleText: string | null;
  uncertainty: string[];
  blockedReason: string | null;
  dataQualityFlags: string[];
}): VisualTarget {
  return {
    targetId: createId("visual_target"),
    ...createBaseResult(input),
    status: "success",
    sourceCandidateRef: input.sourceCandidateRef,
    coordinateSpace: input.coordinateSpace,
    boundingBox: input.boundingBox,
    clickPoint: input.clickPoint,
    confidence: input.confidence,
    detectionMethod: input.detectionMethod,
    visibleText: input.visibleText,
    uncertainty: input.uncertainty,
    blockedReason: input.blockedReason,
    failureReason: null,
    dataQualityFlags: input.dataQualityFlags,
  };
}

export function buildFailedVisualTargetResult(input: {
  childCapabilityId: VisualTargetChildCapabilityId;
  request: VisualTargetAbilityInput;
  startedAt: string;
  status: "failed" | "review_required";
  failureReason: VisualTargetFailureReason;
  dataQualityFlags?: string[];
}): VisualTarget {
  return {
    targetId: null,
    ...createBaseResult(input),
    status: input.status,
    sourceCandidateRef: null,
    coordinateSpace: input.request.coordinateSpace,
    boundingBox: null,
    clickPoint: null,
    confidence: null,
    detectionMethod: null,
    visibleText: null,
    uncertainty: [],
    blockedReason: null,
    failureReason: input.failureReason,
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
}