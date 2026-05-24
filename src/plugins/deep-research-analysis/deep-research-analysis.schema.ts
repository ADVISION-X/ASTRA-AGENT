import { z } from "zod";

const DeepResearchLanguageSchema = z.enum(["zh-CN", "en"]);

const DeepResearchOutputFormatSchema = z.enum(["markdown"]);

export const DeepResearchJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "deck_export_partial",
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
  "POSITIVE_SEND",
  "POSITIVE_CAPTURE",
  "POSITIVE_PARSE",
  "POSITIVE_PERSIST",
  "FALSIFY_SEND",
  "FALSIFY_CAPTURE",
  "FALSIFY_PARSE",
  "FALSIFY_PERSIST",
  "FINAL_PACKAGE_BUILD",
  "FINAL_ADJUDICATION_SEND",
  "FINAL_ADJUDICATION_CAPTURE",
  "FINAL_ADJUDICATION_PARSE",
  "FINAL_ADJUDICATION_PERSIST",
  "DECK_SEND",
  "DECK_CAPTURE",
  "DECK_PARSE",
  "DECK_PERSIST",
  "DECK_EXPORT",
  "FINAL_SEND",
  "FINAL_CAPTURE",
  "FINAL_PARSE",
  "FINAL_PERSIST",
  "EXPORT_REPORT",
  "COMPLETE",
]);

export const DeepResearchInteractionPhaseSchema = z.enum([
  "decomposition",
  "analysis",
  "positive",
  "falsification",
  "final_adjudication",
  "deck",
  "final_synthesis",
]);

export const DeepResearchParseStatusSchema = z.enum([
  "parsed",
  "parsed_with_trailing_noise",
  "partial_review_required",
  "failed",
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
