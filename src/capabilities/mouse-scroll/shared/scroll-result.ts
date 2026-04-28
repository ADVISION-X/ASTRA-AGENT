import { createId } from "../../../lib/local-runtime/ids.js";
import type { MouseScrollAbilityResult, NormalizedMouseScrollAbilityInput } from "../contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "../contract.js";
import type { MouseScrollFailureReason } from "./scroll-failure.js";
import { buildMouseScrollRuntimeProof } from "./runtime-proof.js";

type BuildMouseScrollResultInput = {
  callInput: NormalizedMouseScrollAbilityInput;
  startedAt: string;
  endedAt: string;
  status: MouseScrollAbilityResult["status"];
  deltaX: number;
  deltaY: number;
  primitiveExecutionRefs: string[];
  failureReason: MouseScrollFailureReason | null;
  statusMessage: string;
};

function buildResult(input: BuildMouseScrollResultInput): MouseScrollAbilityResult {
  const scrollExecutionRef = createId("mouse_scroll");
  const debugLogRef = input.callInput.sourceEvidenceRef
    ?? input.callInput.sourceTargetRef
    ?? input.callInput.safetyPolicy.operatorManualApprovalRef
    ?? null;

  return {
    status: input.status,
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: input.callInput.childCapabilityId,
    sessionId: input.callInput.sessionId,
    roundId: input.callInput.roundId,
    videoVisitId: input.callInput.videoVisitId,
    scrollExecutionRef,
    primitiveExecutionRefs: [...input.primitiveExecutionRefs],
    geometryGuardRef: input.callInput.geometryGuardRef,
    direction: input.callInput.direction,
    magnitude: input.callInput.magnitude,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    repeat: input.callInput.repeat,
    coordinateSpace: input.callInput.coordinateSpace,
    anchorPoint: input.callInput.anchorPoint,
    regionRef: input.callInput.regionRef,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
    statusMessage: input.statusMessage,
    failureReason: input.failureReason,
    debugLogRef,
    runtimeProof: buildMouseScrollRuntimeProof({
      callInput: input.callInput,
      scrollExecutionRef,
      primitiveExecutionRefs: input.primitiveExecutionRefs,
      deltaX: input.deltaX,
      deltaY: input.deltaY,
      status: input.status,
      failureReason: input.failureReason,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    }),
  };
}

export function buildMouseScrollFailure(input: {
  callInput: NormalizedMouseScrollAbilityInput;
  startedAt: string;
  endedAt: string;
  deltaX: number;
  deltaY: number;
  primitiveExecutionRefs: string[];
  failureReason: MouseScrollFailureReason;
  statusMessage: string;
}): MouseScrollAbilityResult {
  return buildResult({
    ...input,
    status: "failed",
  });
}

export function buildMouseScrollReviewRequired(input: {
  callInput: NormalizedMouseScrollAbilityInput;
  startedAt: string;
  endedAt: string;
  deltaX: number;
  deltaY: number;
  primitiveExecutionRefs: string[];
  failureReason: MouseScrollFailureReason;
  statusMessage: string;
}): MouseScrollAbilityResult {
  return buildResult({
    ...input,
    status: "review_required",
  });
}

export function buildMouseScrollSuccess(input: {
  callInput: NormalizedMouseScrollAbilityInput;
  startedAt: string;
  endedAt: string;
  deltaX: number;
  deltaY: number;
  primitiveExecutionRefs: string[];
  statusMessage: string;
}): MouseScrollAbilityResult {
  return buildResult({
    ...input,
    status: "success",
    failureReason: null,
  });
}