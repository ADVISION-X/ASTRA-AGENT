import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonObject | null | undefined, key: string): string | null => {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

const readNumber = (value: JsonObject | null | undefined, key: string): number | null => {
  const candidate = value?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

const readObject = (value: JsonObject | null | undefined, key: string): JsonObject | null => {
  const candidate = value?.[key];
  return isObject(candidate) ? candidate : null;
};

const readBoolean = (value: JsonObject | null | undefined, key: string): boolean | null => {
  const candidate = value?.[key];
  return typeof candidate === "boolean" ? candidate : null;
};

const readStringArray = (value: JsonObject | null | undefined, key: string): string | null => {
  const candidate = value?.[key];
  return Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string" && entry.length > 0).join(",")
    : null;
};

type GeometryGuardSummaryFields = Record<string, string | number | boolean | null>;

const resolveGeometryGuardIdentityFields = (
  resultRecord: JsonObject | null,
  runtimeProof: JsonObject,
): GeometryGuardSummaryFields => ({
  geometryGuardChildCapabilityId: readString(resultRecord, "childCapabilityId") ?? readString(runtimeProof, "childCapabilityId"),
  geometryGuardRef: readString(resultRecord, "geometryGuardRef"),
  geometryGuardInputRef: readString(runtimeProof, "inputRef"),
  geometryGuardOutputRef: readString(resultRecord, "outputRef") ?? readString(runtimeProof, "outputRef"),
  geometryGuardProofRef: readString(runtimeProof, "proofId"),
  geometryGuardRuntimeProofRef: readString(runtimeProof, "proofId"),
});

const resolveGeometryGuardMissionFields = (
  resultRecord: JsonObject | null,
  runtimeProof: JsonObject,
): GeometryGuardSummaryFields => ({
  missionId: readString(runtimeProof, "missionId") ?? readString(resultRecord, "missionId"),
  runId: readString(runtimeProof, "runId") ?? readString(resultRecord, "runId"),
  sessionId: readString(runtimeProof, "sessionId") ?? readString(resultRecord, "sessionId"),
  roundId: readString(runtimeProof, "roundId") ?? readString(resultRecord, "roundId"),
  videoVisitId: readString(runtimeProof, "videoVisitId") ?? readString(resultRecord, "videoVisitId"),
  stepId: readString(runtimeProof, "stepId") ?? readString(resultRecord, "stepId"),
  mapPackageId: readString(runtimeProof, "mapPackageId") ?? readString(resultRecord, "mapPackageId"),
  mapPackageVersion: readString(runtimeProof, "mapPackageVersion") ?? readString(resultRecord, "mapPackageVersion"),
  selectedMapId: readString(runtimeProof, "selectedMapId") ?? readString(resultRecord, "selectedMapId"),
  selectedMapVersion: readString(runtimeProof, "selectedMapVersion") ?? readString(resultRecord, "selectedMapVersion"),
  activationSnapshotRef: readString(runtimeProof, "activationSnapshotRef") ?? readString(resultRecord, "activationSnapshotRef"),
  capabilityCallId: readString(runtimeProof, "capabilityCallId") ?? readString(resultRecord, "capabilityCallId"),
  nerveBusEnvelopeId: readString(runtimeProof, "nerveBusEnvelopeId") ?? readString(resultRecord, "nerveBusEnvelopeId"),
});

const resolveGeometryGuardSourceFields = (
  resultRecord: JsonObject | null,
  runtimeProof: JsonObject,
  output: JsonObject | null,
  normalizedClickPoint: JsonObject | null,
): GeometryGuardSummaryFields => ({
  sourceAbilityGroupId: readString(runtimeProof, "sourceAbilityGroupId"),
  sourceChildCapabilityId: readString(runtimeProof, "sourceChildCapabilityId"),
  sourceRef: readString(runtimeProof, "sourceRef"),
  sourceScreenshotEvidenceRef: readString(resultRecord, "sourceScreenshotEvidenceRef") ?? readString(runtimeProof, "sourceScreenshotEvidenceRef"),
  sourceTargetRef: readString(resultRecord, "sourceTargetRef") ?? readString(runtimeProof, "sourceTargetRef"),
  sourceAiResultRef: readString(resultRecord, "sourceAiResultRef") ?? readString(runtimeProof, "sourceAiResultRef"),
  sourceVisualTargetResultRef: readString(resultRecord, "sourceVisualTargetResultRef") ?? readString(runtimeProof, "sourceVisualTargetResultRef"),
  riskLevel: readString(resultRecord, "riskLevel") ?? readString(runtimeProof, "riskLevel"),
  requiresPostClickAiVerification: readBoolean(resultRecord, "requiresPostClickAiVerification") ?? readBoolean(runtimeProof, "requiresPostClickAiVerification"),
  fallbackReason: readString(resultRecord, "fallbackReason") ?? readString(runtimeProof, "fallbackReason"),
  targetSemanticOwner: readString(resultRecord, "targetSemanticOwner") ?? readString(runtimeProof, "targetSemanticOwner"),
  actionableMessage: readString(resultRecord, "actionableMessage") ?? readString(runtimeProof, "actionableMessage"),
  dataQualityFlags: readStringArray(resultRecord, "dataQualityFlags") ?? readStringArray(runtimeProof, "dataQualityFlags"),
  normalizedCoordinateSpace: readString(resultRecord, "normalizedCoordinateSpace")
    ?? readString(output, "normalizedCoordinateSpace")
    ?? readString(runtimeProof, "normalizedCoordinateSpace"),
  normalizedClickPointX: readNumber(normalizedClickPoint, "x"),
  normalizedClickPointY: readNumber(normalizedClickPoint, "y"),
});

export function buildGeometryGuardProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): GeometryGuardSummaryFields {
  if (input.result.abilityGroupId !== "geometry-guard" || input.result.status !== "success" || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const resultRecord = isObject(input.result) ? input.result : null;
  const output = isObject(input.result.output) ? input.result.output : null;
  const runtimeProof = input.result.runtimeProof;
  const normalizedClickPoint = readObject(resultRecord, "normalizedClickPoint")
    ?? readObject(output, "normalizedClickPoint")
    ?? readObject(runtimeProof, "clickPointAfter");

  return {
    ...resolveGeometryGuardIdentityFields(resultRecord, runtimeProof),
    ...resolveGeometryGuardMissionFields(resultRecord, runtimeProof),
    ...resolveGeometryGuardSourceFields(resultRecord, runtimeProof, output, normalizedClickPoint),
  };
}
