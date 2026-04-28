import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";
import { getPromptContract } from "../../../lib/local-ai/prompt-registry.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import type { LocalAiHealth, LocalAiTaskRequest, LocalAiTaskResult, LocalAiTaskType } from "../../../types/local-ai.js";
import type { AiAbilityInput, AiAbilityResult, AiChildCapabilityId, AiExecutionOptions, AiExecutionStatus, AiPromptContract, AiRuntimeBridge, AiRuntimeHealth, AiSchemaValidationStatus, AiTaskType } from "../contract.js";
import { loadAiModelRoster } from "../model-roster.js";
import {
  AiCommentSignalSummaryInputSchema,
  AiCommentSignalSummaryOutputSchema,
  AiEvidencePacketAnalysisOutputSchema,
  AiOcrCleanupInputSchema,
  AiOcrCleanupOutputSchema,
  AiProductSignalSummaryInputSchema,
  AiProductSignalSummaryOutputSchema,
  AiSchemaValidationOnlyOutputSchema,
  AiVisualOutputSchema,
  resolveAiExpectedOutputTask,
  safeParseAiTaskOutput,
  validateAiAbilityResult,
  validateAiRuntimeHealth,
} from "../schema-validation.js";
import { routeAiTaskToChild } from "../task-router.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import { describeLocalAiFailure } from "../shared/ai-failure.js";
import {
  assertAiReadOnlyBoundary,
  isLocalAiChildCapabilityId,
  listAiReadOnlyBoundaryViolations,
  resolveAiPolicyViolationReasons,
} from "../shared/ai-policy.js";

const LEGACY_TASK_BY_AI: Partial<Record<AiTaskType, LocalAiTaskType>> = {
  product_presence_judgment: "vision.productPresence",
  visual_observation: "vision.productPresence",
  visual_target_candidate_analysis: "vision.productPresence",
  ocr_cleanup: "comments.ocr_cleanup",
  comment_signal_summary: "comments.intent_analysis",
  product_signal_summary: "product.signal_summary",
};

const PRIMARY_AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

function getModelProviderForChildCapabilityId(childCapabilityId: AiChildCapabilityId): AiAbilityResult["modelProvider"] {
  if (childCapabilityId === "future-api-ai") {
    return "future";
  }
  if (!isLocalAiChildCapabilityId(childCapabilityId)) {
    return "paid";
  }

  return "local";
}

function toAiPromptContract(taskType: AiTaskType): AiPromptContract {
  const legacyTaskType = LEGACY_TASK_BY_AI[taskType];
  if (legacyTaskType) {
    const contract = getPromptContract(legacyTaskType);
    return {
      taskType,
      modelRole: contract.modelRole === "commentUnderstanding" ? "commentUnderstanding" : contract.modelRole,
      promptId: contract.promptId,
      promptVersion: contract.promptVersion,
      schemaVersion: contract.schemaVersion,
      purpose: contract.purpose,
      forbiddenOutputs: [...contract.forbiddenOutputs],
    };
  }

  if (taskType === "evidence_packet_analysis") {
    return { taskType, modelRole: "future", promptId: "ai.evidence_packet_analysis.disabled", promptVersion: "evidence_packet_analysis.v1", schemaVersion: "ai.evidence_packet_analysis.v1", purpose: "Reserved paid analysis path for evidence-packet cognition.", forbiddenOutputs: ["implicit_paid_fallback"] };
  }

  return { taskType, modelRole: "schemaValidator", promptId: "ai.schema_validation_only.internal", promptVersion: "schema_validation_only.v1", schemaVersion: "ai.schema_validation_only.v1", purpose: "Validate a governed AI payload against the declared schema boundary.", forbiddenOutputs: ["schema_bypass"] };
}

