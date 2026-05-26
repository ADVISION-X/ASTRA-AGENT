import { z } from "zod";
import { DeepResearchPromptBundleSchema } from "./deep-research-analysis.prompt-bundle-shell.js";

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
  const normalizedListKey = (values: readonly string[]): string =>
    values.map((value) => value.trim()).join("\n");
  const taskInstructions = new Set<string>();
  const questionSpecificFocusKeys = plan.subQuestions.map((subQuestion) =>
    normalizedListKey(subQuestion.promptBundle.questionSpecificFocus)
  );
  const evidenceOrReasoningNeedKeys = plan.subQuestions.map((subQuestion) =>
    normalizedListKey(subQuestion.promptBundle.evidenceOrReasoningNeeds)
  );
  const requiredContentKeys = plan.subQuestions.map((subQuestion) =>
    normalizedListKey(subQuestion.promptBundle.outputGuidance.requiredContent)
  );
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
  if (plan.subQuestions.length > 1 && new Set(questionSpecificFocusKeys).size === 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subQuestions"],
      message: "questionSpecificFocus must not be identical across every sub-question promptBundle.",
    });
  }
  if (plan.subQuestions.length > 1 && new Set(evidenceOrReasoningNeedKeys).size === 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subQuestions"],
      message: "evidenceOrReasoningNeeds must not be identical across every sub-question promptBundle.",
    });
  }
  if (plan.subQuestions.length > 1 && new Set(requiredContentKeys).size === 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subQuestions"],
      message: "requiredContent must not be identical across every sub-question promptBundle.",
    });
  }
});

export type DeepResearchPlan = z.infer<typeof DeepResearchPlanSchema>;

const DeepResearchLanguageSchema = z.enum(["zh-CN", "en"]);

const DeepResearchOutputFormatSchema = z.enum(["markdown"]);

export const DeepResearchJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "review_required",
  "failed",
]);

export const DeepResearchPhaseSchema = z.enum([
  "INTAKE",
  "DECOMPOSE_SEND",
  "DECOMPOSE_CAPTURE",
  "DECOMPOSE_PARSE",
  "DECOMPOSE_PERSIST",
  "ANALYSIS_SEND",
  "ANALYSIS_CAPTURE",
  "ANALYSIS_PARSE",
  "ANALYSIS_PERSIST",
  "FULL_CASE_FILE_BUILD",
  "FINAL_ADJUDICATION_SEND",
  "FINAL_ADJUDICATION_CAPTURE",
  "FINAL_ADJUDICATION_PARSE",
  "FINAL_ADJUDICATION_PERSIST",
  "HTML_REPORT_SEND",
  "HTML_REPORT_CAPTURE",
  "HTML_REPORT_DETECT",
  "HTML_REPORT_PERSIST",
  "EXPORT_REPORT",
  "COMPLETE",
]);

export const DeepResearchInteractionPhaseSchema = z.enum([
  "decomposition",
  "analysis",
  "final_adjudication",
  "html_report",
]);

export const DeepResearchParseStatusSchema = z.enum([
  "parsed",
  "parsed_with_trailing_noise",
  "parsed_json",
  "parsed_json_from_fence",
  "parsed_json_from_balanced_object",
  "parsed_text_raw_index",
  "raw_structured_text",
  "parsed_json_index",
  "parse_failed_raw_available",
  "partial_review_required",
  "failed",
  "failed_empty",
  "failed_unusable",
]);

export const DeepResearchSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  whyItMatters: z.string().trim().min(1).optional(),
  decisionWeight: z.enum(["decisive", "high", "medium", "low"]).optional(),
  analysisFocus: z.string().trim().min(1).optional(),
  requiredEvidence: z.array(z.string().trim().min(1)).default([]),
  scope: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  priority: z.enum(["low", "medium", "high"]).optional(),
  omissionRisk: z.string().trim().min(1).optional(),
  promptBundle: DeepResearchPromptBundleSchema.extend({
    promptRole: z.literal("sub_question_analysis"),
  }),
}).strict();

export const DeepResearchInputSchema = z.object({
  userQuestion: z.string().trim().min(1),
  analysisGoal: z.string().trim().min(1).nullable().default(null),
  language: DeepResearchLanguageSchema.default("zh-CN"),
  maxSubQuestions: z.number().int().min(2).max(12).default(4),
  outputFormat: DeepResearchOutputFormatSchema.default("markdown"),
}).strict();

export type DeepResearchInput = z.infer<typeof DeepResearchInputSchema>;
export type DeepResearchJobStatus = z.infer<typeof DeepResearchJobStatusSchema>;
export type DeepResearchPhase = z.infer<typeof DeepResearchPhaseSchema>;
export type DeepResearchSubQuestion = z.infer<typeof DeepResearchSubQuestionSchema>;
export type DeepResearchInteractionPhase = z.infer<typeof DeepResearchInteractionPhaseSchema>;
export type DeepResearchParseStatus = z.infer<typeof DeepResearchParseStatusSchema>;
export const DeepResearchDecompositionResponseSchema = DeepResearchPlanSchema;
export type DeepResearchDecompositionResponse = DeepResearchPlan;
