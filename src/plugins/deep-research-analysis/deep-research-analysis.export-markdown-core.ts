import {
  MISSING_RENDERED_PROMPT_TEXT,
  type ResearchFinalReportRecord,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";

export type StageOverviewRow = {
  order: number;
  phase: string;
  subQuestionLabel: string;
  interaction: ResearchInteraction | null;
};

export type InteractionEvidence = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  subQuestionId: string | null;
  promptHash: string;
  rawResponseHash: string;
  domRef: string | null;
};

const NO_ITEMS_TEXT = "- none";

export const escapeTableCell = (value: string): string =>
  value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");

export const toDisplayValue = (value: string | null | undefined, rawIndex = "unavailable"): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : rawIndex;
};

export const buildMarkdownList = (
  items: readonly string[],
  rawIndex = NO_ITEMS_TEXT,
): string => {
  if (items.length === 0) {
    return rawIndex;
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
  if (interaction.renderedPromptText === MISSING_RENDERED_PROMPT_TEXT) {
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

export const buildInteractionPhaseLabel = (phase: ResearchInteraction["phase"]): string => {
  switch (phase) {
    case "decomposition":
      return "Decomposition";
    case "analysis":
      return "Independent Analysis";
    case "final_adjudication":
      return "Final Adjudication";
    case "html_report":
      return "Business HTML Report";
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
  job: ResearchJob;
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
      phase: "Independent Analysis",
      subQuestionLabel: buildSubQuestionLabel(subQuestion),
      interaction: findInteraction(input.interactions, "analysis", subQuestion.id),
    });
    order += 1;
  }
  rows.push({
    order,
    phase: "Final Adjudication",
    subQuestionLabel: "-",
    interaction:
      (input.finalReportRecord
        ? input.interactions.find((interaction) => interaction.id === input.finalReportRecord?.interactionId)
        : null)
      ?? findInteraction(input.interactions, "final_adjudication"),
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
  `Purpose: ${subQuestion.question.whyItMatters ?? subQuestion.question.purpose}`,
  ...(subQuestion.question.analysisFocus ? [`Analysis Focus: ${subQuestion.question.analysisFocus}`] : []),
  ...(subQuestion.question.decisionWeight ? [`Decision Weight: ${subQuestion.question.decisionWeight}`] : []),
  ...(subQuestion.question.priority ? [`Priority: ${subQuestion.question.priority}`] : []),
  `Scope: ${subQuestion.question.scope}`,
  `Expected Answer Shape: ${subQuestion.question.expectedAnswerShape}`,
  ...(subQuestion.question.requiredEvidence.length > 0
    ? [`Required Evidence: ${subQuestion.question.requiredEvidence.join("; ")}`]
    : []),
  ...(subQuestion.question.omissionRisk ? [`Omission Risk: ${subQuestion.question.omissionRisk}`] : []),
].join("\n");