import { z } from "zod";

export const DeepResearchLanguageSchema = z.enum(["zh-CN", "en"]);

export const DeepResearchOutputFormatSchema = z.enum(["markdown"]);

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
  "POSITIVE_SEND",
  "POSITIVE_CAPTURE",
  "POSITIVE_PARSE",
  "POSITIVE_PERSIST",
  "FALSIFY_SEND",
  "FALSIFY_CAPTURE",
  "FALSIFY_PARSE",
  "FALSIFY_PERSIST",
  "FINAL_PACKAGE_BUILD",
  "FINAL_SEND",
  "FINAL_CAPTURE",
  "FINAL_PARSE",
  "FINAL_PERSIST",
  "EXPORT_REPORT",
  "COMPLETE",
]);

export const DeepResearchInteractionPhaseSchema = z.enum([
  "decomposition",
  "positive",
  "falsification",
  "final_synthesis",
]);

export const DeepResearchParseStatusSchema = z.enum([
  "parsed",
  "partial_review_required",
  "failed",
]);

export const DeepResearchSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  scope: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
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

export const DeepResearchSchemas = {
  DeepResearchInputSchema,
  DeepResearchJobStatusSchema,
  DeepResearchPhaseSchema,
  DeepResearchSubQuestionSchema,
  DeepResearchInteractionPhaseSchema,
  DeepResearchParseStatusSchema,
} as const;

export type DeepResearchContracts = {
  DeepResearchInput: DeepResearchInput;
  DeepResearchJobStatus: DeepResearchJobStatus;
  DeepResearchPhase: DeepResearchPhase;
  DeepResearchSubQuestion: DeepResearchSubQuestion;
  DeepResearchInteractionPhase: DeepResearchInteractionPhase;
  DeepResearchParseStatus: DeepResearchParseStatus;
};