function toAiRuntimeHealth(health: LocalAiHealth): AiRuntimeHealth {
  return validateAiRuntimeHealth({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: {
      gateway: health.ollamaStatus,
      vision: health.visionModelStatus,
      text: health.textModelStatus,
      ocr: health.ocrStatus,
    },
    configuredModels: health.configuredModels,
    availableModels: health.availableModels,
    lastCheckedAt: health.lastCheckedAt,
    failureReason: health.failureReason,
    lastTaskType: health.lastTaskType ? PRIMARY_AI_TASK_BY_LEGACY[health.lastTaskType] : null,
    lastFailureReason: health.lastFailureReason,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function toLocalAiTaskRequest(input: AiAbilityInput): LocalAiTaskRequest {
  const legacyTaskType = LEGACY_TASK_BY_AI[input.taskType];
  if (!legacyTaskType) {
    throw new Error(`Local AI runtime adapter cannot execute ${input.taskType}.`);
  }

  const promptContract = toAiPromptContract(input.taskType);
  const id = `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`;
  switch (legacyTaskType) {
    case "vision.productPresence":
      return {
        id,
        taskType: legacyTaskType,
        modelRole: "vision",
        promptVersion: promptContract.promptVersion,
        schemaVersion: promptContract.schemaVersion,
        evidenceRefs: input.inputRefs,
        input: VisionProductPresenceRequestInputSchema.parse(input.input),
      };
    case "comments.ocr_cleanup":
      return {
        id,
        taskType: legacyTaskType,
        modelRole: "ocr",
        promptVersion: promptContract.promptVersion,
        schemaVersion: promptContract.schemaVersion,
        evidenceRefs: input.inputRefs,
        input: AiOcrCleanupInputSchema.parse(input.input),
      };
    case "comments.intent_analysis":
      return {
        id,
        taskType: legacyTaskType,
        modelRole: "commentUnderstanding",
        promptVersion: promptContract.promptVersion,
        schemaVersion: promptContract.schemaVersion,
        evidenceRefs: input.inputRefs,
        input: AiCommentSignalSummaryInputSchema.parse(input.input),
      };
    case "product.signal_summary":
      return {
        id,
        taskType: legacyTaskType,
        modelRole: "productSignal",
        promptVersion: promptContract.promptVersion,
        schemaVersion: promptContract.schemaVersion,
        evidenceRefs: input.inputRefs,
        input: AiProductSignalSummaryInputSchema.parse(input.input),
      };
  }
}

function toPublicOutput(taskType: AiTaskType, result: LocalAiTaskResult): unknown {
  if (result.taskType !== "vision.productPresence") {
    return result.result;
  }

  const { taskType: _taskType, promptId: _promptId, promptVersion: _promptVersion, schemaVersion: _schemaVersion, ...output } = result.result;
  return output;
}

function buildDefaultOutput(input: AiAbilityInput, reason: string): AiAbilityResult["output"] {
  switch (input.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis": {
      const visionInput = VisionProductPresenceRequestInputSchema.parse(input.input);
      return {
        inputMode: visionInput.inputMode,
        multiFrameEvidenceSetId: visionInput.multiFrameEvidenceSetId,
        contactSheetEvidenceId: visionInput.contactSheetEvidenceId,
        frameEvidenceIds: visionInput.frameEvidenceIds,
        screenshotEvidenceId: visionInput.screenshotEvidenceId,
        sampledFrameCount: visionInput.sampledFrameCount,
        validFrameCount: visionInput.validFrameCount,
        expectedFrameCount: visionInput.expectedFrameCount,
        fallbackReason: visionInput.fallbackReason,
        missingFrames: visionInput.missingFrames,
        isProductVideo: null,
        confidence: 0,
        visibleProductTypes: [],
        evidenceObservations: [],
        reason,
        frameLevelObservations: [],
        aggregateReason: reason,
        suggestedNextAction: "review_required",
        uncertainty: [reason],
        mustReview: true,
      };
    }
    case "ocr_cleanup":
      return { cleanedComments: [], uncertainText: [reason], confidence: 0 };
    case "comment_signal_summary":
      return { purchaseIntent: "low", painPoints: [], complaints: [], demandTerms: [], confidence: 0 };
    case "product_signal_summary":
      return {
        category: "unavailable",
        useCase: "unavailable",
        sellingPoints: [],
        painPoints: [],
        purchaseIntent: "low",
        risk: "high",
        score: 0,
        rationale: reason,
      };
    case "evidence_packet_analysis":
      return { summary: reason, notableEvidenceRefs: [], reviewNotes: [reason] };
    case "schema_validation_only":
      return { valid: false, issues: [reason] };
  }
}

function buildRuntimeProof(input: {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  status: AiExecutionStatus;
  startedAt: string;
  endedAt: string;
  reason: string;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: string[];
}): AiAbilityResult["runtimeProof"] {
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  return {
    abilityGroupId: "ai",
    childCapabilityId: input.childCapabilityId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    startedAt,
    endedAt,
    durationMs,
    status: input.status,
    reason: input.reason,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    inputRefs: input.request.inputRefs.map((ref) => ref.id),
    outputRefs: [],
    evidenceRefs: input.request.inputRefs.map((ref) => ref.id),
    actionLogRefs: [],
    nextAbilityGroup: null,
    nextChildAbility: null,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function buildResultStatus(input: {
  request: AiAbilityInput;
  policyViolations: string[];
  schemaIssues: string[];
  confidence: number | null;
}): { status: AiExecutionStatus; primaryReason: string | null; schemaValidationStatus: AiSchemaValidationStatus; dataQualityFlags: string[] } {
  const dataQualityFlags: string[] = [];
  let status: AiExecutionStatus = "success";
  let primaryReason: string | null = null;
  let schemaValidationStatus: AiSchemaValidationStatus = input.schemaIssues.length > 0 ? "invalid" : "valid";

  if (input.policyViolations.length > 0) {
    dataQualityFlags.push("policy_violation");
    primaryReason = input.policyViolations.join(" ");
    status = input.request.safetyPolicy.reviewOnPolicyViolation ? "review_required" : "failed";
  }

  if (primaryReason === null && input.schemaIssues.length > 0) {
    dataQualityFlags.push("schema_invalid");
    primaryReason = input.schemaIssues.join(" ");
    schemaValidationStatus = "invalid";
    if (input.request.qualityPolicy.requireSchemaValidation) {
      status = input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed";
    }
  }

  if (
    primaryReason === null
    && input.request.qualityPolicy.minimumConfidence !== null
    && input.confidence !== null
    && input.confidence < input.request.qualityPolicy.minimumConfidence
  ) {
    dataQualityFlags.push("low_confidence");
    primaryReason = `confidence ${input.confidence.toFixed(2)} is below minimumConfidence ${input.request.qualityPolicy.minimumConfidence.toFixed(2)}.`;
    status = input.request.safetyPolicy.reviewOnLowConfidence ? "review_required" : "failed";
  }

  return { status, primaryReason, schemaValidationStatus, dataQualityFlags };
}

function finalizeAiAbilityResult(input: {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  promptContract: AiPromptContract;
  modelProvider: AiAbilityResult["modelProvider"];
  modelName: string;
  runtime: string;
  implementationStatus: string;
  output: AiAbilityResult["output"];
  status: AiExecutionStatus;
  schemaValidationStatus: AiSchemaValidationStatus;
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  startedAt: string;
  endedAt: string;
  dataQualityFlags: string[];
  reason: string;
  createdAt: string;
}): AiAbilityResult {
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  return validateAiAbilityResult({
    status: input.status,
    abilityGroupId: "ai",
    childCapabilityId: input.childCapabilityId,
    taskType: input.request.taskType,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelRole: input.promptContract.modelRole,
    runtime: input.runtime,
    implementationStatus: input.implementationStatus,
    output: input.output,
    rawOutputRef: null,
    schemaValidationStatus: input.schemaValidationStatus,
    confidence: input.confidence,
    failureReason: input.failureReason,
    durationMs,
    costEstimate: null,
    evidenceRefs: input.request.inputRefs,
    debugLogRef: null,
    runtimeProof: buildRuntimeProof({
      request: input.request,
      childCapabilityId: input.childCapabilityId,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      reason: input.reason,
      failureReason: input.failureReason,
      reviewRequiredReason: input.reviewRequiredReason,
      dataQualityFlags: input.dataQualityFlags,
    }),
    promptVersion: input.promptContract.promptVersion,
    schemaVersion: input.promptContract.schemaVersion,
    createdAt: input.createdAt,
  });
}

function normalizeSchemaValidationCandidate(candidate: unknown): unknown {
  if (typeof candidate !== "string") {
    return candidate;
  }

  const trimmed = candidate.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as unknown;
  }

  return parseExtractedJson<unknown>(candidate);
}

function buildSchemaValidationOnlyResult(input: AiAbilityInput, promptContract: AiPromptContract, childCapabilityId: AiChildCapabilityId, startedAt: string): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const targetTaskType = resolveAiExpectedOutputTask(input);

  if (targetTaskType === null) {
    const reason = `No governed schema target matches expectedOutputSchema=${input.expectedOutputSchema} or promptContractId=${input.promptContractId}.`;
    return finalizeAiAbilityResult({
      request: input,
      childCapabilityId,
      promptContract,
      modelProvider: "internal",
      modelName: "schema-validator",
      runtime: "internal",
      implementationStatus: "schema_target_missing",
      output: { valid: false, issues: [reason] },
      status: input.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
      schemaValidationStatus: "invalid",
      confidence: 0,
      failureReason: reason,
      reviewRequiredReason: input.safetyPolicy.reviewOnSchemaFailure ? reason : null,
      startedAt,
      endedAt,
      dataQualityFlags: ["schema_invalid"],
      reason: "schema_validation_failed",
      createdAt: endedAt,
    });
  }

  let normalizedCandidate: unknown;
  try {
    normalizedCandidate = normalizeSchemaValidationCandidate(input.input.candidate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return finalizeAiAbilityResult({
      request: input,
      childCapabilityId,
      promptContract,
      modelProvider: "internal",
      modelName: "schema-validator",
      runtime: "internal",
      implementationStatus: "schema_parse_failed",
      output: { valid: false, issues: [reason] },
      status: input.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed",
      schemaValidationStatus: "invalid",
      confidence: 0,
      failureReason: reason,
      reviewRequiredReason: input.safetyPolicy.reviewOnSchemaFailure ? reason : null,
      startedAt,
      endedAt,
      dataQualityFlags: ["schema_invalid"],
      reason: "schema_validation_failed",
      createdAt: endedAt,
    });
  }

  const validation = safeParseAiTaskOutput(targetTaskType, normalizedCandidate);
  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "candidate";
      return `${path}: ${issue.message}`;
    });
  const status = validation.success ? "success" : (input.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed");
  const reason = validation.success ? "schema_validation_completed" : issues.join(" ");

  return finalizeAiAbilityResult({
    request: input,
    childCapabilityId,
    promptContract,
    modelProvider: "internal",
    modelName: "schema-validator",
    runtime: "internal",
    implementationStatus: validation.success ? "validated" : "schema_invalid",
    output: { valid: validation.success, issues },
    status,
    schemaValidationStatus: validation.success ? "valid" : "invalid",
    confidence: validation.success ? 1 : 0,
    failureReason: validation.success ? null : reason,
    reviewRequiredReason: status === "review_required" ? reason : null,
    startedAt,
    endedAt,
    dataQualityFlags: validation.success ? [] : ["schema_invalid"],
    reason: validation.success ? "schema_validation_completed" : "schema_validation_failed",
    createdAt: endedAt,
  });
}

function buildPolicyFailureResult(input: AiAbilityInput, promptContract: AiPromptContract, childCapabilityId: AiChildCapabilityId, startedAt: string, reasons: string[]): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const reason = reasons.join(" ");
  const status = input.safetyPolicy.reviewOnPolicyViolation ? "review_required" : "failed";
  return finalizeAiAbilityResult({
    request: input,
    childCapabilityId,
    promptContract,
    modelProvider: getModelProviderForChildCapabilityId(childCapabilityId),
    modelName: "policy-gate",
    runtime: "governed-gate",
    implementationStatus: "disabled_by_policy",
    output: buildDefaultOutput(input, reason),
    status,
    schemaValidationStatus: "not_applicable",
    confidence: null,
    failureReason: reason,
    reviewRequiredReason: status === "review_required" ? reason : null,
    startedAt,
    endedAt,
    dataQualityFlags: ["policy_violation"],
    reason: "policy_gate_blocked_execution",
    createdAt: endedAt,
  });
}

function buildRuntimeFailureResult(
  input: AiAbilityInput,
  promptContract: AiPromptContract,
  childCapabilityId: AiChildCapabilityId,
  startedAt: string,
  failure: ReturnType<typeof describeLocalAiFailure>,
): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const status = failure.decision === "invalid_ai_output" && input.safetyPolicy.reviewOnSchemaFailure
    ? "review_required"
    : "failed";
  const schemaValidationStatus: AiSchemaValidationStatus = failure.decision === "invalid_ai_output" ? "invalid" : "not_applicable";
  const dataQualityFlags = failure.decision === "invalid_ai_output" ? ["schema_invalid"] : [failure.localAiStatus];
  return finalizeAiAbilityResult({
    request: input,
    childCapabilityId,
    promptContract,
    modelProvider: getModelProviderForChildCapabilityId(childCapabilityId),
    modelName: "local-runtime-error",
    runtime: "local-wrapper",
    implementationStatus: failure.localAiStatus,
    output: buildDefaultOutput(input, failure.reason),
    status,
    schemaValidationStatus,
    confidence: null,
    failureReason: failure.reason,
    reviewRequiredReason: status === "review_required" ? failure.reason : null,
    startedAt,
    endedAt,
    dataQualityFlags,
    reason: failure.eventType,
    createdAt: endedAt,
  });
}

