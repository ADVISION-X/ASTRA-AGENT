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

function buildBaseDebugEvent(args: {
  request: ParsedAiAbilityInput;
  state: CollectedDebugState;
  traceId: string;
  runtimeCallId: string | null;
  rawOutputRef: string;
  promptDebugRef: string;
}): Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs"> {
  return {
    sessionId: args.request.sessionId,
    missionId: args.request.missionId,
    roundId: args.request.roundId,
    videoVisitId: args.request.videoVisitId,
    traceId: args.traceId,
    spanId: args.runtimeCallId ?? `${args.request.sessionId}:${args.request.taskType}`,
    attemptId: `${args.runtimeCallId ?? args.request.sessionId}:attempt:0`,
    taskType: args.request.taskType,
    refs: args.request.inputRefs.map((ref) => ref.id),
    provider: args.state.provider,
    model: args.state.model,
    modelRole: args.state.modelRole,
    runtime: args.state.runtime,
    promptContractId: args.state.promptContractId,
    promptVersion: args.state.promptVersion,
    outputSchemaRef: args.state.outputSchemaRef,
    promptDebugRef: args.promptDebugRef,
    systemPromptHash: args.state.systemPromptHash,
    userPromptHash: args.state.userPromptHash,
    promptPreview: args.state.promptPreview,
    promptFullText: args.state.promptFullText,
    rawResponsePreview: args.state.rawResponsePreview,
    rawResponseText: args.state.rawResponseText,
    rawResponseHash: args.state.rawResponseText ? hashValue(args.state.rawResponseText) : null,
    rawResponseRef: args.rawOutputRef,
    promptCatalogVersion: args.request.promptCatalogVersion,
    providerConfigRef: args.request.providerPolicy.providerConfigRef,
    secretRef: args.request.providerPolicy.secretRef,
    inputPackageId: args.request.taskType === "map_authoring" ? args.request.input.inputPackageId : null,
    inputPackageVersion: args.request.taskType === "map_authoring" ? args.request.input.inputPackageVersion : null,
    inputPackageHash: args.request.taskType === "map_authoring" ? `sha256:${hashValue(args.request.input)}` : null,
    capabilityCatalogVersion: args.request.taskType === "map_authoring" ? args.request.input.capabilityCatalog.version : null,
    outputSchemaCatalogVersion: args.request.taskType === "map_authoring" ? args.request.input.outputSchemaCatalog.version : null,
    mapPackageSchemaVersion: args.request.taskType === "map_authoring" ? args.request.input.mapPackageSchema.schemaVersion : null,
    promptDebugBundleRef: args.promptDebugRef,
    providerRequestBodyRedacted: args.state.providerRequestBodyRedacted,
    providerRequestDebugRef: args.promptDebugRef,
    parsedJson: args.state.parsedJson,
    parsedDecision: args.state.parsedDecision,
    parserErrors: [...args.state.parserErrors],
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
