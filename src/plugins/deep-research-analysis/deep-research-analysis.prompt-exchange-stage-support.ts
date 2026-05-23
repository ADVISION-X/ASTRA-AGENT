import { RuntimeFailureClass, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DeepResearchPrompt } from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchParserResult } from "./deep-research-analysis.parser.js";
import {
  type DeepResearchRecordStore,
  type ResearchInteraction,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import type {
  DeepResearchGatewayPromptPackage,
  DeepResearchGatewayResult,
  DeepResearchGatewaySender,
  ExchangePersistSummary,
  PromptExchangeFailure,
  ProviderKind,
  StageLogger,
  StageTraceContext,
} from "./deep-research-analysis.flow-shared.js";

export type SuccessfulParserResult<TParsed> = Extract<
  DeepResearchParserResult<TParsed>,
  { parseStatus: "parsed" }
>;

type PromptPreview = {
  promptId: string;
  promptVersion: string;
  subQuestionId?: string;
};

export type CaptureSuccess = {
  gatewayResult: DeepResearchGatewayResult;
  domRef: string;
};

export type CapturePromptOutputInput = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  jobId: string;
  prompt: DeepResearchPrompt;
  promptPackage: DeepResearchGatewayPromptPackage;
  promptHash: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  subQuestionId?: string;
};

export type ParseSuccess<TParsed> = {
  parsed: SuccessfulParserResult<TParsed>;
  recordCount: number;
};

export type ParsePromptOutputInput<TParsed> = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  jobId: string;
  promptHash: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  gatewayResult: DeepResearchGatewayResult;
  subQuestionId?: string;
  parse: (rawText: string) => DeepResearchParserResult<TParsed>;
  successRecordCount: (parsed: TParsed) => number;
};

export type PersistPromptOutputInput<TParsed> = {
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  recordHashes: Record<string, string>;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  preview: PromptPreview;
  stage: DeepResearchPhase;
  subQuestionId?: string;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  parsed: SuccessfulParserResult<TParsed>;
  persist: (input: {
    interaction: ResearchInteraction;
    parsed: TParsed;
  }) => ExchangePersistSummary;
};

export const buildDomRef = (
  promptId: string,
  jobId: string,
  rawOutputRef: string | null,
): string => rawOutputRef ?? `artifact://deep-research/${jobId}/${promptId}`;

export const buildGatewayFailure = (input: {
  stage: DeepResearchPhase;
  status: "failed" | "review_required";
  promptHash: string;
  rawResponseHash: string;
  gatewayStatus: DeepResearchGatewayResult["status"];
}): PromptExchangeFailure => ({
  status: input.status,
  phase: input.stage,
  reason: `ai_gateway_${input.gatewayStatus}`,
  failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
  promptHash: input.promptHash,
  rawResponseHash: input.rawResponseHash,
});

export const buildParseFailure = (input: {
  stage: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  reason: string;
  status: "failed" | "review_required";
}): PromptExchangeFailure => ({
  status: input.status,
  phase: input.stage,
  reason: input.reason,
  failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
  promptHash: input.promptHash,
  rawResponseHash: input.rawResponseHash,
});

export const createInteractionRecord = <TParsed>(input: {
  store: DeepResearchRecordStore;
  jobId: string;
  providerKind: ProviderKind;
  prompt: DeepResearchPrompt;
  promptHash: string;
  subQuestionId?: string;
  domRef: string;
  gatewayResult: DeepResearchGatewayResult;
  parsed: SuccessfulParserResult<TParsed>;
}): ResearchInteraction =>
  input.store.createInteraction({
    jobId: input.jobId,
    phase: input.prompt.phase,
    ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    promptHash: input.promptHash,
    domRef: input.domRef,
    rawResponseText: input.gatewayResult.normalizedText,
    rawResponseHash: input.parsed.rawResponseHash,
    normalizedText: input.parsed.normalizedText,
    parseStatus: input.parsed.parseStatus,
    providerKind: input.providerKind,
    providerProofJson: input.gatewayResult.providerProofJson,
  });