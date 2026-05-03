import type {
  AiRequestDispatchInput,
  CreateNerveBusAbilityGroupInput,
} from "../../capabilities/nerve-bus/contract.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildMirroredEnvelopeBase,
  buildPayloadDocument,
  payloadDocumentToObject,
} from "./workbench-payload.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiPayloadDocument = AiRequestDispatchInput["inputPayload"];
type WorkbenchAiHandledResult = Awaited<ReturnType<CreateNerveBusAbilityGroupInput["handlerPort"]["requestAi"]>>;

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

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before AI completion.");
  }
};

const buildWorkbenchAiAbilityRequest = (
  envelope: WorkbenchAiRequestEnvelope,
  inputPayload: WorkbenchAiPayloadDocument,
) => {
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
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    promptCatalogVersion: envelope.promptContractVersion,
    qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
    providerPolicy: { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null },
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true },
    input: payloadDocumentToObject(inputPayload),
  };
};

const buildAiOutputPayload = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  status: "success" | "failed" | "review_required";
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
}) => buildPayloadDocument({
  documentType: "ai.response",
  documentRef: `${input.envelope.requestId}:response`,
  summary: input.status === "success" ? "AI response accepted." : input.failureReason ?? "AI response failed.",
  content: {
    aiTaskType: input.aiTaskType,
    confidence: input.confidence,
    failureReason: input.failureReason,
  },
});

const buildWorkbenchAiResponse = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  aiResult: {
    status: "success" | "failed" | "review_required";
    taskType?: string | null;
    confidence?: number | null;
    failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
    reviewRequiredReason?: string | null;
  };
}): WorkbenchAiHandledResult => {
  const status = input.aiResult.status;
  const aiTaskType = input.aiResult.taskType ?? input.envelope.taskType;
  const confidence = input.aiResult.confidence ?? null;
  const failureReason = describeFailureReason(input.aiResult.failureReason);
  const outputPayload = buildAiOutputPayload({
    envelope: input.envelope,
    status,
    aiTaskType,
    confidence,
    failureReason,
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
      status,
      decision: aiTaskType,
      confidence,
      outputRef: status === "success" ? outputPayload.documentRef : null,
      diagnosticPayloadRef: status === "success" ? null : outputPayload.documentRef,
      failureReason: status === "failed" ? failureReason : null,
      reviewRequiredReason: status === "review_required" ? input.aiResult.reviewRequiredReason ?? null : null,
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