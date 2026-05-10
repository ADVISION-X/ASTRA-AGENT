import type { AiRequestDispatchInput, CreateNerveBusAbilityGroupInput } from "../../capabilities/nerve-bus/contract.js";

import { recordAiOutputSummaryAlias } from "../../capabilities/ai/index.js";
import { buildMirroredEnvelopeBase, buildPayloadDocument } from "./workbench-payload.js";
import { describeFailureReason, resolveWorkbenchAiDecision } from "./workbench-nerve-bus-ai-decision.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiHandledResult = Awaited<ReturnType<CreateNerveBusAbilityGroupInput["handlerPort"]["requestAi"]>>;
type AiRuntimeProofRecord = {
  rawOutputRef?: string | null;
  rawOutputHash?: string | null;
  runtimeCallId?: string | null;
  schemaIssueCount?: number | null;
  schemaDecision?: string | null;
  schemaValidationStatus?: string | null;
  qualityDecision?: string | null;
  qualityDecisionReason?: string | null;
  outputBoundaryDecision?: string | null;
  dataQualityFlags?: string[];
  outputRefs?: unknown;
};

type WorkbenchAiResponseInput = {
  envelope: WorkbenchAiRequestEnvelope;
  aiResult: {
    status: "success" | "failed" | "review_required";
    taskType?: string | null;
    confidence?: number | null;
    output?: unknown;
    failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
    reviewRequiredReason?: string | null;
  };
};
const PAGE_PREPARATION_TASK_TYPE = "page_preparation_judgment";
const resolveMinimumConfidence = (aiTaskType: string): number | null =>
  aiTaskType === PAGE_PREPARATION_TASK_TYPE || aiTaskType === "product_presence_judgment" ? null : 0.6;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const readString = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const readNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const readStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
  : [];
const readRuntimeProof = (value: unknown): AiRuntimeProofRecord | null => isRecord(value) && isRecord(value.runtimeProof)
  ? value.runtimeProof
  : null;

