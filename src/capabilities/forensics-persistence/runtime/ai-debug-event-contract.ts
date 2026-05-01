export type AiDebugTaskType =
  | "ocr_cleanup"
  | "comment_signal_summary"
  | "product_signal_summary"
  | "evidence_packet_analysis"
  | "schema_validation_only"
  | string;

export type AiDebugEventType = "AI_REQUEST_DEBUG" | "AI_RESPONSE_DEBUG" | "AI_FAILURE_DEBUG";

export type AiDebugLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type AiDebugStatus = "started" | "success" | "failed" | "skipped" | "review_required";

export type AiDebugImageInput = {
  refId: string | null;
  artifactRef: string | null;
  filePath: string | null;
  hash: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

export type AiRuntimeStructuredDebugEventInput = {
  sessionId: string;
  missionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  traceId: string | null;
  spanId: string | null;
  attemptId: string;
  taskType: AiDebugTaskType;
  eventType: AiDebugEventType;
  level: AiDebugLogLevel;
  status: AiDebugStatus;
  failureReason: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
  parsedDecision: string | null;
  provider: string | null;
  model: string | null;
  modelRole: string | null;
  runtime: string | null;
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
  parsedJson: unknown | null;
  parserErrors: string[];
  sourceScreenshotEvidenceId: string | null;
  aiInputArtifactRef: string | null;
  imageInputs: AiDebugImageInput[];
  tokenEstimate: number | null;
  durationMs: number | null;
  refs: string[];
};