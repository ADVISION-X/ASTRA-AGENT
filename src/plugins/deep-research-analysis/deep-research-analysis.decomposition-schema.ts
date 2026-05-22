import { z } from "zod";

export const DeepResearchDecompositionDimensionSchema = z.enum([
  "facts",
  "causality",
  "impact",
  "evidence",
  "risk",
  "market",
  "valuation",
  "operations",
  "falsification",
]);

export const DeepResearchDecompositionPrioritySchema = z.enum(["low", "medium", "high"]);

export const DeepResearchDecompositionSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  dimension: DeepResearchDecompositionDimensionSchema,
  purpose: z.string().trim().min(1),
  requiredEvidence: z.array(z.string().trim().min(1)).min(1),
  positiveAnalysisFocus: z.string().trim().min(1),
  falsificationFocus: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  priority: DeepResearchDecompositionPrioritySchema,
}).strict();

export const DeepResearchDecompositionQualitySelfCheckSchema = z.object({
  coversFacts: z.boolean(),
  coversCausality: z.boolean(),
  coversImpact: z.boolean(),
  coversEvidence: z.boolean(),
  coversFalsification: z.boolean(),
  coversRisks: z.boolean(),
  hasNoDuplicateQuestions: z.boolean(),
  isReadyForPositiveAndFalsification: z.boolean(),
}).strict();

export const DeepResearchDecompositionResponseSchema = z.object({
  mainQuestion: z.string().trim().min(1),
  questionType: z.string().trim().min(1),
  decompositionStrategy: z.string().trim().min(1),
  missingInfo: z.array(z.string().trim().min(1)).default([]),
  subQuestions: z.array(DeepResearchDecompositionSubQuestionSchema).min(1),
  qualitySelfCheck: DeepResearchDecompositionQualitySelfCheckSchema,
}).strict();

export type DeepResearchDecompositionResponse = z.infer<typeof DeepResearchDecompositionResponseSchema>;
export type DeepResearchDecompositionSubQuestion = z.infer<typeof DeepResearchDecompositionSubQuestionSchema>;
