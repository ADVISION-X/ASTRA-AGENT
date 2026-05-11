import type { ParsedVisualTargetAbilityInput } from "../contract.js";

import type { VisualTargetFailureTrace } from "./visual-target-input-gate.js";

export type VisualTargetChainSnapshot = {
  missionId: string | null;
  runId: string | null;
  stepId: string | null;
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingSnapshotRef: string | null;
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
      bindingPackageId: request.bindingPackageId,
      bindingPackageVersion: request.bindingPackageVersion,
      selectedBindingId: request.selectedBindingId,
      bindingVersion: request.bindingVersion,
      bindingSnapshotRef: request.bindingSnapshotRef,
      capabilityCallId: request.capabilityCallId,
      nerveBusEnvelopeId: request.nerveBusEnvelopeId,
    };
  }

  return {
    missionId: trace.missionId,
    runId: trace.runId,
    stepId: trace.stepId,
    bindingPackageId: trace.bindingPackageId,
    bindingPackageVersion: trace.bindingPackageVersion,
    selectedBindingId: trace.selectedBindingId,
    bindingVersion: trace.bindingVersion,
    bindingSnapshotRef: trace.bindingSnapshotRef,
    capabilityCallId: trace.capabilityCallId,
    nerveBusEnvelopeId: trace.nerveBusEnvelopeId,
  };
}