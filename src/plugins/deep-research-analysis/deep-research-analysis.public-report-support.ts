import path from "node:path";
import { statSync } from "node:fs";

import { createDeepResearchRecordStore } from "./deep-research-analysis.records.js";
import type {
  ResearchAnswer,
  ResearchExport,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.result.js";
import type {
  DeepResearchAnswerBlockView,
  DeepResearchConclusionView,
  DeepResearchEvidenceView,
  DeepResearchExportView,
  DeepResearchFullCaseFileSummaryView,
  DeepResearchHistoryJobView,
  DeepResearchResearchPlanView,
  DeepResearchReportViewModel,
  DeepResearchStageStatus,
  DeepResearchStageView,
  DeepResearchSubQuestionView,
  DeepResearchTimelineEntry,
  DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";

const truncateText = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
};

const normalizeStringArray = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];

const readParsedIndexNotes = (answer: ResearchAnswer): string[] => {
  const candidate = answer.parsedPayload["indexNotes"];
  const parsedNotes = Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string")
    : [];
  return normalizeStringArray([
    ...parsedNotes,
    ...answer.keyPoints,
    ...answer.evidenceMentions,
  ]);
};

const readParsedJsonIndex = (answer: ResearchAnswer): unknown | null =>
  Object.keys(answer.parsedPayload).length > 0 ? answer.parsedPayload : null;

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

const buildSubQuestionView = (input: {
  record: ResearchSubQuestion;
  analysisStatus?: string | null;
  parseStatus?: string | null;
}): DeepResearchSubQuestionView => ({
  id: input.record.id,
  modelQuestionId: input.record.modelQuestionId,
  ordinal: input.record.ordinal,
  title: input.record.question.title,
  questionText: input.record.question.questionText,
  purpose: input.record.question.purpose,
  whyItMatters: input.record.question.whyItMatters ?? null,
  decisionWeight: input.record.question.decisionWeight ?? null,
  analysisFocus: input.record.question.analysisFocus ?? null,
  requiredEvidence: [...input.record.question.requiredEvidence],
  scope: input.record.question.scope,
  expectedAnswerShape: input.record.question.expectedAnswerShape,
  priority: input.record.question.priority ?? null,
  omissionRisk: input.record.question.omissionRisk ?? null,
  promptBundle: input.record.question.promptBundle,
  analysisStatus: input.analysisStatus ?? null,
  parseStatus: input.parseStatus ?? null,
});

const buildAnswerBlockView = (input: {
  answer: ResearchAnswer | undefined;
  interaction: DeepResearchTimelineEntry | undefined;
}): DeepResearchAnswerBlockView | null => {
  if (!input.answer) {
    return null;
  }
  return {
    interaction: input.interaction ?? null,
    answerKind: input.answer.answerKind,
    answerText: input.answer.answerText,
    preview: truncateText(input.answer.answerText, 360),
    indexNotes: readParsedIndexNotes(input.answer),
    keyPoints: [...input.answer.keyPoints],
    evidenceMentions: [...input.answer.evidenceMentions],
    assumptions: [...input.answer.assumptions],
    limitations: [...input.answer.limitations],
    contradictionPoints: [...input.answer.contradictionPoints],
    parsedPayload: input.answer.parsedPayload,
    parsedJsonIndex: readParsedJsonIndex(input.answer),
  };
};

const exportLabels: Partial<Record<ResearchExport["exportKind"], string>> = {
  "business-report.html": "Primary business HTML report",
  "final-adjudication-raw.md": "Final adjudication raw",
  "full-case-file.md": "Full case file (Markdown)",
  "full-case-file.json": "Full case file (JSON)",
  "structured-index.json": "Structured index (JSON)",
};

const formatExportLabel = (exportKind: ResearchExport["exportKind"]): string =>
  exportLabels[exportKind] ?? "Evidence index";

