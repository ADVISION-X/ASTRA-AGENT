import {
  parseDeepResearchFalsificationResponse,
  parseDeepResearchPositiveResponse,
  type DeepResearchFalsificationAnswer,
  type DeepResearchPositiveAnswer,
} from "./deep-research-analysis.parser.js";
import {
  LEGACY_RENDERED_PROMPT_TEXT,
  type ResearchAnswer,
  type ResearchFinalReportRecord,
  type ResearchInteraction,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import type { DeepResearchConflictMatrixRow } from "./deep-research-analysis.result.js";

type StageOverviewRow = {
  order: number;
  phase: string;
  subQuestionLabel: string;
  interaction: ResearchInteraction | null;
};

type InteractionEvidence = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  subQuestionId: string | null;
  promptHash: string;
  rawResponseHash: string;
  domRef: string | null;
};

const NO_ITEMS_TEXT = "- none";

const escapeTableCell = (value: string): string =>
  value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");

export const toDisplayValue = (value: string | null | undefined, fallback = "unavailable"): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

export const buildMarkdownList = (
  items: readonly string[],
  fallback = NO_ITEMS_TEXT,
): string => {
  if (items.length === 0) {
    return fallback;
  }
  return items.map((item) => `- ${item}`).join("\n");
};

const fencedBlock = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "Raw response: unavailable";
  }
  const fence = trimmed.includes("```") ? "````" : "```";
  return `${fence}text\n${trimmed}\n${fence}`;
};

export const buildPromptBlock = (interaction: ResearchInteraction | null): string => {
  if (!interaction) {
    return "Prompt: unavailable; interaction missing for this stage.";
  }
  if (interaction.renderedPromptText === LEGACY_RENDERED_PROMPT_TEXT) {
    return [
      "Prompt text was not persisted in ResearchInteraction.",
      `Prompt ID: ${interaction.promptId}`,
      `Prompt Version: ${interaction.promptVersion}`,
      `Prompt Hash: ${interaction.promptHash}`,
    ].join("\n");
  }
  return fencedBlock(interaction.renderedPromptText);
};

export const buildRawResponseBlock = (interaction: ResearchInteraction | null): string => {
  if (!interaction) {
    return "Raw response: unavailable";
  }
  return fencedBlock(interaction.rawResponseText);
};

export const buildSubQuestionLabel = (subQuestion: ResearchSubQuestion): string =>
  `${subQuestion.question.id}: ${subQuestion.question.title}`;

const buildInteractionPhaseLabel = (phase: ResearchInteraction["phase"]): string => {
  switch (phase) {
    case "decomposition":
      return "Decomposition";
    case "positive":
      return "Positive Analysis";
    case "falsification":
      return "Falsification";
    case "final_synthesis":
      return "Final Synthesis";
    default:
      return phase;
  }
};

export const findInteraction = (
  interactions: readonly ResearchInteraction[],
  phase: ResearchInteraction["phase"],
  subQuestionId?: string,
): ResearchInteraction | null => {
  for (const interaction of interactions) {
    if (interaction.phase !== phase) {
      continue;
    }
    if (subQuestionId === undefined) {
      return interaction;
    }
    if (interaction.subQuestionId === subQuestionId) {
      return interaction;
    }
  }
  return null;
};

export const buildStageOverviewRows = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  finalReportRecord: ResearchFinalReportRecord | null;
}): StageOverviewRow[] => {
  const rows: StageOverviewRow[] = [];
  let order = 1;
  rows.push({
    order,
    phase: "Decomposition",
    subQuestionLabel: "-",
    interaction: findInteraction(input.interactions, "decomposition"),
  });
  order += 1;
  for (const subQuestion of input.subQuestions) {
    rows.push({
      order,
      phase: "Positive Analysis",
      subQuestionLabel: buildSubQuestionLabel(subQuestion),
      interaction: findInteraction(input.interactions, "positive", subQuestion.id),
    });
    order += 1;
    rows.push({
      order,
      phase: "Falsification",
      subQuestionLabel: buildSubQuestionLabel(subQuestion),
      interaction: findInteraction(input.interactions, "falsification", subQuestion.id),
    });
    order += 1;
  }
  rows.push({
    order,
    phase: "Final Synthesis",
    subQuestionLabel: "-",
    interaction:
      (input.finalReportRecord
        ? input.interactions.find((interaction) => interaction.id === input.finalReportRecord?.interactionId)
        : null)
      ?? findInteraction(input.interactions, "final_synthesis"),
  });
  return rows;
};

