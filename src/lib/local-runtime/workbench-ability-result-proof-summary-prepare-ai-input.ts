import { recordAiInputProofSummary } from "../../capabilities/ai/index.js";
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

const readFirstObjectInArray = (value: JsonObject | null | undefined, key: string): JsonObject | null => {
  const candidate = value?.[key];
  return Array.isArray(candidate) && isObject(candidate[0]) ? candidate[0] : null;
};

type PrepareAiInputProofSummaryContext = {
  summary: Record<string, string | number | boolean | null>;
  recordInput: {
    promptInputRef: string;
    aiInputArtifactRef: string;
    aiInputStorageRef: string;
    sourceScreenshotEvidenceId: string;
    sourceStorageRef: string;
    preparedImageHash: string;
    preparedImageWidth: number;
    preparedImageHeight: number;
    coordinateSpace: "ai_input_pixels";
  } | null;
};

type PrepareAiInputProofSummarySources = {
  output: JsonObject;
  runtimeProof: JsonObject;
  artifactRef: JsonObject | null;
  sourceArtifactRef: JsonObject | null;
  sourceProof: JsonObject | null;
  scaleMapping: JsonObject | null;
  firstImageInput: JsonObject | null;
};

type PrepareAiInputProofSummaryFields = {
  scaleMapping: JsonObject | null;
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  aiInputArtifactRef: string | null;
  aiInputStorageRef: string | null;
  preparedImageHash: string | null;
  preparedImageWidth: number | null;
  preparedImageHeight: number | null;
  coordinateSpace: string | null;
};

type PrepareAiInputProofSummaryDerived = {
  summary: Record<string, string | number | boolean | null>;
  recordInput: {
    promptInputRef: string;
    aiInputArtifactRef: string;
    aiInputStorageRef: string;
    sourceScreenshotEvidenceId: string;
    sourceStorageRef: string;
    preparedImageHash: string;
    preparedImageWidth: number;
    preparedImageHeight: number;
    coordinateSpace: "ai_input_pixels";
  } | null;
};

type PrepareAiInputProofSummaryRecordInput = NonNullable<PrepareAiInputProofSummaryDerived["recordInput"]>;

const buildPrepareAiInputProofSummarySummary = (
  input: {
    outputRef: string;
    screenshotSummary: Record<string, string | number | boolean | null>;
  },
  fields: PrepareAiInputProofSummaryFields,
) => ({
  ...input.screenshotSummary,
  promptInputRef: input.outputRef,
  aiInputArtifactRef: fields.aiInputArtifactRef,
  aiInputStorageRef: fields.aiInputStorageRef,
  sourceScreenshotEvidenceId: fields.sourceScreenshotEvidenceId,
  sourceStorageRef: fields.sourceStorageRef,
  preparedImageHash: fields.preparedImageHash,
  preparedImageWidth: fields.preparedImageWidth,
  preparedImageHeight: fields.preparedImageHeight,
  coordinateSpace: fields.coordinateSpace,
  preparedInputSourceCoordinateSpace: readString(fields.scaleMapping, "sourceCoordinateSpace"),
  preparedInputTargetCoordinateSpace: readString(fields.scaleMapping, "targetCoordinateSpace"),
  preparedInputSourceWidth: readNumber(fields.scaleMapping, "sourceWidth"),
  preparedInputSourceHeight: readNumber(fields.scaleMapping, "sourceHeight"),
  preparedInputTargetWidth: readNumber(fields.scaleMapping, "targetWidth"),
  preparedInputTargetHeight: readNumber(fields.scaleMapping, "targetHeight"),
  preparedInputCropOffsetX: readNumber(fields.scaleMapping, "cropOffsetX"),
  preparedInputCropOffsetY: readNumber(fields.scaleMapping, "cropOffsetY"),
  preparedInputScaleX: readNumber(fields.scaleMapping, "scaleX"),
  preparedInputScaleY: readNumber(fields.scaleMapping, "scaleY"),
});

const hasPrepareAiInputProofSummaryRecordInput = (
  fields: PrepareAiInputProofSummaryFields,
): fields is PrepareAiInputProofSummaryFields & {
  aiInputArtifactRef: string;
  aiInputStorageRef: string;
  sourceScreenshotEvidenceId: string;
  sourceStorageRef: string;
  preparedImageHash: string;
  preparedImageWidth: number;
  preparedImageHeight: number;
  coordinateSpace: "ai_input_pixels";
} => {
  const {
    aiInputArtifactRef,
    aiInputStorageRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
    coordinateSpace,
  } = fields;

  return Boolean(aiInputArtifactRef && aiInputStorageRef && sourceScreenshotEvidenceId && sourceStorageRef && preparedImageHash && preparedImageWidth && preparedImageHeight && coordinateSpace === "ai_input_pixels");
};