const resolveAuthoritativeAiOutputRef = (aiResult: unknown): string | null => {
  const runtimeProof = readRuntimeProof(aiResult);
  return readStringArray(runtimeProof?.outputRefs)[0] ?? null;
};
const buildAiDiagnosticFields = (aiResult: unknown) => {
  const result = isRecord(aiResult) ? aiResult : {};
  const runtimeProof = readRuntimeProof(aiResult);
  const rawOutputRef = readString(runtimeProof?.rawOutputRef) ?? readString(result.rawOutputRef);
  const rawOutputHash = readString(runtimeProof?.rawOutputHash) ?? readString(result.rawOutputHash);
  const runtimeCallId = readString(runtimeProof?.runtimeCallId) ?? readString(result.runtimeCallId);
  const implementationStatus = readString(result.implementationStatus);
  const schemaIssueCount = readNumber(runtimeProof?.schemaIssueCount) ?? readNumber(result.schemaIssueCount);
  const schemaDecision = readString(runtimeProof?.schemaDecision);
  const schemaValidationStatus = readString(result.schemaValidationStatus);
  const qualityDecision = readString(runtimeProof?.qualityDecision);
  const qualityDecisionReason = readString(runtimeProof?.qualityDecisionReason);
  const outputBoundaryDecision = readString(runtimeProof?.outputBoundaryDecision);
  const dataQualityFlags = Array.isArray(runtimeProof?.dataQualityFlags)
    ? runtimeProof.dataQualityFlags.filter((flag): flag is string => typeof flag === "string" && flag.length > 0)
    : [];
  return {
    implementationStatus,
    runtimeCallId,
    rawOutputRef,
    rawOutputHash,
    diagnosticPayloadRef: readString(result.diagnosticPayloadRef) ?? rawOutputRef ?? rawOutputHash,
    schemaIssueCount,
    schemaDecision,
    schemaValidationStatus,
    qualityDecision,
    qualityDecisionReason,
    outputBoundaryDecision,
    dataQualityFlags,
  };
};
const resolveActionPlanActionCodes = (actionPlan: Record<string, unknown> | null): string | null => {
  if (!Array.isArray(actionPlan?.actions)) {
    return null;
  }

  return actionPlan.actions
    .map((action) => typeof action === "object" && action && typeof (action as { actionCode?: unknown }).actionCode === "string" ? (action as { actionCode: string }).actionCode : null)
    .filter((actionCode): actionCode is string => actionCode !== null)
    .join(",") || null;
};
const buildAiOutputPayload = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  status: "success" | "failed" | "review_required";
  aiTaskType: string;
  decision: string;
  taskDecision: string | null;
  pageStateDecision: string | null;
  actionPlan: Record<string, unknown> | null;
  nonExecutableSummary: string | null;
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  isProductVideo: boolean | null;
  mustReview: boolean | null;
  diagnostics: ReturnType<typeof buildAiDiagnosticFields>;
}) => buildPayloadDocument({
  documentType: "ai.response",
  documentRef: `${input.envelope.requestId}:response`,
  summary: input.status === "success"
    ? `AI response accepted with decision=${input.decision}.`
    : input.reviewRequiredReason ?? input.failureReason ?? `AI response returned status=${input.status}.`,
  content: {
    aiTaskType: input.aiTaskType,
    decision: input.decision,
    taskDecision: input.taskDecision,
    pageStateDecision: input.pageStateDecision,
    actionPlanActionCodes: resolveActionPlanActionCodes(input.actionPlan),
    nonExecutableSummary: input.nonExecutableSummary,
    status: input.status,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    implementationStatus: input.diagnostics.implementationStatus,
    runtimeCallId: input.diagnostics.runtimeCallId,
    rawOutputRef: input.diagnostics.rawOutputRef,
    rawOutputHash: input.diagnostics.rawOutputHash,
    diagnosticPayloadRef: input.diagnostics.diagnosticPayloadRef,
    schemaIssueCount: input.diagnostics.schemaIssueCount,
    schemaDecision: input.diagnostics.schemaDecision,
    schemaValidationStatus: input.diagnostics.schemaValidationStatus,
    qualityDecision: input.diagnostics.qualityDecision,
    qualityDecisionReason: input.diagnostics.qualityDecisionReason,
    outputBoundaryDecision: input.diagnostics.outputBoundaryDecision,
    minimumConfidence: resolveMinimumConfidence(input.aiTaskType),
    dataQualityFlags: input.diagnostics.dataQualityFlags.join(",") || null,
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
  },
});
const buildResponseDecision = (input: {
  resolvedDecision: ReturnType<typeof resolveWorkbenchAiDecision>;
}) => {
  return {
    status: input.resolvedDecision.status,
    decision: input.resolvedDecision.decision,
    taskDecision: input.resolvedDecision.taskDecision,
    pageStateDecision: input.resolvedDecision.pageStateDecision,
    actionPlan: input.resolvedDecision.actionPlan ?? null,
    nonExecutableSummary: input.resolvedDecision.nonExecutableSummary,
  };
};
const buildResponseDiagnostics = (input: {
  aiTaskType: string;
  confidence: number | null;
  diagnostics: ReturnType<typeof buildAiDiagnosticFields>;
  resolvedDecision: ReturnType<typeof resolveWorkbenchAiDecision>;
}) => {
  return {
    confidence: input.confidence,
    implementationStatus: input.diagnostics.implementationStatus,
    runtimeCallId: input.diagnostics.runtimeCallId,
    rawOutputRef: input.diagnostics.rawOutputRef,
    rawOutputHash: input.diagnostics.rawOutputHash,
    schemaIssueCount: input.diagnostics.schemaIssueCount,
    schemaDecision: input.diagnostics.schemaDecision,
    schemaValidationStatus: input.diagnostics.schemaValidationStatus,
    qualityDecision: input.diagnostics.qualityDecision,
    qualityDecisionReason: input.diagnostics.qualityDecisionReason,
    outputBoundaryDecision: input.diagnostics.outputBoundaryDecision,
    minimumConfidence: resolveMinimumConfidence(input.aiTaskType),
    dataQualityFlags: input.diagnostics.dataQualityFlags,
    parsedDecision: input.resolvedDecision.decision,
  };
};
const buildResponseResultRefs = (input: {
  failureReason: string | null;
  resolvedDecision: ReturnType<typeof resolveWorkbenchAiDecision>;
  outputPayload: ReturnType<typeof buildAiOutputPayload>;
}) => {
  return {
    outputRef: input.resolvedDecision.status === "success" ? input.outputPayload.documentRef : null,
    diagnosticPayloadRef: input.resolvedDecision.status === "success" ? null : input.outputPayload.documentRef,
    failureReason: input.resolvedDecision.status === "failed" ? input.failureReason : null,
    reviewRequiredReason: input.resolvedDecision.status === "review_required" ? input.resolvedDecision.reviewRequiredReason : null,
  };
};
const buildWorkbenchAiResponseEnvelope = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
  resolvedDecision: ReturnType<typeof resolveWorkbenchAiDecision>;
  outputPayload: ReturnType<typeof buildAiOutputPayload>;
  diagnostics: ReturnType<typeof buildAiDiagnosticFields>;
}) => {
  return {
    ...buildMirroredEnvelopeBase({
      channelId: "ai-to-orchestration",
      envelopeId: `${input.envelope.envelopeId}:response`,
      requestEnvelope: input.envelope,
      payloadRefs: { output: input.outputPayload.documentRef },
      summary: input.outputPayload.summary,
      tags: ["ai", input.aiTaskType],
    }),
    envelopeKind: "ai_response" as const,
    responseId: `${input.envelope.requestId}:response`,
    from: "ai" as const,
    to: "orchestration" as const,
    correlationEnvelopeId: input.envelope.envelopeId,
    correlationCapabilityCallId: input.envelope.capabilityCallId,
    correlationInputRef: input.envelope.inputRef,
    proofRef: `${input.envelope.envelopeId}:response:proof`,
    ...buildResponseDecision({ resolvedDecision: input.resolvedDecision }),
    ...buildResponseDiagnostics({
      aiTaskType: input.aiTaskType,
      confidence: input.confidence,
      diagnostics: input.diagnostics,
      resolvedDecision: input.resolvedDecision,
    }),
    ...buildResponseResultRefs({
      failureReason: input.failureReason,
      resolvedDecision: input.resolvedDecision,
      outputPayload: input.outputPayload,
    }),
  };
};
const resolveWorkbenchAiResponseArtifacts = (input: WorkbenchAiResponseInput) => {
  const aiTaskType = input.aiResult.taskType ?? input.envelope.taskType;
  const confidence = input.aiResult.confidence ?? null;
  const failureReason = describeFailureReason(input.aiResult.failureReason);
  const diagnostics = buildAiDiagnosticFields(input.aiResult);
  const resolvedDecision = resolveWorkbenchAiDecision({
    aiTaskType,
    status: input.aiResult.status,
    confidence,
    failureReason,
    reviewRequiredReason: input.aiResult.reviewRequiredReason,
    output: input.aiResult.output,
  });

  return {
    aiTaskType,
    confidence,
    failureReason,
    diagnostics,
    resolvedDecision,
    outputPayload: buildAiOutputPayload({
      envelope: input.envelope,
      status: resolvedDecision.status,
      aiTaskType,
      decision: resolvedDecision.decision,
      taskDecision: resolvedDecision.taskDecision,
      pageStateDecision: resolvedDecision.pageStateDecision,
      actionPlan: (resolvedDecision.actionPlan as Record<string, unknown> | null | undefined) ?? null,
      nonExecutableSummary: resolvedDecision.nonExecutableSummary,
      confidence,
      failureReason,
      reviewRequiredReason: resolvedDecision.reviewRequiredReason,
      isProductVideo: resolvedDecision.isProductVideo,
      mustReview: resolvedDecision.mustReview,
      diagnostics,
    }),
  };
};

export const buildWorkbenchAiResponse = (input: WorkbenchAiResponseInput): WorkbenchAiHandledResult => {
  const response = resolveWorkbenchAiResponseArtifacts(input);
  recordAiOutputSummaryAlias({
    aliasRef: response.resolvedDecision.status === "success" ? response.outputPayload.documentRef : null,
    sourceRef: resolveAuthoritativeAiOutputRef(input.aiResult),
  });

  return {
    envelope: buildWorkbenchAiResponseEnvelope({
      envelope: input.envelope,
      aiTaskType: response.aiTaskType,
      confidence: response.confidence,
      failureReason: response.failureReason,
      resolvedDecision: response.resolvedDecision,
      outputPayload: response.outputPayload,
      diagnostics: response.diagnostics,
    }),
    outputPayload: response.outputPayload,
  };
};