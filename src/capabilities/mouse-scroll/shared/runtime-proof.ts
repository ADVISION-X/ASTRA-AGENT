import type { NormalizedMouseScrollAbilityInput } from "../contract.js";
import type { MouseScrollFailureReason } from "./scroll-failure.js";

export type MouseScrollRuntimeProofStatus = "success" | "failed" | "review_required";

export type MouseScrollRuntimeProof = {
  abilityGroupId: "mouse-scroll";
  childCapabilityId: NormalizedMouseScrollAbilityInput["childCapabilityId"];
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string;
  direction: NormalizedMouseScrollAbilityInput["direction"];
  magnitude: NormalizedMouseScrollAbilityInput["magnitude"];
  deltaX: number;
  deltaY: number;
  coordinateSpace: NormalizedMouseScrollAbilityInput["coordinateSpace"];
  anchorPoint: NormalizedMouseScrollAbilityInput["anchorPoint"];
  regionRef: string | null;
  scrollExecutionRef: string;
  primitiveExecutionRefs: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: MouseScrollRuntimeProofStatus;
  failureReason: MouseScrollFailureReason | null;
};

export function buildMouseScrollRuntimeProof(input: {
  callInput: NormalizedMouseScrollAbilityInput;
  scrollExecutionRef: string;
  primitiveExecutionRefs: string[];
  deltaX: number;
  deltaY: number;
  status: MouseScrollRuntimeProofStatus;
  failureReason: MouseScrollFailureReason | null;
  startedAt: string;
  endedAt: string;
}): MouseScrollRuntimeProof {
  return {
    abilityGroupId: "mouse-scroll",
    childCapabilityId: input.callInput.childCapabilityId,
    sessionId: input.callInput.sessionId,
    roundId: input.callInput.roundId,
    videoVisitId: input.callInput.videoVisitId,
    requestedBy: input.callInput.requestedBy,
    purpose: input.callInput.purpose,
    geometryGuardRef: input.callInput.geometryGuardRef,
    direction: input.callInput.direction,
    magnitude: input.callInput.magnitude,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    coordinateSpace: input.callInput.coordinateSpace,
    anchorPoint: input.callInput.anchorPoint,
    regionRef: input.callInput.regionRef,
    scrollExecutionRef: input.scrollExecutionRef,
    primitiveExecutionRefs: [...input.primitiveExecutionRefs],
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
    status: input.status,
    failureReason: input.failureReason,
  };
}