import path from "node:path";

import { createDeepResearchRecordStore } from "./deep-research-analysis.records.js";
import type {
  ResearchAnswer,
  ResearchExport,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type {
  DeepResearchAnswerBlockView,
  DeepResearchConclusionView,
  DeepResearchEvidenceView,
  DeepResearchExportView,
  DeepResearchHistoryJobView,
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

const buildSubQuestionView = (record: ResearchSubQuestion): DeepResearchSubQuestionView => ({
  id: record.id,
  modelQuestionId: record.modelQuestionId,
  ordinal: record.ordinal,
  title: record.question.title,
  questionText: record.question.questionText,
  purpose: record.question.purpose,
  whyItMatters: record.question.whyItMatters ?? null,
  decisionWeight: record.question.decisionWeight ?? null,
  analysisFocus: record.question.analysisFocus ?? null,
  requiredEvidence: [...record.question.requiredEvidence],
  scope: record.question.scope,
  expectedAnswerShape: record.question.expectedAnswerShape,
  priority: record.question.priority ?? null,
  omissionRisk: record.question.omissionRisk ?? null,
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
    confidence: input.answer.confidence,
    keyPoints: [...input.answer.keyPoints],
    evidenceMentions: [...input.answer.evidenceMentions],
    assumptions: [...input.answer.assumptions],
    limitations: [...input.answer.limitations],
    contradictionPoints: [...input.answer.contradictionPoints],
    parsedPayload: input.answer.parsedPayload,
  };
};

const resolveStageStatus = (
  isCompleted: boolean,
  jobStatus: ResearchJob["status"],
): DeepResearchStageStatus => {
  if (isCompleted) {
    return "completed";
  }
  if (jobStatus === "failed") {
    return "failed";
  }
  if (jobStatus === "review_required") {
    return "review_required";
  }
  if (jobStatus === "running") {
    return "running";
  }
  return "pending";
};

const formatExportLabel = (exportKind: ResearchExport["exportKind"]): string => {
  if (exportKind === "final-report.md") {
    return "Final report";
  }
  if (exportKind === "research-bundle.json") {
    return "Research bundle";
  }
  return "Evidence index";
};

export const buildStageViews = (input: {
  job: ResearchJob;
  decompositionInteraction: DeepResearchTimelineEntry | null;
  subQuestionReports: DeepResearchReportViewModel["subQuestionReports"];
  finalInteraction: DeepResearchTimelineEntry | null;
  finalReport: DeepResearchFinalReport | null;
}): DeepResearchStageView[] => {
  const stages: DeepResearchStageView[] = [
    {
      id: "stage-decomposition",
      label: "Decomposition",
      anchorId: "decomposition",
      status: resolveStageStatus(Boolean(input.decompositionInteraction), input.job.status),
    },
  ];
  for (const report of input.subQuestionReports) {
    const questionLabel = `Q${report.subQuestion.ordinal + 1}: ${report.subQuestion.title}`;
    if (input.job.flowMode === "legacy_1_n_n_1") {
      stages.push(
        {
          id: `stage-${report.subQuestion.id}-positive`,
          label: `${questionLabel} Positive Analysis`,
          anchorId: `subquestion-${report.subQuestion.id}`,
          status: resolveStageStatus(Boolean(report.positive), input.job.status),
        },
        {
          id: `stage-${report.subQuestion.id}-falsification`,
          label: `${questionLabel} Falsification`,
          anchorId: `subquestion-${report.subQuestion.id}`,
          status: resolveStageStatus(Boolean(report.falsification), input.job.status),
        },
      );
    } else {
      stages.push({
        id: `stage-${report.subQuestion.id}-analysis`,
        label: `${questionLabel} Independent Analysis`,
        anchorId: `subquestion-${report.subQuestion.id}`,
        status: resolveStageStatus(Boolean(report.analysis), input.job.status),
      });
    }
  }
  stages.push({
    id: input.job.flowMode === "legacy_1_n_n_1"
      ? "stage-final-synthesis"
      : "stage-final-adjudication",
    label: input.job.flowMode === "legacy_1_n_n_1"
      ? "Final Synthesis"
      : "Final Adjudication",
    anchorId: input.job.flowMode === "legacy_1_n_n_1"
      ? "final-synthesis"
      : "final-adjudication",
    status: resolveStageStatus(Boolean(input.finalInteraction) || Boolean(input.finalReport), input.job.status),
  });
  return stages;
};

export const buildConclusionView = (
  report: DeepResearchFinalReport | null,
): DeepResearchConclusionView | null => {
  if (!report) {
    return null;
  }
  return {
    directAnswer: report.directAnswer,
    finalVerdict: report.finalVerdict,
    executiveConclusion: report.executiveConclusion,
    confidence: report.confidence,
    rankedConclusions: [...report.rankedConclusions],
    strongConclusions: [...report.strongConclusions],
    conditionalConclusions: [...report.conditionalConclusions],
    weakOrRejectedClaims: [...report.weakOrRejectedClaims],
    decisiveReasons: [...report.decisiveReasons],
    positiveReasons: [...report.positiveReasons],
    strongestOpposingArguments: [...report.strongestOpposingArguments],
    evidenceGaps: [...report.evidenceGaps],
    reverseConditions: [...report.reverseConditions],
    applicability: [...report.applicability],
    nonApplicability: [...report.nonApplicability],
    followUpSignals: [...report.followUpSignals],
    multiStageValueAdded: [...report.multiStageValueAdded],
    limitations: [...report.limitations],
  };
};

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
  if (input.interaction.phase === "final_synthesis") {
    return "Final Synthesis";
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
  return `${prefix} ${input.interaction.phase === "positive" ? "Positive Analysis" : "Falsification"}`;
};

export const buildHistoryJobView = (input: {
  store: ReturnType<typeof createDeepResearchRecordStore>;
  job: ResearchJob;
}): DeepResearchHistoryJobView => {
  const interactions = input.store.listInteractions(input.job.id);
  const subQuestions = input.store.listSubQuestions(input.job.id);
  const exports = input.store.listExports(input.job.id);
  const finalReport = input.store.getLatestFinalReport(input.job.id)?.report ?? null;
  return {
    id: input.job.id,
    title: truncateText(input.job.userQuestion, 84),
    userQuestion: input.job.userQuestion,
    questionSummary: truncateText(
      finalReport?.directAnswer ?? input.job.analysisGoal ?? input.job.userQuestion,
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
    finalConfidence: finalReport?.confidence ?? null,
    finalConclusionPreview: finalReport ? truncateText(finalReport.directAnswer, 220) : null,
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

export const buildConflictBySubQuestionId = (
  conflictMatrix: DeepResearchTimelineSnapshot["conflictMatrix"],
): Map<string, DeepResearchTimelineSnapshot["conflictMatrix"][number]> =>
  new Map(conflictMatrix.map((record) => [record.row.subQuestionId, record]));

export const buildReportSubQuestionViews = (
  subQuestions: readonly ResearchSubQuestion[],
): DeepResearchSubQuestionView[] =>
  [...subQuestions]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map(buildSubQuestionView);

export const buildSubQuestionReports = (input: {
  subQuestions: readonly DeepResearchSubQuestionView[];
  timelineByPhaseAndSubQuestionId: Map<string, DeepResearchTimelineEntry>;
  answerByKindAndSubQuestionId: Map<string, ResearchAnswer>;
  conflictBySubQuestionId: Map<string, DeepResearchTimelineSnapshot["conflictMatrix"][number]>;
}): DeepResearchReportViewModel["subQuestionReports"] =>
  input.subQuestions.map((subQuestion) => {
    const analysisAnswer = input.answerByKindAndSubQuestionId.get(`analysis:${subQuestion.id}`);
    const positiveAnswer = input.answerByKindAndSubQuestionId.get(`positive:${subQuestion.id}`);
    const falsificationAnswer = input.answerByKindAndSubQuestionId.get(`falsification:${subQuestion.id}`);
    const analysisInteraction = input.timelineByPhaseAndSubQuestionId.get(`analysis:${subQuestion.id}`);
    const positiveInteraction = input.timelineByPhaseAndSubQuestionId.get(`positive:${subQuestion.id}`);
    const falsificationInteraction = input.timelineByPhaseAndSubQuestionId.get(`falsification:${subQuestion.id}`);
    const conflict = input.conflictBySubQuestionId.get(subQuestion.id);
    return {
      subQuestion,
      analysis: buildAnswerBlockView({ answer: analysisAnswer, interaction: analysisInteraction }),
      positive: buildAnswerBlockView({ answer: positiveAnswer, interaction: positiveInteraction }),
      falsification: buildAnswerBlockView({ answer: falsificationAnswer, interaction: falsificationInteraction }),
      conflict: conflict
        ? {
          rowId: conflict.id,
          createdAt: conflict.createdAt,
          ...conflict.row,
        }
        : null,
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
  flowMode: snapshot.job.flowMode,
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
