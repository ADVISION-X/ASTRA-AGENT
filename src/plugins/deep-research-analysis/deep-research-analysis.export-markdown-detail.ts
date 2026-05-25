import {
  isDeepResearchParserSuccess,
  parseDeepResearchSubQuestionAnalysisResponse,
  type DeepResearchSubQuestionAnalysisAnswer,
} from "./deep-research-analysis.parser.js";
import {
  type ResearchAnswer,
  type ResearchInteraction,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import {
  buildInteractionPhaseLabel,
  buildMarkdownList,
  escapeTableCell,
  toDisplayValue,
  type InteractionEvidence,
} from "./deep-research-analysis.export-markdown-core.js";

const reparseAnalysisInteraction = (
  interaction: ResearchInteraction | null,
): DeepResearchSubQuestionAnalysisAnswer | null => {
  if (!interaction) {
    return null;
  }
  const parsed = parseDeepResearchSubQuestionAnalysisResponse({
    rawText: interaction.rawResponseText,
    ...(interaction.subQuestionId ? { subQuestionId: interaction.subQuestionId } : {}),
  });
  return isDeepResearchParserSuccess(parsed) ? parsed.parsed : null;
};

const buildStageStatus = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
  stageName: string;
}): string => {
  if (!input.interaction) {
    return [
      "Status: missing",
      `Reason: Persisted ${input.stageName.toLowerCase()} interaction is missing.`,
    ].join("\n");
  }
  if (!input.answer) {
    const stageStatus = input.interaction.parseStatus === "parsed"
      || input.interaction.parseStatus === "parsed_with_trailing_noise"
      || input.interaction.parseStatus === "parsed_json"
      || input.interaction.parseStatus === "parsed_json_from_fence"
      || input.interaction.parseStatus === "parsed_json_from_balanced_object"
      || input.interaction.parseStatus === "parsed_text_raw_index"
      ? "missing"
      : input.interaction.parseStatus;
    return [
      `Status: ${stageStatus}`,
      `Reason: Persisted ${input.stageName.toLowerCase()} answer record is unavailable.`,
    ].join("\n");
  }
  return "Status: available";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const takeFirstDefined = <T>(...values: readonly (T | null | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined && value !== null);

const takeFirstDefinedList = (
  ...values: ReadonlyArray<readonly string[] | null | undefined>
): string[] => [...(takeFirstDefined(...values) ?? [])];

type AnalysisParsedSectionData = {
  summary: string;
  confidence: string;
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  contradictionPoints: string[];
  limitations: string[];
  structuredPayload: Record<string, unknown>;
};

const buildAnalysisParsedSectionData = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
}): AnalysisParsedSectionData => {
  const reparsed = reparseAnalysisInteraction(input.interaction);
  const payload = input.answer?.parsedPayload ?? {};
  return {
    summary: takeFirstDefined(input.answer?.answerText, reparsed?.summary, "Analysis answer: MISSING")
      ?? "Analysis answer: MISSING",
    confidence: takeFirstDefined(input.answer?.confidence, reparsed?.confidence, "unavailable")
      ?? "unavailable",
    keyPoints: takeFirstDefinedList(input.answer?.keyPoints, reparsed?.keyPoints),
    evidenceMentions: takeFirstDefinedList(input.answer?.evidenceMentions, reparsed?.evidenceMentions),
    assumptions: takeFirstDefinedList(input.answer?.assumptions, reparsed?.assumptions),
    contradictionPoints: takeFirstDefinedList(input.answer?.contradictionPoints, reparsed?.contradictionPoints),
    limitations: takeFirstDefinedList(input.answer?.limitations, reparsed?.limitations),
    structuredPayload: isRecord(payload)
      ? payload
      : reparsed?.structuredPayload ?? {},
  };
};

export const buildAnalysisParsedSection = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
}): string => {
  const data = buildAnalysisParsedSectionData(input);
  return [
    buildStageStatus({
      interaction: input.interaction,
      answer: input.answer,
      stageName: "Independent Analysis",
    }),
    `Summary: ${data.summary}`,
    `Confidence: ${data.confidence}`,
    "Key Points",
    buildMarkdownList(data.keyPoints, "- unavailable"),
    "Contradiction Points",
    buildMarkdownList(data.contradictionPoints, "- none"),
    "Evidence Mentions",
    buildMarkdownList(data.evidenceMentions, "- unavailable"),
    "Assumptions",
    buildMarkdownList(data.assumptions, "- none"),
    "Limitations",
    buildMarkdownList(data.limitations, "- unavailable"),
    "Structured Payload",
    `\`\`\`json\n${JSON.stringify(data.structuredPayload, null, 2)}\n\`\`\``,
  ].join("\n\n");
};

export const buildEvidenceIndexTable = (
  evidence: readonly InteractionEvidence[],
  subQuestionById: ReadonlyMap<string, ResearchSubQuestion>,
): string => {
  const header = [
    "| Interaction ID | Phase | SubQuestion ID | Prompt Hash | Raw Response Hash | DOM Ref |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  const body = evidence.map((entry) => {
    const subQuestion = entry.subQuestionId
      ? subQuestionById.get(entry.subQuestionId)
      : null;
    return [
      escapeTableCell(entry.interactionId),
      escapeTableCell(buildInteractionPhaseLabel(entry.phase)),
      escapeTableCell(subQuestion ? subQuestion.modelQuestionId : toDisplayValue(entry.subQuestionId, "-")),
      escapeTableCell(entry.promptHash),
      escapeTableCell(entry.rawResponseHash),
      escapeTableCell(toDisplayValue(entry.domRef)),
    ];
  }).map((cells) => `| ${cells.join(" | ")} |`);
  return [...header, ...body].join("\n");
};

export const buildInteractionEvidence = (
  interactions: readonly ResearchInteraction[],
): InteractionEvidence[] => interactions.map((interaction) => ({
  interactionId: interaction.id,
  phase: interaction.phase,
  subQuestionId: interaction.subQuestionId,
  promptHash: interaction.promptHash,
  rawResponseHash: interaction.rawResponseHash,
  domRef: interaction.domRef,
}));
