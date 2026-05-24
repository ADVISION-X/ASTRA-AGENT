import { RuntimeFailureClass } from "../../lib/runtime-logs/index.js";
import {
  logDeepResearchDomCaptureCompleted,
  logDeepResearchDomCaptureStarted,
} from "./deep-research-analysis.logging.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type FlowStageHandle,
  buildFlowStageStartFields,
} from "./deep-research-analysis.flow-shared.js";
import {
  type CapturePromptOutputInput,
  type CaptureSuccess,
  buildDomRef,
  buildGatewayFailure,
} from "./deep-research-analysis.prompt-exchange-stage-support.js";

const completeCaptureFailure = (captureStage: FlowStageHandle, input: {
  status: "failed" | "review_required";
  reason: string;
  domRef: string;
  promptHash: string;
  rawResponseHash: string;
}): void => {
  const terminalInput = {
    reason: input.reason,
    failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
    retryable: true,
    terminal: true,
    recoveryPolicy: "review_required" as const,
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  };
  if (input.status === "failed") {
    captureStage.fail(terminalInput);
    return;
  }
  captureStage.reviewRequired(terminalInput);
};

const completeCaptureSuccess = (input: {
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  domRef: string;
  subQuestionId?: string;
} & Pick<CapturePromptOutputInput, "runtimeLogger" | "traceContext">, captureStage: FlowStageHandle): void => {
  logDeepResearchDomCaptureCompleted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: input.rawResponseHash,
    domRef: input.domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  captureStage.complete({
    durationMs: Math.max(0, Date.now() - captureStage.startedAt),
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
  });
};

const continueCapturePromptOutput = async (
  input: CapturePromptOutputInput & { captureStage: FlowStageHandle },
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure>> => {
  logDeepResearchDomCaptureStarted({
    logger: input.runtimeLogger,
    traceContext: input.traceContext,
    phase: input.stage,
    promptHash: input.promptHash,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  });
  const gatewayResult = await input.sender(input.promptPackage);
  if (gatewayResult.status !== "completed") {
    const status = gatewayResult.status === "failed" ? "failed" : "review_required";
    const domRef = buildDomRef(
      input.prompt.promptId,
      input.jobId,
      gatewayResult.rawOutputRef,
    );
    const reason = gatewayResult.errorReason ?? `ai_gateway_${gatewayResult.status}`;
    completeCaptureFailure(input.captureStage, {
      status,
      reason,
      domRef,
      promptHash: input.promptHash,
      rawResponseHash: gatewayResult.rawOutputHash,
    });
    return buildGatewayFailure({
      stage: input.stage,
      status,
      promptHash: input.promptHash,
      rawResponseHash: gatewayResult.rawOutputHash,
      gatewayStatus: gatewayResult.status,
      reason,
    });
  }
  const domRef = buildDomRef(
    input.prompt.promptId,
    input.jobId,
    gatewayResult.rawOutputRef,
  );
  completeCaptureSuccess({
    runtimeLogger: input.runtimeLogger,
    traceContext: input.traceContext,
    stage: input.stage,
    promptHash: input.promptHash,
    rawResponseHash: gatewayResult.rawOutputHash,
    domRef,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
  }, input.captureStage);
  return { gatewayResult, domRef };
};

export const capturePromptOutput = async (
  input: CapturePromptOutputInput,
): Promise<CaptureSuccess | ReturnType<typeof buildGatewayFailure>> => {
  input.store.updateJobState({
    jobId: input.jobId,
    status: "running",
    phase: input.stage,
  });
  const startFields = buildFlowStageStartFields({
    traceContext: input.traceContext,
    preview: input.preview,
    hashes: { promptHash: input.promptHash },
  });
  switch (input.stage) {
    case "DECOMPOSE_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECOMPOSE_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "ANALYSIS_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "ANALYSIS_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "POSITIVE_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "POSITIVE_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FALSIFY_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FALSIFY_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FINAL_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "FINAL_ADJUDICATION_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "FINAL_ADJUDICATION_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "DECK_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECK_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    case "DECK_PPT_CAPTURE": {
      const captureStage = input.stageLogger.start({ ...startFields, stageName: "DECK_PPT_CAPTURE" });
      return continueCapturePromptOutput({ ...input, captureStage });
    }
    default:
      throw new Error(`Unsupported Deep Research capture stage ${input.stage}.`);
  }
};