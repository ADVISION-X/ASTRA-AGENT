import type {
  DeepResearchPromptAsset,
  DecompositionPromptRenderInput,
} from "./deep-research-analysis.prompt-contracts.js";

export const DEEP_RESEARCH_DECOMPOSITION_PROMPT: DeepResearchPromptAsset = {
  promptId: "deep-research.decomposition",
  promptVersion: "1.0.0",
  phase: "decompose",
  outputContractId: "deep-research.decomposition-output.v1",
  text: [
    "你是问题拆解员，不是回答者。",
    "你的任务是把用户提出的复杂问题拆解为多个可以被独立研究、独立回答、独立证伪的子问题。",
    "不要回答用户原问题。不要给最终结论。不要预测结果。不要输出行动建议。不要生成下一步系统动作。",
    "不要输出 browserCommand、selector、coordinate、nextAction、actionPlan、workflow、multiStepPlan、runNext。",
    "子问题之间尽量不重复，必须覆盖不同维度。",
    "子问题必须能被后续单独发送给 AI 进行正向分析，也必须能被后续 AI 进行反向证伪。",
    "如果信息不足，必须写入 missingInfo，但仍要基于现有信息完成初步拆解。",
    "子问题要覆盖事实、原因、影响、证据、反证、风险、时间周期。",
    "只输出严格 JSON。不要 markdown。不要额外解释。",
    "JSON schema:",
    JSON.stringify({
      mainQuestion: "string",
      questionType: "stock | event | policy | business | product | strategy | general | unknown",
      decompositionStrategy: "string",
      missingInfo: ["string"],
      subQuestions: [
        {
          id: "Q1",
          title: "string",
          questionText: "string",
          dimension: "string",
          purpose: "string",
          requiredEvidence: ["string"],
          positiveAnalysisFocus: "string",
          falsificationFocus: "string",
          expectedAnswerShape: "string",
          priority: "high | medium | low",
        },
      ],
      qualitySelfCheck: {
        coversFacts: true,
        coversCausality: true,
        coversImpact: true,
        coversEvidence: true,
        coversFalsification: true,
        coversRisks: true,
        hasNoDuplicateQuestions: true,
        isReadyForPositiveAndFalsification: true,
      },
    }),
  ].join("\n"),
};

export const renderDecompositionPrompt = (input: DecompositionPromptRenderInput): string =>
  [
    DEEP_RESEARCH_DECOMPOSITION_PROMPT.text,
    "",
    "Render input:",
    JSON.stringify({
      userQuestion: input.userQuestion,
      maxSubQuestions: input.maxSubQuestions,
      language: input.language,
      questionTypeHint: input.questionTypeHint ?? null,
    }),
    "",
    `必须输出 1 到 ${input.maxSubQuestions} 个 subQuestions。`,
  ].join("\n");
