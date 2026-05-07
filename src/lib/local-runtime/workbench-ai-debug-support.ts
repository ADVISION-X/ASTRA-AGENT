import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";

import { createId } from "./ids.js";

export type WorkbenchAiDebugEvent = {
  eventType: "AI_REQUEST_DEBUG" | "AI_RESPONSE_DEBUG" | "AI_ERROR_DEBUG" | "AI_INPUT_DEBUG_REJECTED";
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  status: "started" | "success" | "failed" | "review_required";
  taskType: string;
  sessionId: string;
  missionId?: string | null;
  roundId?: string | null;
  attemptId: string;
  videoVisitId: string | null;
  stepId?: string | null;
  traceId: string | null;
  spanId: string | null;
  failureReason: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
  parsedDecision: string | null;
  provider: string | null;
  model: string | null;
  modelRole: string | null;
  runtime: string | null;
  implementationStatus: string | null;
  errorKind: string | null;
  runtimeCallId: string | null;
  diagnosticPayloadRef: string | null;
  schemaIssueCount: number | null;
  promptContractId: string | null;
  promptVersion: string | null;
  outputSchemaRef: string | null;
  promptDebugRef: string | null;
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptPreview: string | null;
  promptFullText: string | null;
  rawResponsePreview: string | null;
  rawResponseText: string | null;
  rawResponseHash: string | null;
  rawResponseRef: string | null;
  promptCatalogVersion?: string | null;
  providerConfigRef?: string | null;
  secretRef?: string | null;
  inputPackageId?: string | null;
  inputPackageVersion?: string | null;
  inputPackageHash?: string | null;
  capabilityCatalogVersion?: string | null;
  outputSchemaCatalogVersion?: string | null;
  mapPackageSchemaVersion?: string | null;
  promptDebugBundleRef?: string | null;
  providerRequestBodyRedacted?: unknown | null;
  providerRequestDebugRef?: string | null;
  parsedJson: unknown | null;
  parserErrors: string[];
  sourceScreenshotEvidenceId: string | null;
  aiInputArtifactRef: string | null;
  imageInputs: unknown[];
  tokenEstimate: number | null;
  durationMs: number | null;
  refs: string[];
};

export type WorkbenchAiDebugRuntime = {
  browserSessionConfig: {
    profileRef: string | null;
  };
  browserController: {
    getSessionState(): {
      loginState: string | null;
    };
  };
};

export type LocalForensicsArtifactRef = {
  artifactType: "json" | "other";
  artifactId: string;
  storageRef: string | null;
  sourceRecordRef: null;
};

export const resolveAiDebugStep = (taskType: WorkbenchAiDebugEvent["taskType"]): string => {
  switch (taskType) {
    case "ocr_cleanup": return "extract_visible_comments";
    case "comment_signal_summary": return "summarize_comment_signals";
    case "product_signal_summary":
    case "evidence_packet_analysis": return "create_pending_candidate";
    case "schema_validation_only": return "validate_ai_output";
    default: return "ask_ai_product_presence";
  }
};

const resolveAiDebugChildCapabilityId = (
  taskType: WorkbenchAiDebugEvent["taskType"],
): "local-vision-ai" | "local-text-ai" | "local-ocr-ai" | "internal-schema-validator" | "paid-analysis-ai" => {
  switch (taskType) {
    case "map_authoring":
    case "evidence_packet_analysis": return "paid-analysis-ai";
    case "ocr_cleanup": return "local-ocr-ai";
    case "comment_signal_summary":
    case "product_signal_summary": return "local-text-ai";
    case "schema_validation_only": return "internal-schema-validator";
    default: return "local-vision-ai";
  }
};

