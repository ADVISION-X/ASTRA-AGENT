import { z } from "zod";

import { DeepResearchInteractionPhaseSchema } from "./deep-research-analysis.schema.js";

export type DeepResearchPromptPhase = "decompose" | "positive" | "falsify" | "final";

export type DeepResearchPromptAsset = {
  promptId: string;
  promptVersion: string;
  phase: DeepResearchPromptPhase;
  outputContractId: string;
  text: string;
};

export type DecompositionPromptRenderInput = {
  userQuestion: string;
  maxSubQuestions: number;
  language: "zh-CN" | "en";
  questionTypeHint?: string | null;
};

export type DecompositionSubQuestion = {
  id: string;
  title: string;
  questionText: string;
  dimension: string;
  purpose: string;
  requiredEvidence: string[];
  positiveAnalysisFocus: string;
  falsificationFocus: string;
  expectedAnswerShape: string;
  priority: "high" | "medium" | "low";
};

export type DecompositionOutput = {
  mainQuestion: string;
  questionType: "stock" | "event" | "policy" | "business" | "product" | "strategy" | "general" | "unknown";
  decompositionStrategy: string;
  missingInfo: string[];
  subQuestions: DecompositionSubQuestion[];
  qualitySelfCheck: {
    coversFacts: boolean;
    coversCausality: boolean;
    coversImpact: boolean;
    coversEvidence: boolean;
    coversFalsification: boolean;
    coversRisks: boolean;
    hasNoDuplicateQuestions: boolean;
    isReadyForPositiveAndFalsification: boolean;
  };
};

export type DecompositionPromptQualityStatus = "passed" | "review_required";

export type DecompositionPromptQualityScore = {
  status: DecompositionPromptQualityStatus;
  score: number;
  maxScore: 18;
  passScore: 14;
  dimensions: {
    coversFacts: 0 | 1 | 2;
    coversCausality: 0 | 1 | 2;
    coversImpact: 0 | 1 | 2;
    coversEvidence: 0 | 1 | 2;
    coversFalsification: 0 | 1 | 2;
    coversRisks: 0 | 1 | 2;
    noDuplicateQuestions: 0 | 1 | 2;
    independentAnswerability: 0 | 1 | 2;
    falsifiability: 0 | 1 | 2;
  };
};

export const DeepResearchPromptIdSchema = z.enum([
  "deep-research.decomposition",
  "deep-research.positive-analysis",
  "deep-research.falsification",
  "deep-research.final-synthesis",
]);

export const DeepResearchPromptVersionSchema = z
  .string()
  .regex(/^v\d+\.\d+\.\d+$/u, "promptVersion must use semver-like vX.Y.Z format.");

export const DeepResearchPromptOutputContractSchema = z.object({
  contractId: z.string().trim().min(1),
  format: z.literal("json_object"),
  requiredFields: z.array(z.string().trim().min(1)).min(1),
  forbiddenFields: z.array(z.string().trim().min(1)).min(1),
}).strict();

export const DeepResearchPromptSchema = z.object({
  promptId: DeepResearchPromptIdSchema,
  promptVersion: DeepResearchPromptVersionSchema,
  phase: DeepResearchInteractionPhaseSchema,
  promptText: z.string().trim().min(1),
  expectedOutputContract: DeepResearchPromptOutputContractSchema,
}).strict();

export type DeepResearchPromptId = z.infer<typeof DeepResearchPromptIdSchema>;
export type DeepResearchPromptVersion = z.infer<typeof DeepResearchPromptVersionSchema>;
export type DeepResearchPromptOutputContract = z.infer<typeof DeepResearchPromptOutputContractSchema>;
export type DeepResearchPrompt = z.infer<typeof DeepResearchPromptSchema>;

export const DeepResearchPromptSchemas = {
  DeepResearchPromptIdSchema,
  DeepResearchPromptVersionSchema,
  DeepResearchPromptOutputContractSchema,
  DeepResearchPromptSchema,
} as const;