function buildRuntimeSuccessResult(input: AiAbilityInput, promptContract: AiPromptContract, childCapabilityId: AiChildCapabilityId, result: LocalAiTaskResult, startedAt: string): AiAbilityResult {
  const endedAt = new Date().toISOString();
  const publicOutput = toPublicOutput(input.taskType, result);
  const schemaTargetTaskType = resolveAiExpectedOutputTask(input);
  const schemaIssues: string[] = [];

  if (schemaTargetTaskType !== null && schemaTargetTaskType !== input.taskType) {
    schemaIssues.push(`expectedOutputSchema resolves to ${schemaTargetTaskType}, but request taskType is ${input.taskType}.`);
  }

  const outputValidation = safeParseAiTaskOutput(input.taskType, publicOutput);
  if (!outputValidation.success) {
    schemaIssues.push(...outputValidation.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "output";
      return `${path}: ${issue.message}`;
    }));
  }

  const boundaryViolations = [
    ...listAiReadOnlyBoundaryViolations(promptContract.purpose),
    ...listAiReadOnlyBoundaryViolations(publicOutput),
  ];
  const decision = buildResultStatus({
    request: input,
    policyViolations: boundaryViolations,
    schemaIssues,
    confidence: result.confidence,
  });
  const primaryReason = decision.primaryReason;

  return finalizeAiAbilityResult({
    request: input,
    childCapabilityId,
    promptContract,
    modelProvider: "local",
    modelName: result.model,
    runtime: result.runtime,
    implementationStatus: result.implementationStatus,
    output: outputValidation.success ? outputValidation.data : buildDefaultOutput(input, primaryReason ?? result.implementationStatus),
    status: decision.status,
    schemaValidationStatus: decision.schemaValidationStatus,
    confidence: result.confidence,
    failureReason: decision.status === "success" ? null : primaryReason,
    reviewRequiredReason: decision.status === "review_required" ? primaryReason : null,
    startedAt,
    endedAt,
    dataQualityFlags: decision.dataQualityFlags,
    reason: decision.status === "success" ? "ai_execution_completed" : "ai_execution_guarded",
    createdAt: result.createdAt,
  });
}

