import { z } from "zod";

import { DeepResearchPromptBundleSchema } from "./deep-research-analysis.prompt-bundle-schema.js";

const DeepResearchQuestionTypeSchema = z.enum([
  "stock",
  "event",
  "policy",
  "business",
  "product",
  "strategy",
  "finance",
  "crypto",
  "macro",
  "general",
  "unknown",
]);

const DeepResearchDecisionWeightSchema = z.enum([
  "decisive",
  "high",
  "medium",
  "low",
]);

export const DeepResearchPlannedSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  whyItMatters: z.string().trim().min(1),
  decisionWeight: DeepResearchDecisionWeightSchema,
  scope: z.string().trim().min(1),
  omissionRisk: z.string().trim().min(1),
  promptBundle: DeepResearchPromptBundleSchema.extend({
    promptRole: z.literal("sub_question_analysis"),
  }),
}).strict();

export const DeepResearchPlanIntegrityCheckSchema = z.object({
  everySubQuestionHasPromptBundle: z.literal(true),
  promptBundlesAreQuestionSpecific: z.literal(true),
  noGenericUniversalPromptBundle: z.literal(true),
  finalPromptBundleIsQuestionSpecific: z.literal(true),
  htmlPromptBundleIsQuestionSpecific: z.literal(true),
  runtimeWillOnlyAddShellConstraints: z.literal(true),
}).strict();

export const DeepResearchPlanSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  questionType: DeepResearchQuestionTypeSchema,
  decompositionStrategy: z.string().trim().min(1),
  missingInfo: z.array(z.string().trim().min(1)).default([]),
  subQuestions: z.array(DeepResearchPlannedSubQuestionSchema).min(1),
  finalAdjudicationPromptBundle: DeepResearchPromptBundleSchema.extend({
    promptRole: z.literal("final_adjudication"),
  }),
  htmlReportPromptBundle: DeepResearchPromptBundleSchema.extend({
    promptRole: z.literal("html_report_publisher"),
  }),
  planIntegrityCheck: DeepResearchPlanIntegrityCheckSchema,
}).strict().superRefine((plan, context) => {
  const taskInstructions = new Set<string>();
  for (const [index, subQuestion] of plan.subQuestions.entries()) {
    const taskInstruction = subQuestion.promptBundle.taskInstruction.trim();
    if (taskInstructions.has(taskInstruction)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subQuestions", index, "promptBundle", "taskInstruction"],
        message: "Each sub-question promptBundle taskInstruction must be distinct.",
      });
    }
    taskInstructions.add(taskInstruction);
  }
});

export type DeepResearchPlannedSubQuestion = z.infer<typeof DeepResearchPlannedSubQuestionSchema>;
export type DeepResearchPlan = z.infer<typeof DeepResearchPlanSchema>;
