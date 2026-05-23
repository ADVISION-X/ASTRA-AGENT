import type {
  DeepResearchConflictMatrixRow,
} from "./deep-research-analysis.result.js";
import type {
  DeepResearchRecordStore,
  ResearchAnswer,
  ResearchConflictMatrix,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";

type ConflictMatrixBuildResult =
  | {
      status: "completed";
      rows: ResearchConflictMatrix[];
    }
  | {
      status: "review_required";
      rows: [];
      reason: string;
    };

const summarizePositiveClaim = (answer: ResearchAnswer): string =>
  answer.keyPoints[0] ?? answer.answerText;

const summarizeFalsification = (answer: ResearchAnswer): string =>
  answer.contradictionPoints[0] ?? answer.answerText;

const buildEvidenceGap = (positive: ResearchAnswer, falsification: ResearchAnswer): string => {
  const positiveGaps = positive.limitations;
  const falsificationGaps = falsification.limitations;
  const allGaps = [...positiveGaps, ...falsificationGaps];
  return allGaps.length > 0 ? allGaps.join(" | ") : "no_explicit_gap_reported";
};

const buildConflictLevel = (positive: ResearchAnswer, falsification: ResearchAnswer): DeepResearchConflictMatrixRow["conflictLevel"] => {
  if (falsification.confidence === "high" && falsification.contradictionPoints.length >= positive.keyPoints.length) {
    return "critical";
  }
  if (falsification.confidence === "high" || falsification.contradictionPoints.length >= 2) {
    return "high";
  }
  if (falsification.confidence === "medium" || positive.confidence === "low") {
    return "medium";
  }
  return "low";
};

const buildRow = (input: {
  subQuestion: ResearchSubQuestion;
  positive: ResearchAnswer;
  falsification: ResearchAnswer;
}): DeepResearchConflictMatrixRow => {
  const conflictLevel = buildConflictLevel(input.positive, input.falsification);
  return {
    subQuestionId: input.subQuestion.id,
    positiveClaimSummary: summarizePositiveClaim(input.positive),
    falsificationSummary: summarizeFalsification(input.falsification),
    conflictLevel,
    evidenceGap: buildEvidenceGap(input.positive, input.falsification),
    needsHumanReview:
      conflictLevel === "critical"
      || input.positive.limitations.length > 0
      || input.falsification.limitations.length > 0,
  };
};

const buildAnswerMap = (answers: readonly ResearchAnswer[]): Map<string, ResearchAnswer> =>
  new Map(answers.map((answer) => [answer.subQuestionId, answer]));

export const buildDeepResearchConflictMatrix = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
}): ConflictMatrixBuildResult => {
  const subQuestions = input.store.listSubQuestions(input.jobId);
  if (subQuestions.length === 0) {
    return {
      status: "review_required",
      rows: [],
      reason: "no_persisted_sub_questions",
    };
  }

  const positiveBySubQuestion = buildAnswerMap(
    input.store.listAnswers({ jobId: input.jobId, answerKind: "positive" }),
  );
  const falsificationBySubQuestion = buildAnswerMap(
    input.store.listAnswers({ jobId: input.jobId, answerKind: "falsification" }),
  );

  const missingSubQuestions: string[] = [];
  const rows: DeepResearchConflictMatrixRow[] = [];

  subQuestions.forEach((subQuestion) => {
    const positive = positiveBySubQuestion.get(subQuestion.id);
    const falsification = falsificationBySubQuestion.get(subQuestion.id);
    if (!positive || !falsification) {
      missingSubQuestions.push(subQuestion.id);
      return;
    }
    rows.push(buildRow({ subQuestion, positive, falsification }));
  });

  if (rows.length === 0) {
    return {
      status: "review_required",
      rows: [],
      reason: "no_complete_positive_falsification_pairs",
    };
  }

  return {
    status: "completed",
    rows: input.store.saveConflictMatrixRows({
      jobId: input.jobId,
      rows,
    }),
  };
};