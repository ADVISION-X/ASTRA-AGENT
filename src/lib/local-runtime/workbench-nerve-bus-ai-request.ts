import type {
  AiRequestDispatchInput,
  CreateNerveBusAbilityGroupInput,
} from "../../capabilities/nerve-bus/contract.js";

import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildMirroredEnvelopeBase,
  buildPayloadDocument,
} from "./workbench-payload.js";
import { describeFailureReason, resolveWorkbenchAiDecision } from "./workbench-nerve-bus-ai-decision.js";
import {
  buildWorkbenchAiAbilityRequest,
  throwIfAborted,
} from "./workbench-nerve-bus-ai-request-builder.js";

type WorkbenchAiRequestEnvelope = AiRequestDispatchInput["envelope"];
type WorkbenchAiPayloadDocument = AiRequestDispatchInput["inputPayload"];
type WorkbenchAiHandledResult = Awaited<ReturnType<CreateNerveBusAbilityGroupInput["handlerPort"]["requestAi"]>>;

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

const buildWorkbenchAiResponseEnvelope = (input: {
  envelope: WorkbenchAiRequestEnvelope;
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
  resolvedDecision: ReturnType<typeof resolveWorkbenchAiDecision>;
  outputPayload: ReturnType<typeof buildAiOutputPayload>;
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
    status: input.resolvedDecision.status,
    decision: input.resolvedDecision.decision,
    confidence: input.confidence,
    outputRef: input.resolvedDecision.status === "success" ? input.outputPayload.documentRef : null,
    diagnosticPayloadRef: input.resolvedDecision.status === "success" ? null : input.outputPayload.documentRef,
    failureReason: input.resolvedDecision.status === "failed" ? input.failureReason : null,
    reviewRequiredReason: input.resolvedDecision.status === "review_required" ? input.resolvedDecision.reviewRequiredReason : null,
  };
};

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
    envelope: buildWorkbenchAiResponseEnvelope({
      envelope: input.envelope,
      aiTaskType,
      confidence,
      failureReason,
      resolvedDecision,
      outputPayload,
    }),
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