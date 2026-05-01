import type { ForensicsArtifactRef } from "../index.js";
import { StructuredRuntimeEventSchema } from "../../../types/structured-log.js";
import type { AiRuntimeStructuredDebugEventInput } from "./ai-debug-event-contract.js";
import { createForensicsEventId } from "./forensics-event-id.js";

const resolveAiDebugChildCapabilityId = (
  taskType: AiRuntimeStructuredDebugEventInput["taskType"],
): "local-vision-ai" | "local-text-ai" | "local-ocr-ai" | "internal-schema-validator" => {
  switch (taskType) {
    case "ocr_cleanup": return "local-ocr-ai";
    case "comment_signal_summary":
    case "product_signal_summary":
    case "evidence_packet_analysis": return "local-text-ai";
    case "schema_validation_only": return "internal-schema-validator";
    default: return "local-vision-ai";
  }
};

const resolveAiDebugStep = (
  taskType: AiRuntimeStructuredDebugEventInput["taskType"],
): "ask_ai_product_presence" | "extract_visible_comments" | "summarize_comment_signals" | "create_pending_candidate" | "validate_ai_output" => {
  switch (taskType) {
    case "ocr_cleanup": return "extract_visible_comments";
    case "comment_signal_summary": return "summarize_comment_signals";
    case "product_signal_summary":
    case "evidence_packet_analysis": return "create_pending_candidate";
    case "schema_validation_only": return "validate_ai_output";
    default: return "ask_ai_product_presence";
  }
};

export const buildAiDebugArtifactRefs = (input: AiRuntimeStructuredDebugEventInput): ForensicsArtifactRef[] => {
  const refs: ForensicsArtifactRef[] = [];
  if (input.promptDebugRef) refs.push({ artifactType: "json", artifactId: input.promptDebugRef, storageRef: null, sourceRecordRef: null });
  if (input.rawResponseRef) refs.push({ artifactType: "json", artifactId: input.rawResponseRef, storageRef: null, sourceRecordRef: null });
  if (input.aiInputArtifactRef) refs.push({ artifactType: "other", artifactId: input.aiInputArtifactRef, storageRef: null, sourceRecordRef: null });
  return refs;
};

export const buildAiDebugDataQualityFlags = (input: AiRuntimeStructuredDebugEventInput): string[] => [
  ...input.parserErrors,
  ...(input.errorKind ? [input.errorKind] : []),
];

const buildAiDebugEventIdentity = (input: AiRuntimeStructuredDebugEventInput) => ({
  eventId: createForensicsEventId(),
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
  missionId: input.missionId,
  roundId: input.roundId,
  videoVisitId: input.videoVisitId,
  mapId: null,
  stepId: input.roundId,
  taskTemplateId: null,
  traceId: input.traceId,
  spanId: input.spanId,
  attemptId: input.attemptId,
});

const buildAiDebugEventRuntimeContext = (input: {
  event: AiRuntimeStructuredDebugEvent;
  browserProfileRef: string | null;
  loginState: string | null;
}) => ({
  browserProfileRef: input.browserProfileRef,
  loginState: input.loginState,
  step: resolveAiDebugStep(input.event.taskType),
  previousStep: null,
  nextStep: null,
  status: input.event.status,
  reason: input.event.eventType === "AI_REQUEST_DEBUG"
    ? `AI request prepared for ${input.event.taskType}.`
    : input.event.eventType === "AI_RESPONSE_DEBUG"
      ? `AI response captured for ${input.event.taskType}.`
      : input.event.failureReason,
  failureReason: input.event.failureReason,
  reviewRequiredReason: input.event.status === "review_required" ? input.event.failureReason : null,
  actionableMessage: input.event.actionableMessage,
  ownerResponsible: input.event.ownerResponsible,
  decision: input.event.parsedDecision,
  roundOutcome: null,
  finalizationType: null,
  samplingStrategy: null,
  expectedFrameCount: null,
  validFrameCount: null,
  fallbackReason: null,
  missingFrames: [],
  snapshotSummary: null,
});

const buildAiDebugEventBase = (input: {
  event: AiRuntimeStructuredDebugEvent;
  browserProfileRef: string | null;
  loginState: string | null;
}) => ({
  ...buildAiDebugEventIdentity(input.event),
  ...buildAiDebugEventRuntimeContext(input),
});

const buildAiDebugEventAiFields = (input: AiRuntimeStructuredDebugEventInput) => ({
  provider: input.provider,
  model: input.model,
  modelRole: input.modelRole,
  runtime: input.runtime,
  promptContractId: input.promptContractId,
  promptVersion: input.promptVersion,
  outputSchemaRef: input.outputSchemaRef,
  promptDebugRef: input.promptDebugRef,
  systemPromptHash: input.systemPromptHash,
  userPromptHash: input.userPromptHash,
  promptPreview: input.promptPreview,
  promptFullText: input.promptFullText,
  rawResponsePreview: input.rawResponsePreview,
  rawResponseText: input.rawResponseText,
  rawResponseHash: input.rawResponseHash,
  rawResponseRef: input.rawResponseRef,
  parsedJson: input.parsedJson,
  parsedDecision: input.parsedDecision,
  parserErrors: input.parserErrors,
  sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
  aiInputArtifactRef: input.aiInputArtifactRef,
  imageInputs: input.imageInputs,
  tokenEstimate: input.tokenEstimate,
});

const buildAiDebugEventRefs = (input: {
  event: AiRuntimeStructuredDebugEvent;
  artifactRefs: ForensicsArtifactRef[];
  dataQualityFlags: string[];
}) => ({
  exitCode: null,
  signal: null,
  pid: null,
  startedAt: null,
  endedAt: null,
  lastRuntimeEventId: null,
  lastCommandEventId: null,
  lastAiEventId: null,
  likelyCauseRef: null,
  crashBundleRef: null,
  createdAt: new Date().toISOString(),
  durationMs: input.event.durationMs,
  refs: input.event.refs,
  inputRefs: [],
  outputRefs: [],
  evidenceRefs: [],
  proofRefs: [],
  artifactRefs: input.artifactRefs,
  actionLogRefs: [],
  dataQualityFlags: input.dataQualityFlags,
});

export const buildAiStructuredRuntimeEvent = (input: {
  event: AiRuntimeStructuredDebugEventInput;
  browserProfileRef: string | null;
  loginState: string | null;
  artifactRefs: ForensicsArtifactRef[];
  dataQualityFlags: string[];
}) => StructuredRuntimeEventSchema.parse({
  ...buildAiDebugEventBase(input),
  ...buildAiDebugEventAiFields(input.event),
  ...buildAiDebugEventRefs(input),
});