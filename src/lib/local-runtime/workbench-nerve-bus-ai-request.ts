import type {
  AiRequestDispatchInput,
  CreateNerveBusAbilityGroupInput,
} from "../../capabilities/nerve-bus/contract.js";
import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildMirroredEnvelopeBase,
  buildPayloadDocument,
  payloadDocumentToObject,
  payloadValueToString,
} from "./workbench-payload.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiPayloadDocument = AiRequestDispatchInput["inputPayload"];
type WorkbenchAiHandledResult = Awaited<ReturnType<CreateNerveBusAbilityGroupInput["handlerPort"]["requestAi"]>>;

const PRODUCT_PRESENCE_TASK_TYPE = "product_presence_judgment";
const PRODUCT_PRESENCE_MIN_CONFIDENCE = 0.6;

const buildWorkbenchAiInputRefs = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => envelope.aiInputRefs.map((ref) => ({
  id: ref,
  kind: "evidence-packet" as const,
  summary: inputPayload.summary,
}));

const describeFailureReason = (
  failureReason: string | { code?: string; message?: string; detail?: string | null } | null | undefined,
): string | null => {
  if (!failureReason) {
    return null;
  }

  if (typeof failureReason === "string") {
    return failureReason;
  }

  return failureReason.message ?? failureReason.code ?? failureReason.detail ?? "AI request failed.";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isProductPresenceOutput = (
  value: unknown,
): value is { isProductVideo: boolean | null; mustReview: boolean } => (
  isRecord(value)
  && "isProductVideo" in value
  && (typeof value.isProductVideo === "boolean" || value.isProductVideo === null)
  && "mustReview" in value
  && typeof value.mustReview === "boolean"
);

const resolveProductPresenceReviewReason = (input: {
  reviewRequiredReason: string | null | undefined;
  mustReview: boolean;
  lowConfidence: boolean;
  isProductVideo: boolean | null;
}) => {
  if (input.reviewRequiredReason) {
    return input.reviewRequiredReason;
  }
  if (input.mustReview) {
    return "product_presence_requires_human_review";
  }
  if (input.lowConfidence) {
    return "product_presence_low_confidence";
  }
  if (input.isProductVideo === null) {
    return "product_presence_uncertain";
  }
  return "product_presence_review_required";
};

const resolveWorkbenchAiDecision = (input: {
  aiTaskType: string;
  status: "success" | "failed" | "review_required";
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null | undefined;
  output: unknown;
}) => {
  if (input.aiTaskType !== PRODUCT_PRESENCE_TASK_TYPE || !isProductPresenceOutput(input.output)) {
    return {
      status: input.status,
      decision: input.aiTaskType,
      reviewRequiredReason: input.status === "review_required"
        ? (input.reviewRequiredReason ?? input.failureReason ?? "review required")
        : null,
      isProductVideo: null,
      mustReview: null,
    };
  }

  const lowConfidence = input.confidence === null || input.confidence < PRODUCT_PRESENCE_MIN_CONFIDENCE;
  const { isProductVideo, mustReview } = input.output;

  if (input.status === "failed") {
    return {
      status: "failed" as const,
      decision: "product_presence_failed",
      reviewRequiredReason: null,
      isProductVideo,
      mustReview,
    };
  }

  if (input.status === "review_required" || mustReview || lowConfidence || isProductVideo === null) {
    return {
      status: "review_required" as const,
      decision: "product_uncertain",
      reviewRequiredReason: resolveProductPresenceReviewReason({
        reviewRequiredReason: input.reviewRequiredReason,
        mustReview,
        lowConfidence,
        isProductVideo,
      }),
      isProductVideo,
      mustReview,
    };
  }

  return {
    status: "success" as const,
    decision: isProductVideo ? "product_yes" : "product_no",
    reviewRequiredReason: null,
    isProductVideo,
    mustReview,
  };
};

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before AI completion.");
  }
};

const requireChainField = (value: string | null | undefined): string => {
  if (!value) {
    throw new Error("Workbench AI request is missing required active map chain fields.");
  }

  return value;
};

const buildWorkbenchAiInputPayload = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);

  if (envelope.taskType !== PRODUCT_PRESENCE_TASK_TYPE) {
    return payload;
  }

  const preparedInputRef = payloadValueToString(payload.promptInputRef) ?? envelope.aiInputRefs[0] ?? null;
  const screenshotEvidenceId = payloadValueToString(payload.screenshotEvidenceRef) ?? preparedInputRef;
  const aiInputRefs = envelope.aiInputRefs.length > 0 ? envelope.aiInputRefs : (preparedInputRef ? [preparedInputRef] : []);
  const inputMode = aiInputRefs.length > 1 ? "multi_image" : "single_frame_fallback";
  const samplingStrategy = aiInputRefs.length > 1 ? "adaptive_short_video" : "single_frame_fallback";

  return {
    inputMode,
    multiFrameEvidenceSetId: null,
    contactSheetEvidenceId: inputMode === "multi_image" ? null : preparedInputRef,
    frameEvidenceIds: inputMode === "multi_image" ? aiInputRefs : [],
    screenshotEvidenceId,
    screenshotRegion: null,
    sourceUrl: payloadValueToString(payload.targetUrl) ?? "workbench://local-runtime/product-presence",
    samplingStrategy,
    sampledFrameCount: Math.max(aiInputRefs.length, 1),
    validFrameCount: aiInputRefs.length,
    expectedFrameCount: Math.max(aiInputRefs.length, 1),
    fallbackReason: inputMode === "single_frame_fallback" ? "workbench_single_frame_dispatch" : null,
    missingFrames: [],
    summary: inputPayload.summary,
    tags: ["workbench", envelope.promptContractId],
  };
};