export const buildAiDebugArtifactRefs = (input: WorkbenchAiDebugEvent): LocalForensicsArtifactRef[] => {
  const refs: LocalForensicsArtifactRef[] = [];
  if (input.promptDebugRef) refs.push({ artifactType: "json", artifactId: input.promptDebugRef, storageRef: null, sourceRecordRef: null });
  if (input.rawResponseRef) refs.push({ artifactType: "json", artifactId: input.rawResponseRef, storageRef: null, sourceRecordRef: null });
  if (input.aiInputArtifactRef) refs.push({ artifactType: "other", artifactId: input.aiInputArtifactRef, storageRef: null, sourceRecordRef: null });
  return refs;
};

const toAiEvidenceRef = (ref: string) => ({
  id: ref,
  kind: "ai-result" as const,
  summary: `AI runtime ref ${ref}`,
});

const toAiEvidenceRefs = (refs: string[]) => refs.map(toAiEvidenceRef);

const toIntegerDurationMs = (durationMs: number | null): number | null => (
  typeof durationMs === "number" && Number.isFinite(durationMs)
    ? Math.max(0, Math.round(durationMs))
    : null
);

export const splitTraceId = (traceId: string | null): { missionId: string | null; mapId: string | null } => {
  if (!traceId) {
    return { missionId: null, mapId: null };
  }

  const [missionId, ...rest] = traceId.split(":");
  return {
    missionId: missionId || null,
    mapId: rest.length > 0 ? rest.join(":") : null,
  };
};

const getAiDebugReason = (input: WorkbenchAiDebugEvent): string | null => {
  if (input.eventType === "AI_REQUEST_DEBUG") {
    return `AI request prepared for ${input.taskType}.`;
  }
  if (input.eventType === "AI_INPUT_DEBUG_REJECTED") {
    return `AI input debug rejected for ${input.taskType}.`;
  }
  if (input.eventType === "AI_RESPONSE_DEBUG") {
    return `AI response captured for ${input.taskType}.`;
  }
  return input.failureReason;
};

const buildAiDebugTraceFields = (input: WorkbenchAiDebugEvent, step: string, trace: { missionId: string | null; mapId: string | null }) => ({
  eventId: createId("event"),
  eventType: input.eventType,
  level: input.level,
  phase: "ai-runtime",
  component: "local-ai-runtime",
  owner: "AI Capability",
  abilityGroupId: "ai",
  childCapabilityId: resolveAiDebugChildCapabilityId(input.taskType),
  skillId: null,
  skillCategory: null,
  sessionId: input.sessionId,
  missionId: input.missionId ?? trace.missionId,
  roundId: input.roundId ?? input.attemptId,
  videoVisitId: input.videoVisitId,
  mapId: trace.mapId,
  taskTemplateId: null,
  traceId: input.traceId,
  spanId: input.spanId,
  attemptId: input.attemptId,
  // Always use the RoundLifecycleStep-safe computed step; input.stepId may be
  // an orchestration map step ID (e.g. "judge-seeding-video") which is NOT a
  // valid RoundLifecycleStepSchema enum value and would throw at parse time.
  step,
});

const buildAiDebugStatusFields = (runtime: WorkbenchAiDebugRuntime, input: WorkbenchAiDebugEvent) => ({
  previousStep: null,
  nextStep: null,
  status: input.status,
  reason: getAiDebugReason(input),
  failureReason: input.failureReason,
  reviewRequiredReason: input.status === "review_required" ? input.failureReason : null,
  actionableMessage: input.actionableMessage,
  ownerResponsible: input.ownerResponsible,
  decision: input.parsedDecision,
  roundOutcome: null,
  finalizationType: null,
  samplingStrategy: null,
  expectedFrameCount: null,
  validFrameCount: null,
  fallbackReason: null,
  missingFrames: [],
  snapshotSummary: null,
  browserProfileRef: runtime.browserSessionConfig.profileRef,
  loginState: runtime.browserController.getSessionState().loginState,
});

