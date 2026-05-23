import {
  type DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import {
  buildRenderedDeepResearchPromptHash,
  decompositionPrompt,
  falsificationPrompt,
  finalSynthesisPrompt,
  positiveAnalysisPrompt,
  renderDeepResearchDecompositionPrompt,
  renderDeepResearchFalsificationPrompt,
  renderDeepResearchFinalSynthesisPrompt,
  renderDeepResearchPositivePrompt,
} from "./deep-research-analysis.prompts.js";
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

type VerifiedPrompt = {
  prompt: typeof decompositionPrompt | typeof positiveAnalysisPrompt | typeof falsificationPrompt | typeof finalSynthesisPrompt;
  promptText: string;
};

const renderDecompositionVerifiedPrompt = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
}): VerifiedPrompt | null => input.interaction.phase === "decomposition"
  ? {
    prompt: decompositionPrompt,
    promptText: renderDeepResearchDecompositionPrompt({
      userQuestion: input.job.userQuestion,
      analysisGoal: input.job.analysisGoal,
      language: input.job.language,
      maxSubQuestions: input.job.maxSubQuestions,
    }),
  }
  : null;

const renderPositiveVerifiedPrompt = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
  subQuestionById: Map<string, ResearchSubQuestion>;
}): VerifiedPrompt | null => {
  const subQuestion = input.interaction.subQuestionId
    ? input.subQuestionById.get(input.interaction.subQuestionId)
    : null;
  return subQuestion
    ? {
      prompt: positiveAnalysisPrompt,
      promptText: renderDeepResearchPositivePrompt({
        userQuestion: input.job.userQuestion,
        analysisGoal: input.job.analysisGoal,
        language: input.job.language,
        subQuestion: subQuestion.question,
      }),
    }
    : null;
};

const renderFalsificationVerifiedPrompt = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
  subQuestionById: Map<string, ResearchSubQuestion>;
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
}): VerifiedPrompt | null => {
  const subQuestion = input.interaction.subQuestionId
    ? input.subQuestionById.get(input.interaction.subQuestionId)
    : null;
  const positiveAnswer = input.interaction.subQuestionId
    ? input.positiveAnswerBySubQuestionId.get(input.interaction.subQuestionId)
    : null;
  return subQuestion && positiveAnswer
    ? {
      prompt: falsificationPrompt,
      promptText: renderDeepResearchFalsificationPrompt({
        userQuestion: input.job.userQuestion,
        analysisGoal: input.job.analysisGoal,
        language: input.job.language,
        subQuestion: subQuestion.question,
        positiveAnswer: {
          answer: positiveAnswer.answerText,
          keyClaims: positiveAnswer.keyPoints,
          evidenceMentions: positiveAnswer.evidenceMentions,
          assumptions: positiveAnswer.assumptions,
          confidence: positiveAnswer.confidence,
          limitations: positiveAnswer.limitations,
        },
      }),
    }
    : null;
};

const renderFinalSynthesisVerifiedPrompt = (input: {
  finalPackage: DeepResearchFinalPackage | null;
  interaction: ResearchInteraction;
  job: ResearchJob;
}): VerifiedPrompt | null => input.interaction.phase === "final_synthesis" && input.finalPackage
  ? {
    prompt: finalSynthesisPrompt,
    promptText: renderDeepResearchFinalSynthesisPrompt({
      userQuestion: input.job.userQuestion,
      analysisGoal: input.job.analysisGoal,
      language: input.job.language,
      finalPackage: input.finalPackage,
    }),
  }
  : null;

const renderVerifiedPrompt = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
  subQuestionById: Map<string, ResearchSubQuestion>;
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  finalPackage: DeepResearchFinalPackage | null;
}): VerifiedPrompt | null => {
  switch (input.interaction.phase) {
    case "decomposition":
      return renderDecompositionVerifiedPrompt(input);
    case "positive":
      return renderPositiveVerifiedPrompt(input);
    case "falsification":
      return renderFalsificationVerifiedPrompt(input);
    case "final_synthesis":
      return renderFinalSynthesisVerifiedPrompt(input);
    default:
      return null;
  }
};

export const buildPromptText = (input: {
  interaction: ResearchInteraction;
  job: ResearchJob;
  subQuestionById: Map<string, ResearchSubQuestion>;
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  finalPackage: DeepResearchFinalPackage | null;
}): {
  promptText: string | null;
  promptReconstructionStatus: PromptReconstructionStatus;
} => {
  if (input.interaction.renderedPromptText.trim().length > 0) {
    return {
      promptText: input.interaction.renderedPromptText,
      promptReconstructionStatus: "verified",
    };
  }

  const reconstructed = renderVerifiedPrompt(input);
  if (!reconstructed) {
    return {
      promptText: null,
      promptReconstructionStatus: "unavailable",
    };
  }

  const expectedHash = buildRenderedDeepResearchPromptHash({
    prompt: reconstructed.prompt,
    renderedPromptText: reconstructed.promptText,
  });
  if (expectedHash !== input.interaction.promptHash) {
    return {
      promptText: reconstructed.promptText,
      promptReconstructionStatus: "hash_mismatch",
    };
  }

  return {
    promptText: reconstructed.promptText,
    promptReconstructionStatus: "verified",
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
  if (input.interaction.phase === "positive" || input.interaction.phase === "falsification") {
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
    parsedSummary: truncateText(input.finalReportRecord.report.executiveConclusion),
    parsedJson: input.finalReportRecord.report,
    parsedRecordIds: [input.finalReportRecord.id],
  };
};