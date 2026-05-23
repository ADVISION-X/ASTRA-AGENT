import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import {
  type ResearchAnswer,
  type ResearchFinalReportRecord,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.record-contracts.js";
import type {
  DeepResearchConflictMatrixRow,
  DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import {
  buildConflictMatrixTable,
  buildEvidenceIndexTable,
  buildEvidenceLines,
  buildFalsificationParsedSection,
  buildInteractionEvidence,
  buildMarkdownList,
  buildPositiveParsedSection,
  buildPromptBlock,
  buildRawResponseBlock,
  buildStageOverviewRows,
  buildStageOverviewTable,
  buildSubQuestionLabel,
  buildSubQuestionMetadata,
  findInteraction,
  toDisplayValue,
} from "./deep-research-analysis.export-markdown-support.js";

type DeepResearchPersistedExportState = {
  job: ResearchJob;
  finalReportRecord: ResearchFinalReportRecord | null;
  interactions: ResearchInteraction[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
};

const buildDecompositionSection = (input: {
  interaction: ResearchInteraction | null;
  subQuestions: readonly ResearchSubQuestion[];
}): string => {
  const parsedSubQuestions = input.interaction
    ? input.subQuestions.filter((subQuestion) => subQuestion.interactionId === input.interaction?.id)
    : input.subQuestions;
  const subQuestionBlocks = parsedSubQuestions.length === 0
    ? ["No parsed sub-questions were persisted."]
    : parsedSubQuestions.flatMap((subQuestion) => [
      `#### ${buildSubQuestionLabel(subQuestion)}`,
      buildSubQuestionMetadata(subQuestion),
    ]);
  return [
    "## Stage 1: Decomposition",
    "",
    "### Prompt",
    buildPromptBlock(input.interaction),
    "",
    "### AI Raw Response",
    buildRawResponseBlock(input.interaction),
    "",
    "### Parsed SubQuestions",
    ...subQuestionBlocks,
    "",
    "### Evidence",
    buildEvidenceLines(input.interaction),
  ].join("\n");
};

const buildSubQuestionSection = (input: {
  subQuestion: ResearchSubQuestion;
  positiveInteraction: ResearchInteraction | null;
  falsificationInteraction: ResearchInteraction | null;
  positiveAnswer: ResearchAnswer | null;
  falsificationAnswer: ResearchAnswer | null;
}): string => [
  `## Sub-question ${input.subQuestion.modelQuestionId}: ${input.subQuestion.question.title}`,
  "",
  buildSubQuestionMetadata(input.subQuestion),
  "",
  "### Positive Analysis",
  "",
  "#### Prompt",
  buildPromptBlock(input.positiveInteraction),
  "",
  "#### AI Raw Response",
  buildRawResponseBlock(input.positiveInteraction),
  "",
  "#### Parsed Positive Answer",
  buildPositiveParsedSection({
    interaction: input.positiveInteraction,
    answer: input.positiveAnswer,
  }),
  "",
  "#### Evidence",
  buildEvidenceLines(input.positiveInteraction),
  "",
  "### Falsification",
  "",
  "#### Prompt",
  buildPromptBlock(input.falsificationInteraction),
  "",
  "#### AI Raw Response",
  buildRawResponseBlock(input.falsificationInteraction),
  "",
  "#### Parsed Falsification Answer",
  buildFalsificationParsedSection({
    interaction: input.falsificationInteraction,
    answer: input.falsificationAnswer,
  }),
  "",
  "#### Evidence",
  buildEvidenceLines(input.falsificationInteraction),
].join("\n");

const buildFinalSummarySection = (finalReport: DeepResearchFinalReport | null): string => {
  if (!finalReport) {
    return [
      "## Final Summary",
      "",
      "Final report not available.",
    ].join("\n");
  }
  return [
    "## Final Summary",
    "",
    "### Positive Reasons",
    buildMarkdownList(finalReport.positiveReasons),
    "",
    "### Strongest Opposing Arguments",
    buildMarkdownList(finalReport.strongestOpposingArguments),
    "",
    "### Evidence Gaps",
    buildMarkdownList(finalReport.evidenceGaps),
    "",
    "### Reverse Conditions",
    buildMarkdownList(finalReport.reverseConditions),
    "",
    "### Follow-up Signals",
    buildMarkdownList(finalReport.followUpSignals),
    "",
    "### Limitations",
    buildMarkdownList(finalReport.limitations),
  ].join("\n");
};

const buildFinalSynthesisSection = (input: {
  interaction: ResearchInteraction | null;
  finalReport: DeepResearchFinalReport | null;
}): string => {
  const finalReport = input.finalReport;
  const parsedSection = !finalReport
    ? [
      "Final report not available.",
    ].join("\n")
    : [
      `executiveConclusion: ${finalReport.executiveConclusion}`,
      `confidence: ${finalReport.confidence}`,
      "positiveReasons",
      buildMarkdownList(finalReport.positiveReasons),
      "strongestOpposingArguments",
      buildMarkdownList(finalReport.strongestOpposingArguments),
      "evidenceGaps",
      buildMarkdownList(finalReport.evidenceGaps),
      "reverseConditions",
      buildMarkdownList(finalReport.reverseConditions),
      "followUpSignals",
      buildMarkdownList(finalReport.followUpSignals),
      "limitations",
      buildMarkdownList(finalReport.limitations),
    ].join("\n\n");
  return [
    "## Final Synthesis",
    "",
    "### Final Prompt",
    buildPromptBlock(input.interaction),
    "",
    "### AI Raw Response",
    buildRawResponseBlock(input.interaction),
    "",
    "### Parsed Final Report",
    parsedSection,
    "",
    "### Evidence",
    buildEvidenceLines(input.interaction),
  ].join("\n");
};

type DeepResearchMarkdownContext = {
  subQuestionById: Map<string, ResearchSubQuestion>;
  finalReport: DeepResearchFinalReport | null;
  stageRows: ReturnType<typeof buildStageOverviewRows>;
  decompositionInteraction: ResearchInteraction | null;
  finalInteraction: ResearchInteraction | null;
  conflictMatrixRows: readonly DeepResearchConflictMatrixRow[];
};

const buildMarkdownContext = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport | null;
  persisted: DeepResearchPersistedExportState;
  stageRows: ReturnType<typeof buildStageOverviewRows>;
}): DeepResearchMarkdownContext => {
  const subQuestionById = new Map(
    input.persisted.subQuestions.map((subQuestion) => [subQuestion.id, subQuestion]),
  );
  const finalReport = input.persisted.finalReportRecord?.report ?? input.finalReport;
  const decompositionInteraction = findInteraction(input.persisted.interactions, "decomposition");
  const finalInteraction = input.persisted.finalReportRecord
    ? input.persisted.interactions.find(
      (interaction) => interaction.id === input.persisted.finalReportRecord?.interactionId,
    ) ?? findInteraction(input.persisted.interactions, "final_synthesis")
    : findInteraction(input.persisted.interactions, "final_synthesis");
  return {
    subQuestionById,
    finalReport,
    stageRows: input.stageRows,
    decompositionInteraction,
    finalInteraction,
    conflictMatrixRows: finalReport?.conflictMatrix ?? input.finalPackage.conflictMatrix,
  };
};

const buildReportMetadataLines = (input: {
  persisted: DeepResearchPersistedExportState;
  finalReport: DeepResearchFinalReport | null;
}): string[] => [
  "# Deep Research Full Flow Report",
  "",
  `Job ID: ${input.persisted.job.id}`,
  `Created At: ${input.persisted.job.createdAt}`,
  `Updated At: ${input.persisted.job.updatedAt}`,
  `Status: ${input.persisted.job.status}`,
  `Question: ${input.persisted.job.userQuestion}`,
  `Analysis Goal: ${toDisplayValue(input.persisted.job.analysisGoal)}`,
  `Language: ${input.persisted.job.language}`,
  `Max SubQuestions: ${String(input.persisted.job.maxSubQuestions)}`,
  "",
  "## One-line Verdict",
  "",
  input.finalReport
    ? [`Final Conclusion: ${input.finalReport.executiveConclusion}`, `Confidence: ${input.finalReport.confidence}`].join("\n")
    : "Final report not available.",
  "",
];

export const buildDeepResearchFullFlowReportMarkdown = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport | null;
  persisted: DeepResearchPersistedExportState;
}): string => {
  const positiveAnswerBySubQuestionId = new Map(
    input.persisted.answers
      .filter((answer) => answer.answerKind === "positive")
      .map((answer) => [answer.subQuestionId, answer]),
  );
  const falsificationAnswerBySubQuestionId = new Map(
    input.persisted.answers
      .filter((answer) => answer.answerKind === "falsification")
      .map((answer) => [answer.subQuestionId, answer]),
  );
  const stageRows = buildStageOverviewRows({
    interactions: input.persisted.interactions,
    subQuestions: input.persisted.subQuestions,
    finalReportRecord: input.persisted.finalReportRecord,
  });
  const context = buildMarkdownContext({
    ...input,
    stageRows,
  });
  const subQuestionSections = input.persisted.subQuestions.map((subQuestion) =>
    buildSubQuestionSection({
      subQuestion,
      positiveInteraction: findInteraction(input.persisted.interactions, "positive", subQuestion.id),
      falsificationInteraction: findInteraction(input.persisted.interactions, "falsification", subQuestion.id),
      positiveAnswer: positiveAnswerBySubQuestionId.get(subQuestion.id) ?? null,
      falsificationAnswer: falsificationAnswerBySubQuestionId.get(subQuestion.id) ?? null,
    }));

  return [
    ...buildReportMetadataLines({
      persisted: input.persisted,
      finalReport: context.finalReport,
    }),
    buildFinalSummarySection(context.finalReport),
    "",
    "## Stage Overview",
    "",
    buildStageOverviewTable(stageRows),
    "",
    buildDecompositionSection({
      interaction: context.decompositionInteraction,
      subQuestions: input.persisted.subQuestions,
    }),
    "",
    ...subQuestionSections.flatMap((section) => [section, ""]),
    "## Conflict Matrix",
    "",
    buildConflictMatrixTable(context.conflictMatrixRows, context.subQuestionById),
    "",
    buildFinalSynthesisSection({
      interaction: context.finalInteraction,
      finalReport: context.finalReport,
    }),
    "",
    "## Evidence Index",
    "",
    buildEvidenceIndexTable(
      buildInteractionEvidence(input.persisted.interactions),
      context.subQuestionById,
    ),
  ].join("\n").trimEnd() + "\n";
};