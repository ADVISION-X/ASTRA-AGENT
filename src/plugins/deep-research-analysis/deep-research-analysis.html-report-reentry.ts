import {
  createStageLogger,
  RuntimeFailureClass,
} from "../../lib/runtime-logs/index.js";
import {
  createDeepResearchTraceContext,
} from "./deep-research-analysis.logging.js";
import {
  completeSuccessfulRun,
} from "./deep-research-analysis.analysis-finalization.js";
import {
  type AnalysisExecutionContext,
} from "./deep-research-analysis.analysis-support.js";
import {
  buildDeepResearchStructuredIndex,
} from "./deep-research-analysis.final-package.js";
import {
  buildDeepResearchFullCaseFile,
} from "./deep-research-analysis.full-case-file.js";
import {
  renderDeepResearchFullCaseFileMarkdown,
} from "./deep-research-analysis.full-case-file-render.js";
import {
  buildGatewaySender,
  ensureRuntimeContext,
  finishFailure,
  type DeepResearchAnalysisContext,
} from "./deep-research-analysis.flow-shared.js";
import {
  runBusinessHtmlReportPhase,
} from "./deep-research-analysis.html-report-stage.js";
import {
  createDeepResearchRecordStore,
  type ResearchJob,
} from "./deep-research-analysis.records.js";
import type {
  DeepResearchResult,
} from "./deep-research-analysis.result.js";

const buildInputFromJob = (job: ResearchJob) => ({
  userQuestion: job.userQuestion,
  analysisGoal: job.analysisGoal,
  language: job.language,
  maxSubQuestions: job.maxSubQuestions,
  outputFormat: job.outputFormat,
});

const buildExecutionContext = (input: {
  context: DeepResearchAnalysisContext;
  dataDir: string;
  job: ResearchJob;
}): AnalysisExecutionContext => ({
  input: buildInputFromJob(input.job),
  dataDir: input.dataDir,
  store: createDeepResearchRecordStore(input.dataDir),
  runtimeLogger: input.context.runtimeLogger!,
  traceContext: createDeepResearchTraceContext(input.job.id),
  stageLogger: createStageLogger({ logger: input.context.runtimeLogger! }),
  sender: buildGatewaySender(input.context),
  jobId: input.job.id,
  providerKind: input.context.providerKind,
  recordHashes: {},
});

const failHtmlReportReentry = (input: {
  executionContext: AnalysisExecutionContext;
  reason: string;
}): DeepResearchResult => finishFailure({
  store: input.executionContext.store,
  runtimeLogger: input.executionContext.runtimeLogger,
  traceContext: input.executionContext.traceContext,
  jobId: input.executionContext.jobId,
  status: "review_required",
  phase: "HTML_REPORT_SEND",
  reason: input.reason,
  failureClass: RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION,
  recordHashes: input.executionContext.recordHashes,
});

export const rerunDeepResearchBusinessHtmlReport = async (input: {
  jobId: string;
  context: DeepResearchAnalysisContext;
}): Promise<DeepResearchResult> => {
  const runtime = ensureRuntimeContext(input.context);
  const store = createDeepResearchRecordStore(runtime.dataDir);
  const job = store.getJob(input.jobId);
  store.close();
  if (!job) {
    throw new Error(`Deep research job ${input.jobId} was not found.`);
  }

  const executionContext = buildExecutionContext({
    context: input.context,
    dataDir: runtime.dataDir,
    job,
  });
  try {
    const finalReport = executionContext.store.getLatestFinalReport(input.jobId)?.report ?? null;
    if (!finalReport) {
      return failHtmlReportReentry({
        executionContext,
        reason: "deep_research_final_report_required_for_html_report_reentry",
      });
    }
    const finalPackage = buildDeepResearchStructuredIndex({
      store: executionContext.store,
      jobId: input.jobId,
    });
    const fullCaseFile = buildDeepResearchFullCaseFile({
      store: executionContext.store,
      jobId: input.jobId,
      structuredIndex: finalPackage,
    });
    const fullCaseFileMarkdown = renderDeepResearchFullCaseFileMarkdown(fullCaseFile);
    const htmlReport = await runBusinessHtmlReportPhase(
      executionContext,
      finalPackage,
      finalReport,
      fullCaseFile,
      fullCaseFileMarkdown,
    );
    if (!htmlReport.ok) {
      return htmlReport.result;
    }
    return await completeSuccessfulRun(
      executionContext,
      finalPackage,
      fullCaseFile,
      finalReport,
    );
  } finally {
    executionContext.store.close();
  }
};
