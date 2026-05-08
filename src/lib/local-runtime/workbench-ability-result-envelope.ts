import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchNerveBusHandledResult as NerveBusHandledResult } from "./workbench-nerve-bus-types.js";
import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";
import { recordAiInputProofSummary } from "../../capabilities/ai/index.js";
import { recordAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { buildMirroredEnvelopeBase, buildPayloadDocument } from "./workbench-payload.js";
import { recordScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const describeAbilityFailure = (
  failure: WorkbenchAbilityExecutionResult["failureReason"],
): string | null => {
  if (!failure) {
    return null;
  }
  return typeof failure === "string" ? failure : failure.message ?? failure.code ?? "Ability dispatch failed.";
};

const buildAbilityResultSummary = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  failureReason: string | null;
}): string => input.result.status === "success"
  ? `${input.envelope.to} executed ${input.envelope.commandName}.`
  : input.failureReason ?? input.result.reviewRequiredReason ?? `${input.envelope.to} failed ${input.envelope.commandName}.`;

const buildAbilityResultPayload = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  summary: string;
  failureReason: string | null;
}) => buildPayloadDocument({
  documentType: "ability.result",
  documentRef: `${input.envelope.commandId}:result:payload`,
  summary: input.summary,
  content: {
    abilityGroupId: input.result.abilityGroupId,
    childCapabilityId: input.result.childCapabilityId ?? input.envelope.commandName,
    status: input.result.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.result.reviewRequiredReason ?? null,
    ...buildAbilityResultProofSummary({
      outputRef: `${input.envelope.commandId}:result:payload`,
      result: input.result,
    }),
  },
});

const buildAbilityResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
  summary: string;
  failureReason: string | null;
}): AbilityResultEnvelope => ({
  ...buildMirroredEnvelopeBase({
    channelId: "ability-to-orchestration",
    envelopeId: `${input.envelope.envelopeId}:result`,
    requestEnvelope: input.envelope,
    payloadRefs: { output: input.outputPayload.documentRef },
    summary: input.summary,
    tags: [input.envelope.to, input.envelope.commandName, input.result.status],
  }),
  envelopeKind: "ability_result",
  resultId: `${input.envelope.commandId}:result`,
  from: input.envelope.to,
  to: "orchestration",
  correlationEnvelopeId: input.envelope.envelopeId,
  correlationCapabilityCallId: input.envelope.capabilityCallId,
  correlationInputRef: input.envelope.inputRef,
  proofRef: `${input.envelope.envelopeId}:result:proof`,
  targetAbilityGroupId: input.envelope.targetAbilityGroupId,
  targetChildCapabilityId: input.envelope.targetChildCapabilityId,
  status: input.result.status,
  outputRef: input.result.status === "success" ? input.outputPayload.documentRef : null,
  diagnosticPayloadRef: input.result.status === "success" ? null : input.outputPayload.documentRef,
  failureReason: input.result.status === "failed" ? input.failureReason ?? "Ability dispatch failed." : null,
  reviewRequiredReason: input.result.status === "review_required"
    ? input.result.reviewRequiredReason ?? input.failureReason ?? "Ability dispatch requires review."
    : null,
});

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

function buildPrepareAiInputProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  const screenshotSummary = buildScreenshotProofSummary(input);
  if (input.result.childCapabilityId !== "prepare-ai-input" || !isObject(input.result.output) || !isObject(input.result.runtimeProof)) {
    return screenshotSummary;
  }

  const output = input.result.output;
  const runtimeProof = input.result.runtimeProof;
  const artifactRef = isObject(output.artifactRef) ? output.artifactRef : isObject(runtimeProof.artifactRef) ? runtimeProof.artifactRef : null;
  const sourceArtifactRef = isObject(runtimeProof.sourceArtifactRef) ? runtimeProof.sourceArtifactRef : null;
  const sourceProof = isObject(runtimeProof.sourceProof) ? runtimeProof.sourceProof : null;
  const scaleMapping = readObject(output, "scaleMapping") ?? readObject(runtimeProof, "scaleMapping");
  const firstImageInput = readFirstObjectInArray(output, "imageInputs") ?? readFirstObjectInArray(runtimeProof, "imageInputs");
  const sourceScreenshotEvidenceId = readString(output, "sourceScreenshotEvidenceId")
    ?? readString(scaleMapping, "sourceScreenshotEvidenceId")
    ?? readString(sourceProof, "sourceScreenshotEvidenceId")
    ?? readString(sourceArtifactRef, "evidenceId");
  const sourceStorageRef = readString(sourceArtifactRef, "storageRef") ?? readString(sourceProof, "sourceStorageRef") ?? readString(scaleMapping, "sourceStorageRef");
  const aiInputArtifactRef = readString(artifactRef, "artifactId") ?? readString(firstImageInput, "artifactRef");
  const aiInputStorageRef = readString(artifactRef, "storageRef") ?? readString(firstImageInput, "filePath");
  const preparedImageHash = readString(output, "outputHash") ?? readString(artifactRef, "sha256") ?? readString(firstImageInput, "hash");
  const preparedImageWidth = readNumber(output, "width") ?? readNumber(runtimeProof, "outputWidth") ?? readNumber(firstImageInput, "width");
  const preparedImageHeight = readNumber(output, "height") ?? readNumber(runtimeProof, "outputHeight") ?? readNumber(firstImageInput, "height");
  const coordinateSpace = readString(output, "coordinateSpace") ?? readString(runtimeProof, "coordinateSpace");
  const prepareSummary = {
    ...screenshotSummary,
    promptInputRef: input.outputRef,
    aiInputArtifactRef,
    aiInputStorageRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
    coordinateSpace,
      preparedInputSourceCoordinateSpace: readString(scaleMapping, "sourceCoordinateSpace"),
      preparedInputTargetCoordinateSpace: readString(scaleMapping, "targetCoordinateSpace"),
      preparedInputSourceWidth: readNumber(scaleMapping, "sourceWidth"),
      preparedInputSourceHeight: readNumber(scaleMapping, "sourceHeight"),
      preparedInputTargetWidth: readNumber(scaleMapping, "targetWidth"),
      preparedInputTargetHeight: readNumber(scaleMapping, "targetHeight"),
      preparedInputCropOffsetX: readNumber(scaleMapping, "cropOffsetX"),
      preparedInputCropOffsetY: readNumber(scaleMapping, "cropOffsetY"),
      preparedInputScaleX: readNumber(scaleMapping, "scaleX"),
      preparedInputScaleY: readNumber(scaleMapping, "scaleY"),
  };

  if (aiInputArtifactRef && aiInputStorageRef && sourceScreenshotEvidenceId && sourceStorageRef && preparedImageHash && preparedImageWidth && preparedImageHeight && coordinateSpace === "ai_input_pixels") {
    recordAiInputProofSummary({
      promptInputRef: input.outputRef,
      aiInputArtifactRef,
      aiInputStorageRef,
      sourceScreenshotEvidenceId,
      sourceStorageRef,
      preparedImageHash,
      preparedImageWidth,
      preparedImageHeight,
      coordinateSpace,
    });
  }

  return prepareSummary;
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
    postActionVerificationHandoffRef: readString(output, "postActionVerificationHandoffRef") ?? readString(runtimeProof, "postActionVerificationHandoffRef"),
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

function buildGeometryGuardProofSummary(input: {
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  if (input.result.abilityGroupId !== "geometry-guard" || input.result.status !== "success" || !isObject(input.result.runtimeProof)) {
    return {};
  }

  const resultRecord = input.result as unknown as JsonObject;
  const output = isObject(input.result.output) ? input.result.output : null;
  const runtimeProof = input.result.runtimeProof;
  const normalizedClickPoint = readObject(resultRecord, "normalizedClickPoint")
    ?? readObject(output, "normalizedClickPoint")
    ?? readObject(runtimeProof, "clickPointAfter");
  return {
    geometryGuardChildCapabilityId: input.result.childCapabilityId ?? readString(runtimeProof, "childCapabilityId"),
    geometryGuardRef: readString(resultRecord, "geometryGuardRef"),
    geometryGuardInputRef: readString(runtimeProof, "inputRef"),
    geometryGuardOutputRef: readString(resultRecord, "outputRef") ?? readString(runtimeProof, "outputRef"),
    geometryGuardProofRef: readString(runtimeProof, "proofId"),
    geometryGuardRuntimeProofRef: readString(runtimeProof, "proofId"),
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
    postActionVerificationHandoffRef: readString(output, "postActionVerificationHandoffRef") ?? readString(runtimeProof, "postActionVerificationHandoffRef"),
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

function buildAbilityResultProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  const summary = {
    ...buildPrepareAiInputProofSummary(input),
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

export const buildAbilityCommandResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
}): NerveBusHandledResult<AbilityResultEnvelope> => {
  const failureReason = describeAbilityFailure(input.result.failureReason);
  const summary = buildAbilityResultSummary({ envelope: input.envelope, result: input.result, failureReason });
  const outputPayload = buildAbilityResultPayload({ envelope: input.envelope, result: input.result, summary, failureReason });
  recordScreenshotSourceHandoff({ outputRef: outputPayload.documentRef, result: input.result });

  return {
    envelope: buildAbilityResultEnvelope({ envelope: input.envelope, result: input.result, outputPayload, summary, failureReason }),
    outputPayload,
  };
};
