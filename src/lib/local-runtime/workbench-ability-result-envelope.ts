import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchNerveBusHandledResult as NerveBusHandledResult } from "./workbench-nerve-bus-types.js";
import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";
import { recordAiInputProofSummary } from "../../capabilities/ai/shared/ai-input-proof-registry.js";
import { recordAbilityResultProofSummary } from "../../capabilities/orchestration/runtime/ability-result-proof-summary-registry.js";
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
  const sourceScreenshotEvidenceId = readString(output, "sourceScreenshotEvidenceId")
    ?? readString(scaleMapping, "sourceScreenshotEvidenceId")
    ?? readString(sourceProof, "sourceScreenshotEvidenceId")
    ?? readString(sourceArtifactRef, "evidenceId");
  const sourceStorageRef = readString(sourceArtifactRef, "storageRef") ?? readString(sourceProof, "sourceStorageRef") ?? readString(scaleMapping, "sourceStorageRef");
  const aiInputArtifactRef = readString(artifactRef, "artifactId");
  const preparedImageHash = readString(output, "outputHash") ?? readString(artifactRef, "sha256");
  const preparedImageWidth = readNumber(output, "width") ?? readNumber(runtimeProof, "outputWidth");
  const preparedImageHeight = readNumber(output, "height") ?? readNumber(runtimeProof, "outputHeight");
  const coordinateSpace = readString(output, "coordinateSpace") ?? readString(runtimeProof, "coordinateSpace");
  const prepareSummary = {
    ...screenshotSummary,
    promptInputRef: input.outputRef,
    aiInputArtifactRef,
    sourceScreenshotEvidenceId,
    sourceStorageRef,
    preparedImageHash,
    preparedImageWidth,
    preparedImageHeight,
    coordinateSpace,
  };

  if (aiInputArtifactRef && sourceScreenshotEvidenceId && sourceStorageRef && preparedImageHash && preparedImageWidth && preparedImageHeight && coordinateSpace === "ai_input_pixels") {
    recordAiInputProofSummary({
      promptInputRef: input.outputRef,
      aiInputArtifactRef,
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

function buildAbilityResultProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): Record<string, string | number | boolean | null> {
  const summary = buildPrepareAiInputProofSummary(input);
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
