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

const readPayloadString = (payload: Record<string, unknown>, key: string): string[] => {
  const value = payload[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

const takeFirstDefined = <T>(...values: readonly (T | null | undefined)[]): T | undefined =>
  values.find((value): value is T => value !== undefined && value !== null);

const takeFirstDefinedList = (
  ...values: ReadonlyArray<readonly string[] | null | undefined>
): string[] => [...(takeFirstDefined(...values) ?? [])];

type AnalysisParsedSectionData = {
  answerText: string;
  confidence: string;
  coreFinding: string;
  impactOnFinalAdjudication: string;
  keyClaims: string[];
  counterConditions: string[];
  failureCases: string[];
  evidenceMentions: string[];
  assumptions: string[];
  uncertainties: string[];
  limitations: string[];
};

const buildAnalysisParsedSectionData = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
}): AnalysisParsedSectionData => {
  const reparsed = reparseAnalysisInteraction(input.interaction);
  const payload = input.answer?.parsedPayload ?? {};
  return {
    answerText: takeFirstDefined(input.answer?.answerText, reparsed?.answer, "Analysis answer: MISSING")
      ?? "Analysis answer: MISSING",
    confidence: takeFirstDefined(input.answer?.confidence, reparsed?.confidence, "unavailable")
      ?? "unavailable",
    coreFinding: takeFirstDefined(readPayloadString(payload, "coreFinding")[0], reparsed?.coreFinding, "unavailable")
      ?? "unavailable",
    impactOnFinalAdjudication: takeFirstDefined(
      readPayloadString(payload, "impactOnFinalAdjudication")[0],
      reparsed?.impactOnFinalAdjudication,
      "unavailable",
    ) ?? "unavailable",
    keyClaims: takeFirstDefinedList(input.answer?.keyPoints, reparsed?.keyClaims),
    counterConditions: takeFirstDefinedList(input.answer?.contradictionPoints, reparsed?.counterConditions),
    failureCases: takeFirstDefinedList(readPayloadString(payload, "failureCases"), reparsed?.failureCases),
    evidenceMentions: takeFirstDefinedList(input.answer?.evidenceMentions, reparsed?.evidenceMentions),
    assumptions: takeFirstDefinedList(input.answer?.assumptions, reparsed?.assumptions),
    uncertainties: takeFirstDefinedList(readPayloadString(payload, "uncertainties"), reparsed?.uncertainties),
    limitations: takeFirstDefinedList(input.answer?.limitations, reparsed?.limitations),
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
    `Answer: ${data.answerText}`,
    `Confidence: ${data.confidence}`,
    "Core Finding",
    buildMarkdownList(data.coreFinding === "unavailable" ? [] : [data.coreFinding], "- unavailable"),
    "Key Claims",
    buildMarkdownList(data.keyClaims, "- unavailable"),
    "Counter Conditions",
    buildMarkdownList(data.counterConditions, "- unavailable"),
    "Failure Cases",
    buildMarkdownList(data.failureCases, "- none"),
    "Evidence Mentions",
    buildMarkdownList(data.evidenceMentions, "- unavailable"),
    "Assumptions",
    buildMarkdownList(data.assumptions, "- none"),
    "Uncertainties",
    buildMarkdownList(data.uncertainties, "- none"),
    "Impact On Final Adjudication",
    buildMarkdownList(
      data.impactOnFinalAdjudication === "unavailable" ? [] : [data.impactOnFinalAdjudication],
      "- unavailable",
    ),
    "Limitations",
    buildMarkdownList(data.limitations, "- unavailable"),
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
