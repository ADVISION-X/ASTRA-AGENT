import {
  type DeepResearchStructuredIndex,
} from "./deep-research-analysis.final-package.js";
import type {
  ResearchAnswer,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type {
  DeepResearchTimelineEntry,
  PromptReconstructionStatus,
} from "./deep-research-analysis.public-contracts.js";

const truncateText = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
};

export const buildPromptText = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
  subQuestionById: Map<string, ResearchSubQuestion>;
  finalPackage: DeepResearchStructuredIndex | null;
}): {
  promptText: string | null;
  promptReconstructionStatus: PromptReconstructionStatus;
} => {
  void input.job;
  void input.subQuestionById;
  void input.finalPackage;
  if (input.interaction.renderedPromptText.trim().length > 0) {
    return {
      promptText: input.interaction.renderedPromptText,
      promptReconstructionStatus: "verified",
    };
  }

  return {
    promptText: null,
    promptReconstructionStatus: "unavailable",
  };
};

export const buildParsedEntry = (input: {
  interaction: ResearchInteraction;
  subQuestions: readonly ResearchSubQuestion[];
  answersByInteractionId: Map<string, ResearchAnswer>;
  finalReportRecord: { id: string; report: DeepResearchFinalReport } | null;
}): Pick<DeepResearchTimelineEntry, "parsedSummary" | "parsedJson" | "parsedRecordIds"> => {
  if (input.interaction.phase === "decomposition") {
    const records = input.subQuestions.filter((record) => record.interactionId === input.interaction.id);
    if (!records.length) {
      return {
        parsedSummary: "No sub-questions were parsed.",
        parsedJson: null,
        parsedRecordIds: [],
      };
    }
    return {
      parsedSummary: truncateText(records.map((record) => record.question.title).join("; ")),
      parsedJson: records.map((record) => record.question),
      parsedRecordIds: records.map((record) => record.id),
    };
  }
  if (
    input.interaction.phase === "analysis"
  ) {
    const answer = input.answersByInteractionId.get(input.interaction.id);
    if (!answer) {
      return {
        parsedSummary: "Answer unavailable.",
        parsedJson: null,
        parsedRecordIds: [],
      };
    }
    return {
      parsedSummary: truncateText(answer.answerText),
      parsedJson: answer,
      parsedRecordIds: [answer.id],
    };
  }
  if (!input.finalReportRecord) {
    return {
      parsedSummary: "Final report unavailable.",
      parsedJson: null,
      parsedRecordIds: [],
    };
  }
  return {
    parsedSummary: truncateText(input.finalReportRecord.report.directAnswer),
    parsedJson: input.finalReportRecord.report,
    parsedRecordIds: [input.finalReportRecord.id],
  };
};
