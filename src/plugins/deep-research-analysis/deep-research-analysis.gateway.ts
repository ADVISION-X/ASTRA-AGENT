import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createRuntimeEvent,
  createRuntimeLogger,
} from "../../lib/runtime-logs/index.js";
import { defaultGptWebProviderExecutionProfile } from "../../capabilities/ai-input-gateway/index.js";

import { mapGatewayResult } from "./deep-research-analysis.gateway-result.js";
import { createDeepResearchTraceContext } from "./deep-research-analysis.logging.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-bundle-shell.js";
import type {
  DeepResearchAnalysisContext,
  DeepResearchGatewayInputRef,
  DeepResearchGatewayPromptPackage,
  DeepResearchGatewaySender,
  ProviderKind,
} from "./deep-research-analysis.analysis-runner.js";

const toAiGatewayInputRef = (ref: DeepResearchGatewayInputRef) => typeof ref === "string"
  ? { id: ref, kind: "prompt-input", summary: ref }
  : ref;

export const buildGatewaySender = (
  context: DeepResearchAnalysisContext,
): DeepResearchGatewaySender => {
  if (context.sendPromptPackage) return context.sendPromptPackage;
  const aiInputGateway = context.aiInputGateway;
  if (!aiInputGateway) {
    const preflightLogger = context.runtimeLogger ?? createRuntimeLogger();
    preflightLogger.emit(createRuntimeEvent({
      context: createDeepResearchTraceContext("deep-research-preflight:gateway"),
      eventType: RuntimeLogEventType.DEEP_RESEARCH_JOB_FAILED,
      level: "error",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: "failed",
      reason: "Deep Research analysis requires sendPromptPackage or aiInputGateway.",
      payload: {
        phase: "INTAKE",
        failureClass: RuntimeFailureClass.INTERNAL_BUG,
        stageName: "INTAKE",
        retryable: false,
        terminal: true,
        recoveryPolicy: "terminal",
      },
    }));
    throw new Error("Deep Research analysis requires sendPromptPackage or aiInputGateway.");
  }
  return async (promptPackage) => mapGatewayResult(await aiInputGateway.execute({
    providerKind: promptPackage.providerKind,
    taskIdentity: {
      labelKey: "deep_research",
      sourceProject: "deep-research-analysis",
      taskKind: "analysis-prompt-package",
      sourceTaskId: promptPackage.jobId,
    },
    promptPackageId: promptPackage.promptPackageId,
    promptContractId: promptPackage.promptContractId,
    expectedOutputSchemaRef: null,
    textPrompt: promptPackage.promptText,
    inputRefs: promptPackage.inputRefs.map(toAiGatewayInputRef),
    modelName: promptPackage.providerKind === "gpt-web-chat"
      ? null : context.modelName ?? null,
    ...(promptPackage.providerKind === "gpt-web-chat" ? {
      providerExecutionProfile: defaultGptWebProviderExecutionProfile({
        owner: "deep-research",
        reasoningTier: "high",
      }),
    } : {}),
    timeoutMs: Math.max(context.timeoutMs ?? 0, promptPackage.timeoutMs),
    maxFileCount: promptPackage.maxFileCount,
    requestedBy: "ai-capability",
    missionId: promptPackage.jobId,
    runId: promptPackage.jobId,
    roundId: null,
  }));
};

export const buildPromptPackage = (input: {
  jobId: string;
  prompt: DeepResearchPrompt;
  promptKey: string;
  renderedPromptText: string;
  promptHash: string;
  providerKind: ProviderKind;
  inputRefs: DeepResearchGatewayInputRef[];
  timeoutMs?: number;
  maxFileCount?: number;
}): DeepResearchGatewayPromptPackage => ({
  jobId: input.jobId,
  promptPackageId: `${input.jobId}:${input.promptKey}:${input.prompt.promptVersion}`,
  promptContractId: input.prompt.expectedOutputContract.contractId,
  promptText: input.renderedPromptText,
  promptHash: input.promptHash,
  inputRefs: input.inputRefs,
  providerKind: input.providerKind,
  timeoutMs: input.timeoutMs ?? 180_000,
  maxFileCount: input.maxFileCount ?? 0,
});