export const buildStageOverviewTable = (rows: readonly StageOverviewRow[]): string => {
  const header = [
    "| Order | Phase | Sub-question | Prompt ID | Prompt Version | Parse Status | Prompt Hash | Raw Response Hash |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const body = rows.map((row) => {
    const interaction = row.interaction;
    return [
      row.order,
      escapeTableCell(row.phase),
      escapeTableCell(row.subQuestionLabel),
      escapeTableCell(toDisplayValue(interaction?.promptId, "missing")),
      escapeTableCell(toDisplayValue(interaction?.promptVersion, "missing")),
      escapeTableCell(toDisplayValue(interaction?.parseStatus, "missing")),
      escapeTableCell(toDisplayValue(interaction?.promptHash)),
      escapeTableCell(toDisplayValue(interaction?.rawResponseHash)),
    ];
  }).map((cells) => `| ${cells.join(" | ")} |`);
  return [...header, ...body].join("\n");
};

export const buildEvidenceLines = (interaction: ResearchInteraction | null): string => {
  if (!interaction) {
    return [
      "- Interaction ID: unavailable",
      "- Prompt Hash: unavailable",
      "- Raw Response Hash: unavailable",
      "- DOM Ref: unavailable",
      "- Parse Status: missing",
    ].join("\n");
  }
  return [
    `- Interaction ID: ${interaction.id}`,
    `- Prompt ID: ${interaction.promptId}`,
    `- Prompt Version: ${interaction.promptVersion}`,
    `- Prompt Hash: ${interaction.promptHash}`,
    `- Raw Response Hash: ${interaction.rawResponseHash}`,
    `- DOM Ref: ${toDisplayValue(interaction.domRef)}`,
    `- Parse Status: ${interaction.parseStatus}`,
  ].join("\n");
};

export const buildSubQuestionMetadata = (subQuestion: ResearchSubQuestion): string => [
  `Database SubQuestion ID: ${subQuestion.id}`,
  `Model Question ID: ${subQuestion.modelQuestionId}`,
  `Question: ${subQuestion.question.questionText}`,
  `Purpose: ${subQuestion.question.purpose}`,
  `Scope: ${subQuestion.question.scope}`,
  `Expected Answer Shape: ${subQuestion.question.expectedAnswerShape}`,
].join("\n");

const reparsePositiveInteraction = (
  interaction: ResearchInteraction | null,
): DeepResearchPositiveAnswer | null => {
  if (!interaction) {
    return null;
  }
  const parsed = parseDeepResearchPositiveResponse(interaction.rawResponseText);
  return parsed.parseStatus === "parsed" ? parsed.parsed : null;
};

const reparseFalsificationInteraction = (
  interaction: ResearchInteraction | null,
): DeepResearchFalsificationAnswer | null => {
  if (!interaction) {
    return null;
  }
  const parsed = parseDeepResearchFalsificationResponse(interaction.rawResponseText);
  return parsed.parseStatus === "parsed" ? parsed.parsed : null;
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
      ? "missing"
      : input.interaction.parseStatus;
    return [
      `Status: ${stageStatus}`,
      `Reason: Persisted ${input.stageName.toLowerCase()} answer record is unavailable.`,
    ].join("\n");
  }
  return "Status: available";
};

