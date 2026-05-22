import { z } from "zod";

export const DecompositionQuestionTypeSchema = z.enum([
  "stock",
  "event",
  "policy",
  "business",
  "product",
  "strategy",
  "general",
  "unknown",
]);

export const DecompositionSubQuestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  questionText: z.string().trim().min(1),
  dimension: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  requiredEvidence: z.array(z.string().trim().min(1)).min(1),
  positiveAnalysisFocus: z.string().trim().min(1),
  falsificationFocus: z.string().trim().min(1),
  expectedAnswerShape: z.string().trim().min(1),
  priority: z.enum(["high", "medium", "low"]),
}).strict();

export const DecompositionQualitySelfCheckSchema = z.object({
  coversFacts: z.literal(true),
  coversCausality: z.literal(true),
  coversImpact: z.literal(true),
  coversEvidence: z.literal(true),
  coversFalsification: z.literal(true),
  coversRisks: z.literal(true),
  hasNoDuplicateQuestions: z.literal(true),
  isReadyForPositiveAndFalsification: z.literal(true),
}).strict();

export const createDecompositionOutputSchema = (maxSubQuestions: number) =>
  z.object({
    mainQuestion: z.string().trim().min(1),
    questionType: DecompositionQuestionTypeSchema,
    decompositionStrategy: z.string().trim().min(1),
    missingInfo: z.array(z.string().trim().min(1)),
    subQuestions: z.array(DecompositionSubQuestionSchema).min(1).max(maxSubQuestions),
    qualitySelfCheck: DecompositionQualitySelfCheckSchema,
  }).strict();

export type ParsedDecompositionOutput = z.infer<ReturnType<typeof createDecompositionOutputSchema>>;
