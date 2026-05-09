import {
  resolveAbilityResultContractSnapshot,
  type AbilityResultContractSnapshot,
} from "../../capabilities/orchestration/index.js";
import {
  parseGeometryGuardMouseClickHandoff,
  parseMouseClickPostVerificationHandoff,
  parseVisualTargetGeometryGuardHandoff,
  type GeometryGuardMouseClickHandoff,
  type MouseClickPostVerificationHandoff,
  type VisualTargetGeometryGuardHandoff,
} from "../../capabilities/shared/muscle-joint-contracts.js";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonRecord | null, key: string): string | null => {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

const readNumber = (value: JsonRecord | null, key: string): number | null => {
  const candidate = value?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

const readStringArray = (value: JsonRecord | null, key: string): string[] => {
  const candidate = value?.[key];
  return Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
};

const readObject = (value: JsonRecord | null, key: string): JsonRecord | null => {
  const candidate = value?.[key];
  return isRecord(candidate) ? candidate : null;
};

const resolveSuccessfulSnapshot = (
  outputRef: string | null | undefined,
  abilityGroupId: string,
): AbilityResultContractSnapshot | null => {
  const snapshot = resolveAbilityResultContractSnapshot(outputRef);
  if (!snapshot || snapshot.abilityGroupId !== abilityGroupId || snapshot.status !== "success") {
    return null;
  }
  return snapshot;
};

export const resolveVisualTargetGeometryHandoff = (
  visualTargetResultRef: string | null | undefined,
): VisualTargetGeometryGuardHandoff | null => {
  const snapshot = resolveSuccessfulSnapshot(visualTargetResultRef, "visual-target");
  const resultOutput = isRecord(snapshot?.output) ? snapshot.output : null;
  const actionOutput = readObject(resultOutput, "output");
  const handoff = readObject(actionOutput, "geometryGuardHandoff");

  if (!snapshot || !resultOutput || !actionOutput || !handoff) {
    return null;
  }

  return parseVisualTargetGeometryGuardHandoff({
    handoffRef: readString(actionOutput, "geometryGuardHandoffRef"),
    sourceVisualTargetResultRef: visualTargetResultRef,
    sourceTargetRef: readString(actionOutput, "targetId"),
    sourceScreenshotEvidenceRef: readString(actionOutput, "sourceScreenshotEvidenceId"),
    sourceAiResultRef: readString(actionOutput, "sourceAiResultRef"),
    sourcePageStateProofRef: readString(actionOutput, "sourcePageStateProofRef"),
    bbox: readObject(handoff, "boundingBox") ?? readObject(actionOutput, "boundingBox"),
    clickPoint: readObject(handoff, "clickPoint") ?? readObject(actionOutput, "candidateClickPoint"),
    coordinateSpace: readString(handoff, "coordinateSpace") ?? readString(actionOutput, "coordinateSpace"),
    targetType: readString(resultOutput, "targetType"),
    targetNature: readString(resultOutput, "targetNature"),
    confidence: readNumber(actionOutput, "confidence"),
    dataQualityFlags: readStringArray(resultOutput, "dataQualityFlags"),
  });
};

export const resolveGeometryGuardClickHandoff = (
  geometryGuardResultRef: string | null | undefined,
): GeometryGuardMouseClickHandoff | null => {
  const snapshot = resolveSuccessfulSnapshot(geometryGuardResultRef, "geometry-guard");
  const runtimeProof = isRecord(snapshot?.runtimeProof) ? snapshot.runtimeProof : null;
  const resultOutput = isRecord(snapshot?.output) ? snapshot.output : null;
  const executableOutput = readObject(resultOutput, "output");
  const normalizedBbox = readObject(executableOutput, "normalizedBbox")
    ?? readObject(runtimeProof, "bboxAfter")
    ?? readObject(resultOutput, "normalizedBbox");

  if (!snapshot || !runtimeProof || !resultOutput || !executableOutput || !normalizedBbox) {
    return null;
  }

  return parseGeometryGuardMouseClickHandoff({
    childCapabilityId: readString(resultOutput, "childCapabilityId"),
    sourceAbilityGroupId: readString(runtimeProof, "sourceAbilityGroupId") ?? "visual-target",
    sourceChildCapabilityId: readString(runtimeProof, "sourceChildCapabilityId"),
    geometryGuardRef: readString(resultOutput, "geometryGuardRef"),
    geometryGuardInputRef: readString(runtimeProof, "inputRef"),
    geometryGuardProofRef: readString(runtimeProof, "proofId"),
    geometryGuardOutputRef: readString(resultOutput, "outputRef"),
    geometryGuardRuntimeProofRef: readString(runtimeProof, "proofId"),
    sourceRef: readString(runtimeProof, "sourceRef"),
    sourceVisualTargetResultRef: readString(resultOutput, "sourceVisualTargetResultRef"),
    sourceTargetRef: readString(resultOutput, "sourceTargetRef"),
    sourceScreenshotEvidenceRef: readString(resultOutput, "sourceScreenshotEvidenceRef"),
    sourceAiResultRef: readString(resultOutput, "sourceAiResultRef"),
    sourcePageStateProofRef: readString(resultOutput, "sourcePageStateProofRef"),
    normalizedCoordinateSpace: readString(resultOutput, "normalizedCoordinateSpace"),
    normalizedClickPoint: readObject(resultOutput, "normalizedClickPoint"),
    normalizedBbox,
    guardDecision: readString(resultOutput, "guardDecision"),
  });
};

export const resolveMouseClickPostVerificationHandoff = (
  clickResultRef: string | null | undefined,
): MouseClickPostVerificationHandoff | null => {
  const snapshot = resolveSuccessfulSnapshot(clickResultRef, "mouse-click");
  const resultOutput = isRecord(snapshot?.output) ? snapshot.output : null;
  const actionOutput = readObject(resultOutput, "output");
  const runtimeProof = isRecord(snapshot?.runtimeProof) ? snapshot.runtimeProof : null;

  if (!snapshot || !resultOutput || !actionOutput || !runtimeProof) {
    return null;
  }

  return parseMouseClickPostVerificationHandoff({
    clickResultRef,
    postActionVerificationHandoffRef: readString(actionOutput, "postActionVerificationHandoffRef"),
    actionExecutionRef: readString(actionOutput, "actionExecutionRef"),
    primitiveExecutionRef: readString(actionOutput, "primitiveExecutionRef"),
    actionStartedAt: readString(runtimeProof, "primitiveStartedAt") ?? readString(runtimeProof, "startedAt"),
    actionEndedAt: readString(runtimeProof, "primitiveEndedAt") ?? readString(runtimeProof, "endedAt"),
    sourceActionRuntimeProofRef: readString(runtimeProof, "proofId"),
    sourceActionAbilityGroupId: readString(resultOutput, "abilityGroupId") ?? "mouse-click",
    sourceActionChildCapabilityId: readString(resultOutput, "childCapabilityId") ?? "click-browser-coordinate",
    geometryGuardRef: readString(runtimeProof, "geometryGuardRef"),
    geometryGuardProofRef: readString(resultOutput, "geometryGuardProofRef") ?? readString(runtimeProof, "geometryGuardProofRef"),
    sourceCoordinateProofRef: readString(runtimeProof, "sourceCoordinateProofRef"),
    sourceTargetRef: readString(runtimeProof, "sourceTargetRef"),
    sourceVisualTargetResultRef: readString(resultOutput, "sourceVisualTargetResultRef") ?? readString(runtimeProof, "sourceVisualTargetResultRef"),
    normalizedClickPoint: readObject(actionOutput, "normalizedClickPoint"),
    coordinateSpace: readString(actionOutput, "coordinateSpace"),
    button: readString(actionOutput, "button"),
    clickCount: readNumber(actionOutput, "clickCount"),
  });
};