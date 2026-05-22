import { buildDeepResearchPromptHash } from "./deep-research-analysis.prompt-hash.js";

export const DEEP_RESEARCH_DECOMPOSITION_PROMPT = {
  promptId: "deep-research.decomposition",
  promptVersion: "1.0.0",
  phase: "decompose",
  outputContractId: "deep-research.decomposition-output.v1",
  text: [
    "You are an external researcher. Return one JSON object only.",
    "Decompose the user question into bounded sub-questions for positive analysis and falsification.",
    "Each sub-question must include id, title, questionText, dimension, purpose, requiredEvidence, positiveAnalysisFocus, falsificationFocus, expectedAnswerShape, and priority.",
    "The response must include qualitySelfCheck for facts, causality, impact, evidence, falsification, risks, duplicate questions, and readiness.",
    "Do not output nextAction, actionPlan, browserCommand, selector, coordinate, workflow, multiStepPlan, runNext, databaseCommand, or filePath.",
  ].join("\n"),
} as const;

export const renderDecompositionPrompt = (input: {
  userQuestion: string;
  maxSubQuestions: number;
  language: "zh-CN" | "en";
  questionTypeHint?: string | null;
}): string => [
    DEEP_RESEARCH_DECOMPOSITION_PROMPT.text,
    `User question: ${input.userQuestion}`,
    `Maximum sub-questions: ${input.maxSubQuestions}`,
    `Language: ${input.language}`,
    `Question type hint: ${input.questionTypeHint ?? "general"}`,
    "Return the JSON object now.",
  ].join("\n");

export const buildRenderedDeepResearchPromptHash = (promptText: string): string =>
  buildDeepResearchPromptHash({
    outputContractId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.outputContractId,
    phase: DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase,
    promptId: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptId,
    promptText,
    promptVersion: DEEP_RESEARCH_DECOMPOSITION_PROMPT.promptVersion,
  });
