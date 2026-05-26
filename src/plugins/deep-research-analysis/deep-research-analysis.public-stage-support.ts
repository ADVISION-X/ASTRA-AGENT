import type { ResearchExport, ResearchJob } from "./deep-research-analysis.records.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.result.js";
import type {
  DeepResearchFullCaseFileSummaryView,
  DeepResearchStageStatus,
  DeepResearchStageView,
  DeepResearchTimelineEntry,
  DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";

const normalizeStringArray = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];

const hasExportKind = (exports: readonly ResearchExport[], kind: ResearchExport["exportKind"]): boolean =>
  exports.some((record) => record.exportKind === kind);

const chainStageOrder = [
  "stage-decompose",
  "stage-analyze-n",
  "stage-build-full-case-file",
  "stage-final-adjudication",
  "stage-html-report",
  "stage-export",
  "stage-complete",
] as const;

const buildInteractionHashes = (
  interactions: readonly DeepResearchTimelineEntry[],
): Pick<DeepResearchStageView, "promptHashes" | "rawResponseHashes" | "parseStatuses"> => ({
  promptHashes: normalizeStringArray(interactions.map((entry) => entry.promptHash)),
  rawResponseHashes: normalizeStringArray(interactions.map((entry) => entry.rawResponseHash)),
  parseStatuses: normalizeStringArray(interactions.map((entry) => entry.parseStatus)),
});

const resolveChainStageId = (phase: DeepResearchTimelineSnapshot["job"]["phase"]): typeof chainStageOrder[number] => {
  if (phase.startsWith("DECOMPOSE_")) {
    return "stage-decompose";
  }
  if (phase.startsWith("ANALYSIS_")) {
    return "stage-analyze-n";
  }
  if (phase === "FULL_CASE_FILE_BUILD") {
    return "stage-build-full-case-file";
  }
  if (phase.startsWith("FINAL_ADJUDICATION_")) {
    return "stage-final-adjudication";
  }
  if (phase.startsWith("HTML_REPORT_")) {
    return "stage-html-report";
  }
  if (phase === "EXPORT_REPORT") {
    return "stage-export";
  }
  if (phase === "COMPLETE") {
    return "stage-complete";
  }
  return "stage-decompose";
};

const stageOrderIndex = (stageId: typeof chainStageOrder[number]): number =>
  chainStageOrder.indexOf(stageId);

const resolveStageStatus = (input: {
  stageId: typeof chainStageOrder[number];
  currentStageId: typeof chainStageOrder[number];
  jobStatus: ResearchJob["status"];
  hasRecord: boolean;
}): DeepResearchStageStatus => {
  const currentIndex = stageOrderIndex(input.currentStageId);
  const stageIndex = stageOrderIndex(input.stageId);
  if (stageIndex < currentIndex) {
    return "completed";
  }
  if (stageIndex > currentIndex) {
    return "pending";
  }
  if (input.jobStatus === "failed") {
    return "failed";
  }
  if (input.jobStatus === "review_required") {
    return "review_required";
  }
  if (input.jobStatus === "running") {
    return "running";
  }
  return input.hasRecord ? "completed" : "pending";
};

const buildStageView = (input: {
  stageId: typeof chainStageOrder[number];
  label: string;
  anchorId: string;
  job: DeepResearchTimelineSnapshot["job"];
  currentStageId: typeof chainStageOrder[number];
  interactions?: readonly DeepResearchTimelineEntry[];
  recordCount: number;
  hasRecord: boolean;
}): DeepResearchStageView => ({
  id: input.stageId,
  label: input.label,
  anchorId: input.anchorId,
  status: resolveStageStatus({
    stageId: input.stageId,
    currentStageId: input.currentStageId,
    jobStatus: input.job.status,
    hasRecord: input.hasRecord,
  }),
  ...buildInteractionHashes(input.interactions ?? []),
  recordCount: input.recordCount,
  failureReason: input.stageId === input.currentStageId ? input.job.failureReason : null,
  reviewReason: input.stageId === input.currentStageId ? input.job.reviewReason : null,
});

type StageDefinition = Omit<Parameters<typeof buildStageView>[0], "job" | "currentStageId">;

