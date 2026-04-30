import {
  AI_ABILITY_GROUP_ID,
} from "../../capabilities/ai/index.js";
import type {
  NerveBusPayloadDocument,
} from "../../capabilities/nerve-bus/index.js";
import type { NerveBusHandledResult } from "../../capabilities/nerve-bus/ports/nerve-bus-handler-port.js";
import type {
  AiRequestEnvelope,
  AiResponseEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { VisionProductPresenceRequestInputSchema } from "../../types/vision-product-presence.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { buildPayloadDocument, buildTransportEnvelopeBase, payloadDocumentToObject } from "./workbench-payload.js";

const buildAiOutputPayload = (
  envelope: AiRequestEnvelope,
  status: "success" | "failed" | "review_required",
  aiTaskType: string,
  confidence: number | null,
  failureReason: string | null,
) =>
  buildPayloadDocument({
    documentType: "ai.response",
    documentRef: `${envelope.requestId}:response`,
    summary: status === "success" ? "AI response accepted." : failureReason ?? "AI response failed.",
    content: { aiTaskType, confidence, failureReason },
  });

export const handleNerveBusAiRequest = async (
  runtime: WorkbenchRuntime,
  envelope: AiRequestEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<NerveBusHandledResult<AiResponseEnvelope>> => {
  const input = VisionProductPresenceRequestInputSchema.parse(payloadDocumentToObject(inputPayload));
  const aiResult = await runtime.aiAbilityGroup.execute({
    abilityGroupId: AI_ABILITY_GROUP_ID,
    missionId: envelope.missionId,
    taskType: "product_presence_judgment",
    inputModality: "image_collection",
    inputRefs: [],
    promptContractId: "vision.productPresence.v1",
    expectedOutputSchema: "ai.product_presence_judgment.v1",
    requestedBy: "orchestration",
    transportedBy: "nerve-bus",
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    qualityPolicy: { minimumConfidence: 0.6, requireSchemaValidation: true },
    providerPolicy: { requireLocalOnly: true, allowPaidProvider: false, providerAllowlist: ["local-vision-ai"], operatorApprovalRef: null },
    costPolicy: { maxEstimatedCost: 0 },
    dataPolicy: { allowExternalTransmission: false, redactSensitiveData: true },
    safetyPolicy: { reviewOnLowConfidence: true, reviewOnSchemaFailure: true, reviewOnPolicyViolation: true },
    input,
  });
  const status = aiResult.status;
  const aiTaskType = aiResult.taskType ?? "dispatch_failure";
  const confidence = "confidence" in aiResult ? aiResult.confidence : null;
  const failureReason = aiResult.failureReason ?? null;
  const outputPayload = buildAiOutputPayload(envelope, status, aiTaskType, confidence, failureReason);
  return {
    envelope: {
      ...buildTransportEnvelopeBase({
        channelId: "ai-to-orchestration",
        envelopeId: `${envelope.envelopeId}:response`,
        missionId: envelope.missionId,
        mapId: envelope.mapId,
        stepId: envelope.stepId,
        inputRef: envelope.inputRef,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["ai", aiTaskType],
      }),
      envelopeKind: "ai_response",
      responseId: `${envelope.requestId}:response`,
      from: "ai",
      to: "orchestration",
      status,
      decision: aiTaskType,
      confidence,
      outputRef: outputPayload.documentRef,
      diagnosticPayloadRef: null,
      failureReason: status === "failed" ? failureReason : null,
      reviewRequiredReason: status === "review_required" ? aiResult.reviewRequiredReason ?? null : null,
    },
    outputPayload,
  } satisfies NerveBusHandledResult<AiResponseEnvelope>;
};