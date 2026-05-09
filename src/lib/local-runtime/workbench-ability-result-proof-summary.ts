import { recordAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { buildGeometryGuardProofSummary } from "./workbench-ability-result-proof-summary-geometry-guard.js";
import { buildPrepareAiInputProofSummary } from "./workbench-ability-result-proof-summary-prepare-ai-input.js";
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

const readFirstObjectInArray = (value: JsonObject | null | undefined, key: string): JsonObject | null => {
  const candidate = value?.[key];
  return Array.isArray(candidate) && isObject(candidate[0]) ? candidate[0] : null;
};

function buildScreenshotProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  if (input.result.abilityGroupId !== "screenshot" || input.result.status !== "success" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  const artifactRef = isObject(output.artifactRef) ? output.artifactRef : isObject(runtimeProof.artifactRef) ? runtimeProof.artifactRef : null;
  return {
    screenshotEvidenceId: readString(output, "evidenceId") ?? readString(runtimeProof, "screenshotEvidenceId"),
    artifactRef: readString(artifactRef, "artifactId"),
    artifactStorageRef: readString(artifactRef, "storageRef"),
    pageUrl: readString(output, "pageUrl") ?? readString(runtimeProof, "pageUrl"),
    pageTitle: readString(output, "pageTitle") ?? readString(runtimeProof, "pageTitle"),
    outputHash: readString(output, "outputHash") ?? readString(runtimeProof, "outputHash"),
    artifactHash: readString(output, "artifactHash") ?? readString(runtimeProof, "artifactHash") ?? readString(artifactRef, "sha256"),
    byteSize: readNumber(output, "byteSize") ?? readNumber(runtimeProof, "byteSize"),
    width: readNumber(output, "width") ?? readNumber(runtimeProof, "outputWidth"),
    height: readNumber(output, "height") ?? readNumber(runtimeProof, "outputHeight"),
    coordinateSpace: readString(output, "coordinateSpace") ?? readString(runtimeProof, "coordinateSpace"),
    runtimeProofRef: readString(runtimeProof, "proofId"),
  };
}

function buildVisualTargetProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  if (input.result.abilityGroupId !== "visual-target" || input.result.status !== "success" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  const visualOutput = readObject(output, "output");
  const boundingBox = readObject(visualOutput, "boundingBox") ?? readObject(runtimeProof, "boundingBox");
  const clickPoint = readObject(visualOutput, "candidateClickPoint") ?? readObject(runtimeProof, "clickPoint");
  return {
    visualTargetRef: readString(output, "outputRef") ?? readString(runtimeProof, "outputRef"),
    sourceTargetRef: readString(visualOutput, "targetId") ?? readString(runtimeProof, "targetId"),
    sourceAiResultRef: readString(visualOutput, "sourceAiResultRef") ?? readString(runtimeProof, "sourceAiResultRef"),
    sourceVisualTargetResultRef: readString(output, "outputRef") ?? readString(runtimeProof, "outputRef"),
    sourceScreenshotEvidenceRef: readString(visualOutput, "sourceScreenshotEvidenceId") ?? readString(runtimeProof, "sourceScreenshotEvidenceId"),
    sourceGeometryHandoffRef: readString(visualOutput, "geometryGuardHandoffRef") ?? readString(runtimeProof, "geometryGuardHandoffRef"),
    normalizedCoordinateSpace: readString(visualOutput, "coordinateSpace") ?? readString(runtimeProof, "coordinateSpace"),
    sourceBoundsX: readNumber(boundingBox, "x"),
    sourceBoundsY: readNumber(boundingBox, "y"),
    sourceBoundsWidth: readNumber(boundingBox, "width"),
    sourceBoundsHeight: readNumber(boundingBox, "height"),
    normalizedClickPointX: readNumber(clickPoint, "x"),
    normalizedClickPointY: readNumber(clickPoint, "y"),
  };
}

function buildMouseClickProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  if (input.result.abilityGroupId !== "mouse-click" || input.result.status !== "success" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  return {
    actionExecutionRef: readString(output, "actionExecutionRef") ?? readString(runtimeProof, "actionExecutionRef"),
    primitiveExecutionRef: readString(output, "primitiveExecutionRef") ?? readString(runtimeProof, "primitiveExecutionRef"),
    postClickObservationRef: readString(output, "postClickObservationRef") ?? readString(runtimeProof, "postClickObservationRef"),
    sourceEvidenceRef: readString(runtimeProof, "sourceEvidenceRef"),
    sourceTargetRef: readString(runtimeProof, "sourceTargetRef"),
    sourceCoordinateProofRef: readString(runtimeProof, "sourceCoordinateProofRef"),
    primitiveStartedAt: readString(runtimeProof, "primitiveStartedAt"),
    primitiveEndedAt: readString(runtimeProof, "primitiveEndedAt"),
    startedAt: readString(runtimeProof, "startedAt"),
    endedAt: readString(runtimeProof, "endedAt"),
    durationMs: readNumber(runtimeProof, "durationMs"),
  };
}

function buildMouseScrollProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  if (input.result.abilityGroupId !== "mouse-scroll" || input.result.status !== "success" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  return {
    scrollExecutionRef: readString(output, "scrollExecutionRef") ?? readString(runtimeProof, "scrollExecutionRef"),
    postClickObservationRef: readString(output, "postClickObservationRef") ?? readString(runtimeProof, "postClickObservationRef"),
    sourceEvidenceRef: readString(runtimeProof, "sourceEvidenceRef"),
    sourceTargetRef: readString(runtimeProof, "sourceTargetRef"),
    sourceCoordinateProofRef: readString(runtimeProof, "sourceCoordinateProofRef"),
    primitiveStartedAt: readString(runtimeProof, "primitiveStartedAt"),
    primitiveEndedAt: readString(runtimeProof, "primitiveEndedAt"),
    startedAt: readString(runtimeProof, "startedAt"),
    endedAt: readString(runtimeProof, "endedAt"),
    durationMs: readNumber(runtimeProof, "durationMs"),
  };
}

export function buildAbilityResultProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  const screenshotSummary = buildScreenshotProofSummary(input);
  const summary = {
    ...buildPrepareAiInputProofSummary({
      outputRef: input.outputRef,
      result: input.result,
      screenshotSummary,
    }),
    ...buildVisualTargetProofSummary(input),
    ...buildGeometryGuardProofSummary(input),
    ...buildMouseClickProofSummary(input),
    ...buildMouseScrollProofSummary(input),
  };
  if (Object.keys(summary).length > 0) {
    recordAbilityResultProofSummary(input.outputRef, summary);
  }
  return summary;
}