export const buildStageViews = (input: {
  job: ResearchJob;
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestionCount: number;
  analysisCount: number;
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  fullCaseFileSummary: DeepResearchFullCaseFileSummaryView;
  exports: readonly ResearchExport[];
}): DeepResearchStageView[] => {
  const decompositionInteractions = input.timeline.filter((entry) => entry.phase === "decomposition");
  const analysisInteractions = input.timeline.filter((entry) => entry.phase === "analysis");
  const finalInteractions = input.timeline.filter((entry) => entry.phase === "final_adjudication");
  const htmlInteractions = input.timeline.filter((entry) => entry.phase === "html_report");
  const currentStageId = resolveChainStageId(input.job.phase);
  return [
    buildStageView({
      stageId: "stage-decompose",
      label: "DECOMPOSE",
      anchorId: "research-plan",
      job: input.job,
      currentStageId,
      interactions: decompositionInteractions,
      recordCount: input.subQuestionCount,
      hasRecord: decompositionInteractions.length > 0,
    }),
    buildStageView({
      stageId: "stage-analyze-n",
      label: "ANALYZE_N",
      anchorId: "analysis-cards",
      job: input.job,
      currentStageId,
      interactions: analysisInteractions,
      recordCount: Math.max(input.analysisCount, analysisInteractions.length),
      hasRecord: input.analysisCount > 0 || analysisInteractions.length > 0,
    }),
    buildStageView({
      stageId: "stage-build-full-case-file",
      label: "BUILD_FULL_CASE_FILE",
      anchorId: "full-case-file",
      job: input.job,
      currentStageId,
      recordCount: Number(input.fullCaseFileSummary.hasMarkdown) + Number(input.fullCaseFileSummary.hasJson),
      hasRecord: input.fullCaseFileSummary.hasMarkdown || input.fullCaseFileSummary.hasJson,
    }),
    buildStageView({
      stageId: "stage-final-adjudication",
      label: "FINAL_ADJUDICATION",
      anchorId: "conclusion",
      job: input.job,
      currentStageId,
      interactions: finalInteractions,
      recordCount: input.finalAdjudication ? 1 : 0,
      hasRecord: Boolean(input.finalAdjudication) || finalInteractions.length > 0,
    }),
    buildStageView({
      stageId: "stage-html-report",
      label: "HTML_REPORT",
      anchorId: "business-report",
      job: input.job,
      currentStageId,
      interactions: htmlInteractions,
      recordCount: Number(hasExportKind(input.exports, "business-report.html")),
      hasRecord: hasExportKind(input.exports, "business-report.html") || htmlInteractions.length > 0,
    }),
    buildStageView({
      stageId: "stage-export",
      label: "EXPORT",
      anchorId: "full-case-file",
      job: input.job,
      currentStageId,
      recordCount: input.exports.length,
      hasRecord: input.exports.length > 0,
    }),
    buildStageView({
      stageId: "stage-complete",
      label: "COMPLETE",
      anchorId: "process-trace",
      job: input.job,
      currentStageId,
      recordCount: input.job.status === "completed" ? 1 : 0,
      hasRecord: input.job.status === "completed",
    }),
  ];
};

export const buildConclusionView = (
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null,
): DeepResearchConclusionView | null => {
  if (!finalAdjudication) {
    return null;
  }
  return {
    rawFinalAnswerText: finalAdjudication.rawFinalAnswerText,
    preferredFormat: finalAdjudication.preferredFormat,
    parseStatus: finalAdjudication.parseStatus,
    parsedJsonIndex: finalAdjudication.parsedJsonIndex,
  };
};