export const buildPositiveParsedSection = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
}): string => {
  const reparsed = reparsePositiveInteraction(input.interaction);
  const answerText = input.answer?.answerText ?? reparsed?.answer ?? "Positive answer: MISSING";
  const confidence = input.answer?.confidence ?? reparsed?.confidence ?? "unavailable";
  const keyClaims = input.answer?.keyPoints ?? reparsed?.keyClaims ?? [];
  const supportingReasons = reparsed?.supportingReasons ?? [];
  const evidenceMentions = input.answer?.evidenceMentions ?? reparsed?.evidenceMentions ?? [];
  const assumptions = input.answer?.assumptions ?? reparsed?.assumptions ?? [];
  const limitations = input.answer?.limitations ?? reparsed?.limitations ?? [];
  return [
    buildStageStatus({
      interaction: input.interaction,
      answer: input.answer,
      stageName: "Positive",
    }),
    `Answer: ${answerText}`,
    `Confidence: ${confidence}`,
    "Key Claims",
    buildMarkdownList(keyClaims, "- unavailable"),
    "Supporting Reasons",
    buildMarkdownList(
      supportingReasons,
      "- unavailable in persisted answer record; inspect AI Raw Response",
    ),
    "Evidence Mentions",
    buildMarkdownList(evidenceMentions, "- unavailable"),
    "Assumptions",
    buildMarkdownList(assumptions, "- none"),
    "Limitations",
    buildMarkdownList(limitations, "- unavailable"),
  ].join("\n\n");
};

export const buildFalsificationParsedSection = (input: {
  interaction: ResearchInteraction | null;
  answer: ResearchAnswer | null;
}): string => {
  const reparsed = reparseFalsificationInteraction(input.interaction);
  const answerText = input.answer?.answerText ?? reparsed?.answer ?? "Falsification answer: MISSING";
  const confidence = input.answer?.confidence ?? reparsed?.confidence ?? "unavailable";
  const strongestOpposingArguments = input.answer?.keyPoints ?? reparsed?.strongestOpposingArguments ?? [];
  const contradictionPoints = input.answer?.contradictionPoints ?? reparsed?.contradictionPoints ?? [];
  const evidenceMentions = input.answer?.evidenceMentions ?? reparsed?.evidenceMentions ?? [];
  const limitations = input.answer?.limitations ?? reparsed?.limitations ?? [];
  return [
    buildStageStatus({
      interaction: input.interaction,
      answer: input.answer,
      stageName: "Falsification",
    }),
    `Answer: ${answerText}`,
    `Confidence: ${confidence}`,
    "Strongest Opposing Arguments",
    buildMarkdownList(strongestOpposingArguments, "- unavailable"),
    "Contradiction Points",
    buildMarkdownList(contradictionPoints, "- unavailable"),
    "Evidence Mentions",
    buildMarkdownList(evidenceMentions, "- unavailable"),
    "Limitations",
    buildMarkdownList(limitations, "- unavailable"),
  ].join("\n\n");
};

export const buildConflictMatrixTable = (
  rows: readonly DeepResearchConflictMatrixRow[],
  subQuestionById: ReadonlyMap<string, ResearchSubQuestion>,
): string => {
  const header = [
    "| Sub-question | Positive Claim | Falsification | Conflict Level | Evidence Gap | Human Review |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  const body = rows.map((row) => {
    const subQuestion = subQuestionById.get(row.subQuestionId);
    const label = subQuestion ? buildSubQuestionLabel(subQuestion) : row.subQuestionId;
    return [
      escapeTableCell(label),
      escapeTableCell(row.positiveClaimSummary),
      escapeTableCell(row.falsificationSummary),
      escapeTableCell(row.conflictLevel),
      escapeTableCell(row.evidenceGap),
      escapeTableCell(row.needsHumanReview ? "yes" : "no"),
    ];
  }).map((cells) => `| ${cells.join(" | ")} |`);
  return [...header, ...body].join("\n");
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