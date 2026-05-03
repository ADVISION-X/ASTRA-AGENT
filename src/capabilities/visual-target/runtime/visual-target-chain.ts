import type { ParsedVisualTargetAbilityInput } from "../contract.js";

import type { VisualTargetFailureTrace } from "./visual-target-input-gate.js";

export type VisualTargetChainSnapshot = {
  missionId: string | null;
  runId: string | null;
  stepId: string | null;
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapId: string | null;
  selectedMapVersion: string | null;
  activationSnapshotRef: string | null;
  capabilityCallId: string | null;
  nerveBusEnvelopeId: string | null;
};

export function resolveVisualTargetChain(
  request: ParsedVisualTargetAbilityInput | null,
  trace: VisualTargetFailureTrace,
): VisualTargetChainSnapshot {
  if (request) {
    return {
      missionId: request.missionId,
      runId: request.runId,
      stepId: request.stepId,
      mapPackageId: request.mapPackageId,
      mapPackageVersion: request.mapPackageVersion,
      selectedMapId: request.selectedMapId,
      selectedMapVersion: request.selectedMapVersion,
      activationSnapshotRef: request.activationSnapshotRef,
      capabilityCallId: request.capabilityCallId,
      nerveBusEnvelopeId: request.nerveBusEnvelopeId,
    };
  }

  return {
    missionId: trace.missionId,
    runId: trace.runId,
    stepId: trace.stepId,
    mapPackageId: trace.mapPackageId,
    mapPackageVersion: trace.mapPackageVersion,
    selectedMapId: trace.selectedMapId,
    selectedMapVersion: trace.selectedMapVersion,
    activationSnapshotRef: trace.activationSnapshotRef,
    capabilityCallId: trace.capabilityCallId,
    nerveBusEnvelopeId: trace.nerveBusEnvelopeId,
  };
}