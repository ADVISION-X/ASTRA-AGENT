import { createHash } from "node:crypto";

import type {
  MouseClickButton,
  MouseClickChildCapabilityId,
  MouseClickCoordinateSpace,
  MouseClickCount,
  MouseClickSafetyPolicy,
  ParsedMouseClickAbilityInput,
} from "../contract.js";

const stableHash = (prefix: string, value: unknown): string => {
  const serialized = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  return `${prefix}:${createHash("sha256").update(serialized).digest("hex").slice(0, 18)}`;
};

export type MouseClickExecutionSeed = {
  attemptRef: string;
  inputRef: string;
  childCapabilityId: MouseClickChildCapabilityId;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  stepId: string;
  bindingPackageId: string;
  bindingPackageVersion: string;
  selectedBindingId: string;
  bindingVersion: string;
  bindingSnapshotRef: string;
  capabilityCallId: string;
  nerveBusEnvelopeId: string;
  requestedBy: string;
  purpose: string;
  sourceRef: string;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  geometryGuardOutputRef: string | null;
  geometryGuardRuntimeProofRef: string | null;
  sourceCoordinateProofRef: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  sourceVisualTargetResultRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  sourceCoordinateSpace: MouseClickCoordinateSpace | null;
  requestedCoordinate: { x: number; y: number } | null;
  sourceBounds: { width: number; height: number } | null;
  targetBounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  timeoutMs: number;
  safetyPolicy: MouseClickSafetyPolicy;
};

export const buildMouseClickExecutionSeed = (input: ParsedMouseClickAbilityInput): MouseClickExecutionSeed => {
  const inputRef = input.inputRef;

  return {
    attemptRef: stableHash("mouse-click-attempt", [inputRef, input.capabilityCallId, input.childCapabilityId]), inputRef, childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId, sourceChildCapabilityId: input.sourceChildCapabilityId, missionId: input.missionId, runId: input.runId,
    sessionId: input.sessionId, roundId: input.roundId, videoVisitId: input.videoVisitId, stepId: input.stepId, bindingPackageId: input.bindingPackageId,
    bindingPackageVersion: input.bindingPackageVersion, selectedBindingId: input.selectedBindingId, bindingVersion: input.bindingVersion,
    bindingSnapshotRef: input.bindingSnapshotRef, capabilityCallId: input.capabilityCallId, nerveBusEnvelopeId: input.nerveBusEnvelopeId,
    requestedBy: input.requestedBy, purpose: input.purpose, sourceRef: input.sourceRef, geometryGuardRef: input.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProof.proofId, geometryGuardOutputRef: input.geometryGuardOutputRef,
    geometryGuardRuntimeProofRef: input.geometryGuardRuntimeProofRef, sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    sourceEvidenceRef: input.sourceEvidenceRef, sourceTargetRef: input.sourceTargetRef, sourceVisualTargetResultRef: input.sourceVisualTargetResultRef,
    parseErrorRef: null, receivedShapeHash: null, coordinateSpace: input.geometryGuardNormalizedCoordinateSpace,
    sourceCoordinateSpace: input.geometryGuardNormalizedCoordinateSpace, requestedCoordinate: input.geometryGuardNormalizedClickPoint,
    sourceBounds: input.geometryGuardProof.sourceBounds, targetBounds: input.bounds, button: input.button, clickCount: input.clickCount,
    timeoutMs: input.timeoutMs, safetyPolicy: input.safetyPolicy,
  };
};