import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";
import type { DeepResearchRecordStore } from "./deep-research-analysis.records.js";
import type { DeepResearchResult } from "./deep-research-analysis.result.js";
import {
  finishFailure,
  type DeepResearchAnalysisContext,
  type DeepResearchGatewaySender,
  type PromptExchangeFailure,
  type StageLogger,
  type StageTraceContext,
} from "./deep-research-analysis.flow-shared.js";

export type AnalysisExecutionContext = {
  input: DeepResearchInput;
  dataDir: string;
  store: DeepResearchRecordStore;
  runtimeLogger: RuntimeLogger;
  traceContext: StageTraceContext;
  stageLogger: StageLogger;
  sender: DeepResearchGatewaySender;
  jobId: string;
  providerKind: DeepResearchAnalysisContext["providerKind"];
  recordHashes: Record<string, string>;
};

type AnalysisSuccess = { ok: true };
export type AnalysisFailure = { ok: false; result: DeepResearchResult };
export type AnalysisOutcome = AnalysisSuccess | AnalysisFailure;

export const finishPromptFailure = (
  context: AnalysisExecutionContext,
  failure: PromptExchangeFailure,
): AnalysisFailure => ({
  ok: false,
  result: finishFailure({
    store: context.store,
    runtimeLogger: context.runtimeLogger,
    traceContext: context.traceContext,
    jobId: context.jobId,
    status: failure.status,
    phase: failure.phase,
    reason: failure.reason,
    failureClass: failure.failureClass,
    recordHashes: context.recordHashes,
  }),
});