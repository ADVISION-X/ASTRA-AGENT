import { createId } from "../../../lib/local-runtime/ids.js";
import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  type MouseClickAbilityResult,
  type MouseClickChildCapabilityId,
  type NormalizedMouseClickAbilityInput,
} from "../contract.js";
import type { MouseClickFailureReason } from "./click-failure.js";
import type { MouseClickRuntimeProof } from "./runtime-proof.js";

function resolveCoordinateValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function createRuntimeProof(input: {
  childCapabilityId: MouseClickChildCapabilityId;
  abilityInput: NormalizedMouseClickAbilityInput;
  actionExecutionRef: string;
  primitiveExecutionRef: string | null;
  startedAt: string;
  endedAt: string;
  status: MouseClickAbilityResult["status"];
  failureReason: MouseClickFailureReason | null;
}): MouseClickRuntimeProof {
  return {
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    sessionId: input.abilityInput.sessionId,
    roundId: input.abilityInput.roundId,
    videoVisitId: input.abilityInput.videoVisitId,
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    requestedBy: input.abilityInput.requestedBy,
    purpose: input.abilityInput.purpose,
    geometryGuardRef: input.abilityInput.geometryGuardRef,
    coordinateSpace: input.abilityInput.coordinate.coordinateSpace,
    x: resolveCoordinateValue(input.abilityInput.coordinate.x),
    y: resolveCoordinateValue(input.abilityInput.coordinate.y),
    button: input.abilityInput.button,
    clickCount: input.abilityInput.clickCount,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
    status: input.status,
    failureReason: input.failureReason,
  };
}

function buildMouseClickOutcome(input: {
  childCapabilityId: MouseClickChildCapabilityId;
  abilityInput: NormalizedMouseClickAbilityInput;
  startedAt: string;
  endedAt: string;
  status: MouseClickAbilityResult["status"];
  failureReason: MouseClickFailureReason | null;
  statusMessage: string;
  primitiveExecutionRef: string | null;
}): MouseClickAbilityResult {
  const actionExecutionRef = createId("mouse_click_action");
  const debugLogRef = createId("mouse_click_log");

  return {
    status: input.status,
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    sessionId: input.abilityInput.sessionId,
    roundId: input.abilityInput.roundId,
    videoVisitId: input.abilityInput.videoVisitId,
    actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    geometryGuardRef: input.abilityInput.geometryGuardRef,
    x: resolveCoordinateValue(input.abilityInput.coordinate.x),
    y: resolveCoordinateValue(input.abilityInput.coordinate.y),
    coordinateSpace: input.abilityInput.coordinate.coordinateSpace,
    button: input.abilityInput.button,
    clickCount: input.abilityInput.clickCount,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    debugLogRef,
    runtimeProof: createRuntimeProof({
      childCapabilityId: input.childCapabilityId,
      abilityInput: input.abilityInput,
      actionExecutionRef,
      primitiveExecutionRef: input.primitiveExecutionRef,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      status: input.status,
      failureReason: input.failureReason,
    }),
  };
}

export function buildMouseClickFailure(input: {
  childCapabilityId: MouseClickChildCapabilityId;
  abilityInput: NormalizedMouseClickAbilityInput;
  startedAt: string;
  endedAt: string;
  failureReason: MouseClickFailureReason;
  statusMessage: string;
  primitiveExecutionRef?: string | null;
  status?: Extract<MouseClickAbilityResult["status"], "failed" | "review_required">;
}): MouseClickAbilityResult {
  return buildMouseClickOutcome({
    childCapabilityId: input.childCapabilityId,
    abilityInput: input.abilityInput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    status: input.status ?? "failed",
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
    primitiveExecutionRef: input.primitiveExecutionRef ?? null,
  });
}

export function buildMouseClickSuccess(input: {
  childCapabilityId: MouseClickChildCapabilityId;
  abilityInput: NormalizedMouseClickAbilityInput;
  startedAt: string;
  endedAt: string;
  primitiveExecutionRef: string;
  statusMessage: string;
}): MouseClickAbilityResult {
  return buildMouseClickOutcome({
    childCapabilityId: input.childCapabilityId,
    abilityInput: input.abilityInput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    status: "success",
    failureReason: null,
    statusMessage: input.statusMessage,
    primitiveExecutionRef: input.primitiveExecutionRef,
  });
}