export const buildResearchPlanView = (input: {
  researchPlan: DeepResearchTimelineSnapshot["researchPlan"];
  decompositionInteraction: DeepResearchTimelineEntry | null;
  subQuestionReports: DeepResearchReportViewModel["subQuestionReports"];
}): DeepResearchResearchPlanView | null => {
  if (!input.researchPlan) {
    return null;
  }
  return {
    interaction: input.decompositionInteraction,
    mainQuestion: input.researchPlan.mainQuestion,
    questionType: input.researchPlan.questionType,
    decompositionStrategy: input.researchPlan.decompositionStrategy,
    subQuestions: input.subQuestionReports.map((entry) => entry.subQuestion),
    finalAdjudicationPromptBundle: input.researchPlan.finalAdjudicationPromptBundle,
    htmlReportPromptBundle: input.researchPlan.htmlReportPromptBundle,
    planIntegrityCheck: input.researchPlan.planIntegrityCheck,
  };
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

const buildInteractionHeadline = (input: {
  interaction: DeepResearchTimelineEntry;
  subQuestionById: Map<string, DeepResearchSubQuestionView>;
}): string => {
  if (input.interaction.phase === "decomposition") {
    return "Decomposition";
  }
  if (input.interaction.phase === "final_adjudication") {
    return "Final Adjudication";
  }
  if (input.interaction.phase === "html_report") {
    return "Business HTML Report Publisher";
  }
  const subQuestion = input.interaction.subQuestionId
    ? input.subQuestionById.get(input.interaction.subQuestionId)
    : null;
  const prefix = subQuestion
    ? `Q${subQuestion.ordinal + 1}: ${subQuestion.title}`
    : input.interaction.subQuestionId ?? "Sub-question";
  if (input.interaction.phase === "analysis") {
    return `${prefix} Independent Analysis`;
  }
  return `${prefix} ${input.interaction.phase}`;
};

export const buildHistoryJobView = (input: {
  store: ReturnType<typeof createDeepResearchRecordStore>;
  job: ResearchJob;
}): DeepResearchHistoryJobView => {
  const interactions = input.store.listInteractions(input.job.id);
  const subQuestions = input.store.listSubQuestions(input.job.id);
  const exports = input.store.listExports(input.job.id);
  const finalAdjudication = input.store.getLatestFinalAdjudication(input.job.id);
  return {
    id: input.job.id,
    title: truncateText(input.job.userQuestion, 84),
    userQuestion: input.job.userQuestion,
    questionSummary: truncateText(
      finalAdjudication?.rawFinalAnswerText ?? input.job.analysisGoal ?? input.job.userQuestion,
      180,
    ),
    analysisGoal: input.job.analysisGoal,
    status: input.job.status,
    phase: input.job.phase,
    failureReason: input.job.failureReason,
    reviewReason: input.job.reviewReason,
    createdAt: input.job.createdAt,
    updatedAt: input.job.updatedAt,
    subQuestionCount: subQuestions.length,
    interactionCount: interactions.length,
    exportCount: exports.length,
    htmlReportStatus: hasExportKind(exports, "business-report.html")
      ? "generated"
      : input.job.status === "failed" || input.job.status === "review_required"
        ? "failed"
        : "missing",
    fullCaseFileStatus: hasExportKind(exports, "full-case-file.md") || hasExportKind(exports, "full-case-file.json")
      ? "generated"
      : "missing",
    finalAdjudicationPreview: finalAdjudication
      ? truncateText(finalAdjudication.rawFinalAnswerText, 220)
      : null,
  };
};

export const buildTimelineByPhaseAndSubQuestionId = (
  timeline: readonly DeepResearchTimelineEntry[],
): Map<string, DeepResearchTimelineEntry> => {
  const timelineByPhaseAndSubQuestionId = new Map<string, DeepResearchTimelineEntry>();
  for (const entry of timeline) {
    timelineByPhaseAndSubQuestionId.set(`${entry.phase}:${entry.subQuestionId ?? ""}`, entry);
  }
  return timelineByPhaseAndSubQuestionId;
};

export const buildAnswerByKindAndSubQuestionId = (
  answers: readonly ResearchAnswer[],
): Map<string, ResearchAnswer> => {
  const answerByKindAndSubQuestionId = new Map<string, ResearchAnswer>();
  for (const answer of answers) {
    answerByKindAndSubQuestionId.set(`${answer.answerKind}:${answer.subQuestionId}`, answer);
  }
  return answerByKindAndSubQuestionId;
};

export const buildReportSubQuestionViews = (
  subQuestions: readonly ResearchSubQuestion[],
): DeepResearchSubQuestionView[] =>
  [...subQuestions]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((record) => buildSubQuestionView({ record }));

export const buildSubQuestionReports = (input: {
  subQuestions: readonly DeepResearchSubQuestionView[];
  timelineByPhaseAndSubQuestionId: Map<string, DeepResearchTimelineEntry>;
  answerByKindAndSubQuestionId: Map<string, ResearchAnswer>;
}): DeepResearchReportViewModel["subQuestionReports"] =>
  input.subQuestions.map((subQuestion) => {
    const analysisAnswer = input.answerByKindAndSubQuestionId.get(`analysis:${subQuestion.id}`);
    const analysisInteraction = input.timelineByPhaseAndSubQuestionId.get(`analysis:${subQuestion.id}`);
    return {
      subQuestion: {
        ...subQuestion,
        analysisStatus: analysisAnswer
          ? "persisted"
          : analysisInteraction
            ? "raw_response_only"
            : "missing",
        parseStatus: analysisInteraction?.parseStatus ?? null,
      },
      analysis: buildAnswerBlockView({ answer: analysisAnswer, interaction: analysisInteraction }),
    };
  });

export const buildReportExportViews = (
  exports: readonly ResearchExport[],
): DeepResearchExportView[] => exports.map((record) => ({
  exportKind: record.exportKind,
  label: formatExportLabel(record.exportKind),
  fileName: path.basename(record.filePath),
  filePath: record.filePath,
  fileHash: record.fileHash,
  payloadHash: record.payloadHash,
  createdAt: record.createdAt,
  fileSizeBytes: (() => {
    try {
      return statSync(record.filePath).size;
    } catch {
      return null;
    }
  })(),
}));

export const buildEvidenceViews = (input: {
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestionById: Map<string, DeepResearchSubQuestionView>;
}): DeepResearchEvidenceView[] => input.timeline.map((entry) => ({
  ...entry,
  headline: buildInteractionHeadline({ interaction: entry, subQuestionById: input.subQuestionById }),
  summary: entry.parsedSummary,
}));

export const buildReportJobView = (
  snapshot: DeepResearchTimelineSnapshot,
): DeepResearchReportViewModel["job"] => ({
  id: snapshot.job.id,
  title: truncateText(snapshot.job.userQuestion, 84),
  userQuestion: snapshot.job.userQuestion,
  analysisGoal: snapshot.job.analysisGoal,
  status: snapshot.job.status,
  phase: snapshot.job.phase,
  failureReason: snapshot.job.failureReason,
  reviewReason: snapshot.job.reviewReason,
  createdAt: snapshot.job.createdAt,
  updatedAt: snapshot.job.updatedAt,
  subQuestionCount: snapshot.overview.subQuestionCount,
  interactionCount: snapshot.overview.interactionCount,
  exportCount: snapshot.overview.exportCount,
});