const buildAiDebugModelFields = (input: WorkbenchAiDebugEvent) => ({
  provider: input.provider,
  model: input.model,
  modelRole: input.modelRole,
  runtime: input.runtime,
  implementationStatus: input.implementationStatus,
  errorKind: input.errorKind,
  runtimeCallId: input.runtimeCallId,
  diagnosticPayloadRef: input.diagnosticPayloadRef,
  schemaIssueCount: input.schemaIssueCount,
});

const buildAiDebugPromptFields = (input: WorkbenchAiDebugEvent) => ({
  promptContractId: input.promptContractId,
  promptVersion: input.promptVersion,
  promptCatalogVersion: input.promptCatalogVersion,
  outputSchemaRef: input.outputSchemaRef,
  providerConfigRef: input.providerConfigRef,
  secretRef: input.secretRef,
  promptDebugRef: input.promptDebugRef,
  systemPromptHash: input.systemPromptHash,
  userPromptHash: input.userPromptHash,
  promptPreview: input.promptPreview,
  promptFullText: input.promptFullText,
  promptDebugBundleRef: input.promptDebugBundleRef,
});

const buildAiDebugResponseFields = (input: WorkbenchAiDebugEvent) => ({
  rawResponsePreview: input.rawResponsePreview,
  rawResponseText: input.rawResponseText,
  rawResponseHash: input.rawResponseHash,
  rawResponseRef: input.rawResponseRef,
  parsedJson: input.parsedJson,
  parsedDecision: input.parsedDecision,
  parserErrors: input.parserErrors,
});

const buildAiDebugMapAuthoringFields = (input: WorkbenchAiDebugEvent) => ({
  inputPackageId: input.inputPackageId,
  inputPackageVersion: input.inputPackageVersion,
  inputPackageHash: input.inputPackageHash,
  capabilityCatalogVersion: input.capabilityCatalogVersion,
  outputSchemaCatalogVersion: input.outputSchemaCatalogVersion,
  mapPackageSchemaVersion: input.mapPackageSchemaVersion,
  providerRequestBodyRedacted: input.providerRequestBodyRedacted,
  providerRequestDebugRef: input.providerRequestDebugRef,
});

const buildAiDebugRefFields = (input: WorkbenchAiDebugEvent, artifactRefs: LocalForensicsArtifactRef[]) => ({
  sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
  aiInputArtifactRef: input.aiInputArtifactRef,
  imageInputs: input.imageInputs,
  tokenEstimate: input.tokenEstimate,
  createdAt: new Date().toISOString(),
  refs: input.refs,
  inputRefs: toAiEvidenceRefs(input.refs),
  outputRefs: input.rawResponseRef ? [toAiEvidenceRef(input.rawResponseRef)] : [],
  evidenceRefs: [],
  proofRefs: [],
  artifactRefs: artifactRefs.map((ref) => ref.artifactId),
  actionLogRefs: [],
  dataQualityFlags: input.parserErrors,
  durationMs: toIntegerDurationMs(input.durationMs),
});

const buildAiDebugPayloadFields = (input: WorkbenchAiDebugEvent, artifactRefs: LocalForensicsArtifactRef[]) => ({
  ...buildAiDebugModelFields(input),
  ...buildAiDebugPromptFields(input),
  ...buildAiDebugResponseFields(input),
  ...buildAiDebugMapAuthoringFields(input),
  ...buildAiDebugRefFields(input, artifactRefs),
});

export const buildAiStructuredRuntimeEvent = (
  runtime: WorkbenchAiDebugRuntime,
  input: WorkbenchAiDebugEvent,
  artifactRefs: LocalForensicsArtifactRef[],
): ReturnType<typeof StructuredRuntimeEventSchema.parse> => {
  const trace = splitTraceId(input.traceId);
  const step = resolveAiDebugStep(input.taskType);

  return StructuredRuntimeEventSchema.parse({
    ...buildAiDebugTraceFields(input, step, trace),
    ...buildAiDebugStatusFields(runtime, input),
    ...buildAiDebugPayloadFields(input, artifactRefs),
  });
};
