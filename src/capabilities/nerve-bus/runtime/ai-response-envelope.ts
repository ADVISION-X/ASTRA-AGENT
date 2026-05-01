import type { AiRequestEnvelope, AiResponseEnvelope, NerveBusHandledResult } from "../index.js";
import { buildPayloadDocument, buildTransportEnvelopeBase } from "../../../lib/local-runtime/workbench-payload.js";

const describeFailureReason = (
  failureReason: string | { code?: string; message?: string; detail?: string | null } | null | undefined,
): string | null => {
  if (!failureReason) {
    return null;
  }
  return typeof failureReason === "string" ? failureReason : failureReason.message ?? failureReason.code ?? failureReason.detail ?? "AI request failed.";
};

const buildAiOutputPayloadContent = (input: {
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
}) => ({ aiTaskType: input.aiTaskType, confidence: input.confidence, failureReason: input.failureReason });

const buildAiOutputPayload = (input: {
  envelope: AiRequestEnvelope;
  status: "success" | "failed" | "review_required";
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
}) =>
  buildPayloadDocument({
    documentType: "ai.response",
    documentRef: `${input.envelope.requestId}:response`,
    summary: input.status === "success" ? "AI response accepted." : input.failureReason ?? "AI response failed.",
    content: buildAiOutputPayloadContent(input),
  });

export const buildAiResponseEnvelope = (input: {
  envelope: AiRequestEnvelope;
  aiResult: {
    status: "success" | "failed" | "review_required";
    taskType?: string | null;
    confidence?: number | null;
    failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
    reviewRequiredReason?: string | null;
  };
}): NerveBusHandledResult<AiResponseEnvelope> => {
  const status = input.aiResult.status;
  const aiTaskType = input.aiResult.taskType ?? "dispatch_failure";
  const confidence = input.aiResult.confidence ?? null;
  const failureReason = describeFailureReason(input.aiResult.failureReason);
  const outputPayload = buildAiOutputPayload({ envelope: input.envelope, status, aiTaskType, confidence, failureReason });
  return {
    envelope: {
      ...buildTransportEnvelopeBase({
        channelId: "ai-to-orchestration",
        envelopeId: `${input.envelope.envelopeId}:response`,
        missionId: input.envelope.missionId,
        mapId: input.envelope.mapId,
        stepId: input.envelope.stepId,
        inputRef: input.envelope.inputRef,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["ai", aiTaskType],
      }),
      envelopeKind: "ai_response",
      responseId: `${input.envelope.requestId}:response`,
      from: "ai",
      to: "orchestration",
      status,
      decision: aiTaskType,
      confidence,
      outputRef: outputPayload.documentRef,
      diagnosticPayloadRef: null,
      failureReason: status === "failed" ? failureReason : null,
      reviewRequiredReason: status === "review_required" ? input.aiResult.reviewRequiredReason ?? null : null,
    },
    outputPayload,
  };
};