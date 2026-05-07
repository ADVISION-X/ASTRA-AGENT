import { createHash } from "node:crypto";

import type { LocalAiDebugEvent } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import { type StructuredAiImageInput } from "../../../types/structured-log.js";
import type { ParsedAiAbilityInput } from "../contract.js";
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

function createCollectedDebugState(request: ParsedAiAbilityInput, promptDebugRef: string): CollectedDebugState {
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
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: request.inputRefs[0]?.id ?? null,
    imageInputs: [],
    tokenEstimate: null,
    requestEmitted: false,
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
  state.sourceScreenshotEvidenceId = normalizeText(event.sourceScreenshotEvidenceId) ?? state.sourceScreenshotEvidenceId;
  state.aiInputArtifactRef = normalizeText(event.aiInputArtifactRef) ?? state.aiInputArtifactRef;
  state.tokenEstimate = typeof event.tokenEstimate === "number" ? event.tokenEstimate : state.tokenEstimate;
  if ((event.imageInputs ?? []).length > 0) {
    state.imageInputs = toStructuredImageInputs(event.imageInputs);
  }
}

const buildDebugTraceFields = (args: {
  request: ParsedAiAbilityInput;
  traceId: string;
  runtimeCallId: string | null;
}) => ({
    sessionId: args.request.sessionId,
    missionId: args.request.missionId,
    runId: args.request.missionId ?? args.request.sessionId,
    roundId: args.request.roundId,
    videoVisitId: args.request.videoVisitId,
    stepId: args.request.stepId,
    mapPackageId: args.request.mapPackageId,
    mapPackageVersion: args.request.mapPackageVersion,
    selectedMapId: args.request.selectedMapId,
    selectedMapVersion: args.request.selectedMapVersion,
    activationSnapshotRef: args.request.activationSnapshotRef,
    capabilityCallId: args.request.capabilityCallId,
    nerveBusEnvelopeId: args.request.nerveBusEnvelopeId,
    inputRef: args.request.inputRefs[0]?.id ?? null,
    idempotencyKey: args.runtimeCallId,
    traceId: args.traceId,
    spanId: args.runtimeCallId ?? `${args.request.sessionId}:${args.request.taskType}`,
    attemptId: `${args.runtimeCallId ?? args.request.sessionId}:attempt:0`,
    taskType: args.request.taskType,
    refs: args.request.inputRefs.map((ref) => ref.id),
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

const buildMapAuthoringDebugRefs = (request: ParsedAiAbilityInput) => ({
  inputPackageId: request.taskType === "map_authoring" ? request.input.inputPackageId : null,
  inputPackageVersion: request.taskType === "map_authoring" ? request.input.inputPackageVersion : null,
  inputPackageHash: request.taskType === "map_authoring" ? `sha256:${hashValue(request.input)}` : null,
  capabilityCatalogVersion: request.taskType === "map_authoring" ? request.input.capabilityCatalog.version : null,
  outputSchemaCatalogVersion: request.taskType === "map_authoring" ? request.input.outputSchemaCatalog.version : null,
  mapPackageSchemaVersion: request.taskType === "map_authoring" ? request.input.mapPackageSchema.schemaVersion : null,
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
    ...buildMapAuthoringDebugRefs(args.request),
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