export function createDefaultAiRuntimeBridge(): AiRuntimeBridge {
  const gateway = new LocalAiGateway();

  return {
    async execute(input, options) {
      const startedAt = new Date().toISOString();
      const promptContract = toAiPromptContract(input.taskType);
      const childCapabilityId = routeAiTaskToChild(input.taskType);
      const policyViolations = [
        ...resolveAiPolicyViolationReasons(input, childCapabilityId),
        ...listAiReadOnlyBoundaryViolations(promptContract.purpose),
      ];

      if (policyViolations.length > 0) {
        return buildPolicyFailureResult(input, promptContract, childCapabilityId, startedAt, policyViolations);
      }
      if (input.taskType === "schema_validation_only") {
        return buildSchemaValidationOnlyResult(input, promptContract, childCapabilityId, startedAt);
      }

      try {
        assertAiReadOnlyBoundary(promptContract.purpose);
        const legacyRequest = toLocalAiTaskRequest(input);
        const result = await gateway.execute(legacyRequest, options?.debugHook ? { debugHook: options.debugHook } : {});
        return buildRuntimeSuccessResult(input, promptContract, childCapabilityId, result, startedAt);
      } catch (error) {
        return buildRuntimeFailureResult(input, promptContract, childCapabilityId, startedAt, describeLocalAiFailure(error));
      }
    },
    async getHealth() {
      const report = await gateway.getHealth();
      return { ok: report.ok, detail: report.detail, health: toAiRuntimeHealth(report.health) };
    },
    async getRuntimeHealth() {
      return toAiRuntimeHealth(await gateway.getRuntimeHealth());
    },
    resolvePromptContract(taskType) {
      return toAiPromptContract(taskType);
    },
    getModelRoster() {
      return loadAiModelRoster();
    },
  };
}