import { createHash } from "node:crypto";

import type { LocalAiDebugEvent } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import { type StructuredAiImageInput } from "../../../types/structured-log.js";
import type { ParsedAiAbilityInput } from "../contract.js";
import { resolveAiRuntimeTimeoutMs } from "../runtime/local-ai-runtime-policy.js";
import { resolveAiInputProofSummary } from "../shared/ai-input-proof-registry.js";
import type { AiRuntimeStructuredDebugEvent, CollectedDebugState } from "./local-ai-runtime-debug-contract.js";

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toStructuredImageInputs(items: LocalAiDebugEvent["imageInputs"] | undefined): StructuredAiImageInput[] {
  return (items ?? []).map((item) => ({
    refId: normalizeText(item.refId),
    artifactRef: normalizeText(item.artifactRef),
    filePath: normalizeText(item.filePath),
    hash: normalizeText(item.hash),
    bytes: typeof item.bytes === "number" ? item.bytes : null,
    width: typeof item.width === "number" ? item.width : null,
    height: typeof item.height === "number" ? item.height : null,
  }));
}

function buildRequestImageInputs(request: ParsedAiAbilityInput): StructuredAiImageInput[] {
  return request.inputRefs.flatMap((ref) => {
    const proof = resolveAiInputProofSummary(ref.id);
    return proof ? [{
      refId: proof.promptInputRef,
      artifactRef: proof.aiInputArtifactRef,
      filePath: proof.aiInputStorageRef,
      hash: proof.preparedImageHash,
      bytes: null,
      width: proof.preparedImageWidth,
      height: proof.preparedImageHeight,
    }] : [];
  });
}