const buildWorkbenchAiAbilityRequest = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => {
  const mapRecord = getDevelopmentMapPluginRegistry().active.getActiveOperationalMapRecord(envelope.mapId);

  return {
    abilityGroupId: "ai" as const,
    missionId: envelope.missionId,
    taskType: envelope.taskType,
    inputModality: "image_collection" as const,
    inputRefs: buildWorkbenchAiInputRefs(envelope, inputPayload),
    promptContractId: envelope.promptContractId,
    expectedOutputSchema: envelope.outputSchemaRef,
    requestedBy: "orchestration" as const,
    transportedBy: "nerve-bus" as const,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    capabilityCallId: envelope.requestId,
    nerveBusEnvelopeId: envelope.envelopeId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.mapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: requireChainField(mapRecord?.activationSnapshotRef),
    promptCatalogVersion: requireChainField(mapRecord?.promptCatalogVersion),
    qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
    providerPolicy: { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null },
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true },
    input: buildWorkbenchAiInputPayload(envelope, inputPayload),
  };
};

const buildAiOutputPayload = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  status: "success" | "failed" | "review_required";
  aiTaskType: string;
  decision: string;
  confidence: number | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  isProductVideo: boolean | null;
  mustReview: boolean | null;
}) => buildPayloadDocument({
  documentType: "ai.response",
  documentRef: `${input.envelope.requestId}:response`,
  summary: input.status === "success"
    ? `AI response accepted with decision=${input.decision}.`
    : input.reviewRequiredReason ?? input.failureReason ?? `AI response returned status=${input.status}.`,
  content: {
    aiTaskType: input.aiTaskType,
    decision: input.decision,
    status: input.status,
    confidence: input.confidence,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    isProductVideo: input.isProductVideo,
    mustReview: input.mustReview,
  },
});

const buildWorkbenchAiResponse = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  aiResult: {
    status: "success" | "failed" | "review_required";
    taskType?: string | null;
    confidence?: number | null;
    output?: unknown;
    failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
    reviewRequiredReason?: string | null;
  };
}): WorkbenchAiHandledResult => {
  const aiTaskType = input.aiResult.taskType ?? input.envelope.taskType;
  const confidence = input.aiResult.confidence ?? null;
  const failureReason = describeFailureReason(input.aiResult.failureReason);
  const resolvedDecision = resolveWorkbenchAiDecision({
    aiTaskType,
    status: input.aiResult.status,
    confidence,
    failureReason,
    reviewRequiredReason: input.aiResult.reviewRequiredReason,
    output: input.aiResult.output,
  });
  const outputPayload = buildAiOutputPayload({
    envelope: input.envelope,
    status: resolvedDecision.status,
    aiTaskType,
    decision: resolvedDecision.decision,
    confidence,
    failureReason,
    reviewRequiredReason: resolvedDecision.reviewRequiredReason,
    isProductVideo: resolvedDecision.isProductVideo,
    mustReview: resolvedDecision.mustReview,
  });

  return {
    envelope: {
      ...buildMirroredEnvelopeBase({
        channelId: "ai-to-orchestration",
        envelopeId: `${input.envelope.envelopeId}:response`,
        requestEnvelope: input.envelope,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["ai", aiTaskType],
      }),
      envelopeKind: "ai_response",
      responseId: `${input.envelope.requestId}:response`,
      from: "ai",
      to: "orchestration",
      correlationEnvelopeId: input.envelope.envelopeId,
      correlationCapabilityCallId: input.envelope.capabilityCallId,
      correlationInputRef: input.envelope.inputRef,
      proofRef: `${input.envelope.envelopeId}:response:proof`,
      status: resolvedDecision.status,
      decision: resolvedDecision.decision,
      confidence,
      outputRef: resolvedDecision.status === "success" ? outputPayload.documentRef : null,
      diagnosticPayloadRef: resolvedDecision.status === "success" ? null : outputPayload.documentRef,
      failureReason: resolvedDecision.status === "failed" ? failureReason : null,
      reviewRequiredReason: resolvedDecision.status === "review_required" ? resolvedDecision.reviewRequiredReason : null,
    },
    outputPayload,
  };
};

export const handleWorkbenchNerveBusAiRequest = async (
  runtime: WorkbenchRuntime,
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
  signal: AbortSignal,
): Promise<WorkbenchAiHandledResult> => {
  throwIfAborted(signal);
  const aiResult = await runtime.aiAbilityGroup.execute(buildWorkbenchAiAbilityRequest(envelope, inputPayload));
  throwIfAborted(signal);
  return buildWorkbenchAiResponse({ envelope, aiResult });
};