const buildStageDefinitions = (input: {
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestionCount: number;
  analysisCount: number;
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  fullCaseFileSummary: DeepResearchFullCaseFileSummaryView;
  exports: readonly ResearchExport[];
  completed: boolean;
}): StageDefinition[] => {
  const decompositionInteractions = input.timeline.filter((entry) => entry.phase === "decomposition");
  const analysisInteractions = input.timeline.filter((entry) => entry.phase === "analysis");
  const finalInteractions = input.timeline.filter((entry) => entry.phase === "final_adjudication");
  const htmlInteractions = input.timeline.filter((entry) => entry.phase === "html_report");
  const hasBusinessHtmlExport = hasExportKind(input.exports, "business-report.html");
  return [
    { stageId: "stage-decompose", label: "DECOMPOSE", anchorId: "research-plan", interactions: decompositionInteractions, recordCount: input.subQuestionCount, hasRecord: decompositionInteractions.length > 0 },
    { stageId: "stage-analyze-n", label: "ANALYZE_N", anchorId: "analysis-cards", interactions: analysisInteractions, recordCount: Math.max(input.analysisCount, analysisInteractions.length), hasRecord: input.analysisCount > 0 || analysisInteractions.length > 0 },
    { stageId: "stage-build-full-case-file", label: "BUILD_FULL_CASE_FILE", anchorId: "full-case-file", recordCount: Number(input.fullCaseFileSummary.hasMarkdown) + Number(input.fullCaseFileSummary.hasJson), hasRecord: input.fullCaseFileSummary.hasMarkdown || input.fullCaseFileSummary.hasJson },
    { stageId: "stage-final-adjudication", label: "FINAL_ADJUDICATION", anchorId: "conclusion", interactions: finalInteractions, recordCount: input.finalAdjudication ? 1 : 0, hasRecord: Boolean(input.finalAdjudication) || finalInteractions.length > 0 },
    { stageId: "stage-html-report", label: "HTML_REPORT", anchorId: "business-report", interactions: htmlInteractions, recordCount: Number(hasBusinessHtmlExport), hasRecord: hasBusinessHtmlExport || htmlInteractions.length > 0 },
    { stageId: "stage-export", label: "EXPORT", anchorId: "full-case-file", recordCount: input.exports.length, hasRecord: input.exports.length > 0 },
    { stageId: "stage-complete", label: "COMPLETE", anchorId: "process-trace", recordCount: input.completed ? 1 : 0, hasRecord: input.completed },
  ];
};

export const buildFullCaseFileSummary = (input: {
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestionCount: number;
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  exports: readonly ResearchExport[];
}): DeepResearchFullCaseFileSummaryView => ({
  hasMarkdown: hasExportKind(input.exports, "full-case-file.md"),
  hasJson: hasExportKind(input.exports, "full-case-file.json"),
  decompositionRawPresent: input.timeline.some((entry) =>
    entry.phase === "decomposition" && entry.rawResponseText.trim().length > 0),
  analysisRawCount: input.timeline.filter((entry) =>
    entry.phase === "analysis" && entry.rawResponseText.trim().length > 0).length,
  subQuestionCount: input.subQuestionCount,
  finalRawPresent: Boolean(input.finalAdjudication?.rawFinalAnswerText.trim()),
  htmlReportPresent: hasExportKind(input.exports, "business-report.html"),
});

export const buildStageViews = (input: {
  job: ResearchJob;
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestionCount: number;
  analysisCount: number;
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  fullCaseFileSummary: DeepResearchFullCaseFileSummaryView;
  exports: readonly ResearchExport[];
}): DeepResearchStageView[] => {
  const currentStageId = resolveChainStageId(input.job.phase);
  return buildStageDefinitions({
    timeline: input.timeline,
    subQuestionCount: input.subQuestionCount,
    analysisCount: input.analysisCount,
    finalAdjudication: input.finalAdjudication,
    fullCaseFileSummary: input.fullCaseFileSummary,
    exports: input.exports,
    completed: input.job.status === "completed",
  }).map((definition) => buildStageView({ ...definition, job: input.job, currentStageId }));
};