function mergeImageInputs(existing: StructuredAiImageInput[], incoming: StructuredAiImageInput[]): StructuredAiImageInput[] {
  const merged = [...existing];
  for (const item of incoming) {
    const index = merged.findIndex((candidate) =>
      (item.refId && candidate.refId === item.refId)
      || (item.filePath && candidate.filePath === item.filePath)
    );
    if (index === -1) {
      merged.push(item);
      continue;
    }
    const current = merged[index]!;
    merged[index] = {
      refId: item.refId ?? current.refId,
      artifactRef: item.artifactRef ?? current.artifactRef,
      filePath: item.filePath ?? current.filePath,
      hash: item.hash ?? current.hash,
      bytes: item.bytes ?? current.bytes,
      width: item.width ?? current.width,
      height: item.height ?? current.height,
    };
  }
  return merged;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function estimateImageBytes(imageInput: StructuredAiImageInput): number | null {
  if (typeof imageInput.bytes === "number") {
    return imageInput.bytes;
  }
  return typeof imageInput.width === "number" && typeof imageInput.height === "number"
    ? imageInput.width * imageInput.height * 4
    : null;
}

function buildDebugRefs(request: ParsedAiAbilityInput, imageInputs: StructuredAiImageInput[]): string[] {
  const visionInput = readRecord(request.input);
  const estimatedInputBytes = imageInputs.reduce<number | null>((total, imageInput) => {
    const estimatedBytes = estimateImageBytes(imageInput);
    if (estimatedBytes === null) {
      return total;
    }
    return (total ?? 0) + estimatedBytes;
  }, null);
  const maxImageWidth = imageInputs.reduce<number | null>((currentMax, imageInput) => {
    return typeof imageInput.width === "number" && Number.isFinite(imageInput.width)
      ? Math.max(currentMax ?? 0, imageInput.width)
      : currentMax;
  }, null);

  return [
    ...request.inputRefs.map((ref) => ref.id),
    `timeoutMs=${resolveAiRuntimeTimeoutMs(request.taskType)}`,
    `imageCount=${imageInputs.length}`,
    ...(typeof maxImageWidth === "number" ? [`imageMaxWidth=${maxImageWidth}`] : []),
    ...(typeof estimatedInputBytes === "number" ? [`estimatedInputBytes=${estimatedInputBytes}`] : []),
    ...(typeof visionInput?.inputMode === "string" ? [`inputMode=${visionInput.inputMode}`] : []),
    ...(typeof visionInput?.samplingStrategy === "string" ? [`samplingStrategy=${visionInput.samplingStrategy}`] : []),
    ...(typeof visionInput?.validFrameCount === "number" ? [`validFrameCount=${visionInput.validFrameCount}`] : []),
    ...(typeof visionInput?.expectedFrameCount === "number" ? [`expectedFrameCount=${visionInput.expectedFrameCount}`] : []),
    ...(typeof visionInput?.fallbackReason === "string" ? [`fallbackReason=${visionInput.fallbackReason}`] : []),
  ];
}

function createCollectedDebugState(request: ParsedAiAbilityInput, promptDebugRef: string): CollectedDebugState {
  const imageInputs = buildRequestImageInputs(request);
  const firstProof = request.inputRefs.map((ref) => resolveAiInputProofSummary(ref.id)).find((proof): proof is NonNullable<ReturnType<typeof resolveAiInputProofSummary>> => proof !== null) ?? null;
  return {
    provider: "local",
    model: null,
    modelRole: null,
    runtime: null,
    implementationStatus: null,
    errorKind: null,
    runtimeCallId: null,
    diagnosticPayloadRef: null,
    schemaIssueCount: null,
    promptContractId: request.promptContractId,
    promptVersion: null,
    outputSchemaRef: request.expectedOutputSchema,
    promptDebugRef,
    systemPromptHash: null,
    userPromptHash: null,
    promptPreview: null,
    promptFullText: null,
    rawResponsePreview: null,
    rawResponseText: null,
    providerRequestBodyRedacted: null,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: [],
    sourceScreenshotEvidenceId: firstProof?.sourceScreenshotEvidenceId ?? null,
    aiInputArtifactRef: firstProof?.aiInputArtifactRef ?? request.inputRefs[0]?.id ?? null,
    imageInputs,
    tokenEstimate: null,
    requestEmitted: false,
    rawResponseEmitted: false,
    normalizedResponseEmitted: false,
    responseEmitted: false,
  };
}

function updateDebugState(state: CollectedDebugState, event: LocalAiDebugEvent) {
  state.model = normalizeText(event.modelName) ?? state.model;
  state.modelRole = normalizeText(event.modelRole) ?? state.modelRole;
  state.runtime = normalizeText(event.runtime) ?? state.runtime;
  state.promptContractId = normalizeText(event.promptContractId) ?? state.promptContractId;
  state.promptVersion = normalizeText(event.promptVersion) ?? state.promptVersion;
  state.outputSchemaRef = normalizeText(event.outputSchemaRef) ?? state.outputSchemaRef;
  state.systemPromptHash = normalizeText(event.systemPromptHash) ?? state.systemPromptHash;
  state.userPromptHash = normalizeText(event.userPromptHash) ?? state.userPromptHash;
  state.promptPreview = normalizeText(event.promptPreview) ?? state.promptPreview;
  state.promptFullText = normalizeText(event.promptFullText) ?? state.promptFullText;
  state.rawResponsePreview = normalizeText(event.rawResponsePreview) ?? state.rawResponsePreview;
  state.rawResponseText = normalizeText(event.rawResponseText) ?? state.rawResponseText;
  state.parsedJson = event.parsedJson ?? state.parsedJson;
  state.parsedDecision = normalizeText(event.parsedDecision) ?? state.parsedDecision;
  state.parserErrors = event.parserErrors ?? state.parserErrors;
  if ((event.parserErrors ?? []).length > 0) {
    state.schemaIssueCount = event.parserErrors!.length;
  }
  state.sourceScreenshotEvidenceId = normalizeText(event.sourceScreenshotEvidenceId) ?? state.sourceScreenshotEvidenceId;
  state.aiInputArtifactRef = normalizeText(event.aiInputArtifactRef) ?? state.aiInputArtifactRef;
  state.tokenEstimate = typeof event.tokenEstimate === "number" ? event.tokenEstimate : state.tokenEstimate;
  if ((event.imageInputs ?? []).length > 0) {
    state.imageInputs = mergeImageInputs(state.imageInputs, toStructuredImageInputs(event.imageInputs));
  }
}

const buildDebugTraceFields = (args: {
  request: ParsedAiAbilityInput;
  state: CollectedDebugState;
  traceId: string;
  runtimeCallId: string | null;
}) => ({
    sessionId: args.request.sessionId,
    missionId: args.request.missionId,
    runId: args.request.runId,
    roundId: args.request.roundId,
    videoVisitId: args.request.videoVisitId,
    stepId: args.request.stepId,
    capabilityCallId: args.request.capabilityCallId,
    nerveBusEnvelopeId: args.request.nerveBusEnvelopeId,
    inputRef: args.request.inputRefs[0]?.id ?? null,
    idempotencyKey: args.runtimeCallId,
    traceId: args.traceId,
    spanId: args.runtimeCallId ?? `${args.request.sessionId}:${args.request.taskType}`,
    attemptId: `${args.runtimeCallId ?? args.request.sessionId}:attempt:0`,
    taskType: args.request.taskType,
    refs: buildDebugRefs(args.request, args.state.imageInputs),
});

const buildDebugPromptFields = (args: {
  request: ParsedAiAbilityInput;
  state: CollectedDebugState;
  promptDebugRef: string;
  runtimeCallId: string | null;
  rawOutputRef: string;
}) => ({
    provider: args.state.provider,
    model: args.state.model,
    modelRole: args.state.modelRole,
    runtime: args.state.runtime,
    implementationStatus: args.state.implementationStatus,
    runtimeCallId: args.state.runtimeCallId ?? args.runtimeCallId,
    diagnosticPayloadRef: args.state.diagnosticPayloadRef ?? args.rawOutputRef,
    schemaIssueCount: args.state.schemaIssueCount,
    promptContractId: args.state.promptContractId,
    promptVersion: args.state.promptVersion,
    outputSchemaRef: args.state.outputSchemaRef,
    promptDebugRef: args.promptDebugRef,
    systemPromptHash: args.state.systemPromptHash,
    userPromptHash: args.state.userPromptHash,
    promptPreview: args.state.promptPreview,
    promptFullText: args.state.promptFullText,
});

const buildDebugResponseFields = (args: {
  state: CollectedDebugState;
  rawOutputRef: string;
}) => ({
    rawResponsePreview: args.state.rawResponsePreview,
    rawResponseText: args.state.rawResponseText,
    rawResponseHash: args.state.rawResponseText ? hashValue(args.state.rawResponseText) : null,
    rawResponseRef: args.rawOutputRef,
    parsedJson: args.state.parsedJson,
    parsedDecision: args.state.parsedDecision,
    parserErrors: [...args.state.parserErrors],
});

const buildDebugCatalogRefs = () => ({
  inputPackageId: null,
  inputPackageVersion: null,
  inputPackageHash: null,
  capabilityCatalogVersion: null,
  outputSchemaCatalogVersion: null,
});

function buildBaseDebugEvent(args: {
  request: ParsedAiAbilityInput;
  state: CollectedDebugState;
  traceId: string;
  runtimeCallId: string | null;
  rawOutputRef: string;
  promptDebugRef: string;
}): Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs"> {
  return {
    ...buildDebugTraceFields(args),
    ...buildDebugPromptFields(args),
    ...buildDebugResponseFields(args),
    promptCatalogVersion: args.request.promptCatalogVersion,
    providerConfigRef: args.request.providerPolicy.providerConfigRef,
    secretRef: args.request.providerPolicy.secretRef,
    ...buildDebugCatalogRefs(),
    promptDebugBundleRef: args.promptDebugRef,
    providerRequestBodyRedacted: args.state.providerRequestBodyRedacted,
    providerRequestDebugRef: args.promptDebugRef,
    sourceScreenshotEvidenceId: args.state.sourceScreenshotEvidenceId,
    aiInputArtifactRef: args.state.aiInputArtifactRef,
    imageInputs: [...args.state.imageInputs],
    tokenEstimate: args.state.tokenEstimate,
  };
}

export {
  hashValue,
  createCollectedDebugState,
  updateDebugState,
  buildBaseDebugEvent,
};
