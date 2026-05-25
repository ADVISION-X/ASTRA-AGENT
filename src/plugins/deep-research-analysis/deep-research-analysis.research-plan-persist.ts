import type { DeepResearchPlan } from "./deep-research-analysis.research-plan-schema.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import type { ResearchSubQuestion } from "./deep-research-analysis.records.js";

export const buildDeepResearchPromptBundleExport = (input: {
  researchPlan: DeepResearchPlan;
  subQuestions: readonly ResearchSubQuestion[];
}): {
  subQuestionPromptBundles: { subQuestionId: string; modelQuestionId: string; promptBundle: DeepResearchPromptBundle }[];
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
  htmlReportPromptBundle: DeepResearchPromptBundle;
} => ({
  subQuestionPromptBundles: input.subQuestions.map((subQuestion) => {
    const promptBundle = subQuestion.question.promptBundle;
    if (!promptBundle) {
      throw new Error(`Missing promptBundle for sub-question ${subQuestion.id}.`);
    }
    return {
      subQuestionId: subQuestion.id,
      modelQuestionId: subQuestion.modelQuestionId,
      promptBundle,
    };
  }),
  finalAdjudicationPromptBundle: input.researchPlan.finalAdjudicationPromptBundle,
  htmlReportPromptBundle: input.researchPlan.htmlReportPromptBundle,
});