const buildPrepareAiInputProofSummaryRecordInputFields = (
  input: {
    outputRef: string;
  },
  fields: PrepareAiInputProofSummaryFields,
): PrepareAiInputProofSummaryRecordInput | null => {
  if (!hasPrepareAiInputProofSummaryRecordInput(fields)) {
    return null;
  }

  const {
    aiInputArtifactRef,
    aiInputStorageRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
  } = fields;

  return {
    promptInputRef: input.outputRef,
    aiInputArtifactRef,
    aiInputStorageRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
    coordinateSpace: "ai_input_pixels" as const,
  };
};

const resolvePrepareAiInputProofSummaryRecordInput = (
  input: {
    outputRef: string;
  },
  fields: PrepareAiInputProofSummaryFields,
): PrepareAiInputProofSummaryDerived["recordInput"] => buildPrepareAiInputProofSummaryRecordInputFields(input, fields);

const resolvePrepareAiInputProofSummarySources = (input: {
  result: WorkbenchAbilityExecutionResult;
}): PrepareAiInputProofSummarySources | null => {
  if (input.result.childCapabilityId !== "prepare-ai-input" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return null;
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  return {
    output,
    runtimeProof,
    artifactRef: isObject(output.artifactRef) ? output.artifactRef : isObject(runtimeProof.artifactRef) ? runtimeProof.artifactRef : null,
    sourceArtifactRef: isObject(runtimeProof.sourceArtifactRef) ? runtimeProof.sourceArtifactRef : null,
    sourceProof: isObject(runtimeProof.sourceProof) ? runtimeProof.sourceProof : null,
    scaleMapping: readObject(output, "scaleMapping") ?? readObject(runtimeProof, "scaleMapping"),
    firstImageInput: readFirstObjectInArray(output, "imageInputs") ?? readFirstObjectInArray(runtimeProof, "imageInputs"),
  };
};

const resolvePrepareAiInputProofSummaryFields = (sources: PrepareAiInputProofSummarySources): PrepareAiInputProofSummaryFields => ({
  scaleMapping: sources.scaleMapping,
  sourceScreenshotEvidenceId: readString(sources.output, "sourceScreenshotEvidenceId")
    ?? readString(sources.scaleMapping, "sourceScreenshotEvidenceId")
    ?? readString(sources.sourceProof, "sourceScreenshotEvidenceId")
    ?? readString(sources.sourceArtifactRef, "evidenceId"),
  sourceStorageRef: readString(sources.sourceArtifactRef, "storageRef") ?? readString(sources.sourceProof, "sourceStorageRef") ?? readString(sources.scaleMapping, "sourceStorageRef"),
  aiInputArtifactRef: readString(sources.artifactRef, "artifactId") ?? readString(sources.firstImageInput, "artifactRef"),
  aiInputStorageRef: readString(sources.artifactRef, "storageRef") ?? readString(sources.firstImageInput, "filePath"),
  preparedImageHash: readString(sources.output, "outputHash") ?? readString(sources.artifactRef, "sha256") ?? readString(sources.firstImageInput, "hash"),
  preparedImageWidth: readNumber(sources.output, "width") ?? readNumber(sources.runtimeProof, "outputWidth") ?? readNumber(sources.firstImageInput, "width"),
  preparedImageHeight: readNumber(sources.output, "height") ?? readNumber(sources.runtimeProof, "outputHeight") ?? readNumber(sources.firstImageInput, "height"),
  coordinateSpace: readString(sources.output, "coordinateSpace") ?? readString(sources.runtimeProof, "coordinateSpace"),
});

const buildPrepareAiInputProofSummaryDerived = (input: {
  outputRef: string;
  screenshotSummary: Record<string, string | number | boolean | null>;
}, fields: PrepareAiInputProofSummaryFields): PrepareAiInputProofSummaryDerived => {
  return {
    summary: buildPrepareAiInputProofSummarySummary(input, fields),
    recordInput: resolvePrepareAiInputProofSummaryRecordInput(input, fields),
  };
};

const resolvePrepareAiInputProofSummaryContext = (input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
  screenshotSummary: Record<string, string | number | boolean | null>;
}): PrepareAiInputProofSummaryContext | null => {
  const sources = resolvePrepareAiInputProofSummarySources({ result: input.result });
  if (sources === null) {
    return null;
  }

  const fields = resolvePrepareAiInputProofSummaryFields(sources);
  return buildPrepareAiInputProofSummaryDerived({ outputRef: input.outputRef, screenshotSummary: input.screenshotSummary }, fields);
};

export function buildPrepareAiInputProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
  screenshotSummary: Record<string, string | number | boolean | null>;
}) {
  const context = resolvePrepareAiInputProofSummaryContext(input);
  if (context === null) {
    return input.screenshotSummary;
  }

  if (context.recordInput !== null) {
    recordAiInputProofSummary(context.recordInput);
  }

  return context.summary;
}
