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
  buildAnalysisParsedSection,
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
    "### Parsed Sub-Questions",
    ...subQuestionBlocks,
    "",
    "### Evidence",
    buildEvidenceLines(input.interaction),
  ].join("\n");
};

const buildDefaultSubQuestionSection = (input: {
  subQuestion: ResearchSubQuestion;
  analysisInteraction: ResearchInteraction | null;
  analysisAnswer: ResearchAnswer | null;
}): string => [
  `## Sub-question ${input.subQuestion.modelQuestionId}: ${input.subQuestion.question.title}`,
  "",
  buildSubQuestionMetadata(input.subQuestion),
  "",
  "### Independent Analysis",
  "",
  "#### Prompt",
  buildPromptBlock(input.analysisInteraction),
  "",
  "#### AI Raw Response",
  buildRawResponseBlock(input.analysisInteraction),
  "",
  "#### Parsed Independent Analysis",
  buildAnalysisParsedSection({
    interaction: input.analysisInteraction,
    answer: input.analysisAnswer,
  }),
  "",
  "#### Evidence",
  buildEvidenceLines(input.analysisInteraction),
].join("\n");

const buildLegacySubQuestionSection = (input: {
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

const buildDecisionSummarySection = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport | null;
}): string => {
  if (!input.finalReport) {
    return [
      "## Final Summary",
      "",
      "Final report not available.",
    ].join("\n");
  }
  const decisiveReasons = input.finalReport.decisiveReasons.length > 0
    ? input.finalReport.decisiveReasons
    : input.finalReport.positiveReasons;
  const opposingClaims = input.finalReport.weakOrRejectedClaims.length > 0
    ? input.finalReport.weakOrRejectedClaims
    : input.finalReport.strongestOpposingArguments;
  return [
    "## Final Summary",
    "",
    `Flow Mode: ${input.finalPackage.flowMode}`,
    `Direct Answer: ${input.finalReport.directAnswer}`,
    `Final Verdict: ${input.finalReport.finalVerdict}`,
    `Confidence: ${input.finalReport.confidence}`,
    "",
    "### Decisive Reasons",
    buildMarkdownList(decisiveReasons),
    "",
    "### Weak Or Rejected Claims",
    buildMarkdownList(opposingClaims),
    "",
    "### Evidence Gaps",
    buildMarkdownList(input.finalReport.evidenceGaps),
    "",
    "### Reverse Conditions",
    buildMarkdownList(input.finalReport.reverseConditions),
    "",
    "### Follow-up Signals",
    buildMarkdownList(input.finalReport.followUpSignals),
    "",
    "### Limitations",
    buildMarkdownList(input.finalReport.limitations),
  ].join("\n");
};

const buildCoverageSection = (finalPackage: DeepResearchFinalPackage): string => [
  "## Analysis Coverage",
  "",
  `Total Sub-Questions: ${String(finalPackage.analysisCoverage.totalSubQuestionCount)}`,
  `Analyzed Sub-Questions: ${String(finalPackage.analysisCoverage.analyzedSubQuestionCount)}`,
  `Missing Analysis Count: ${String(finalPackage.analysisCoverage.missingAnalysisSubQuestionCount)}`,
  `Coverage Ratio: ${String(finalPackage.analysisCoverage.coverageRatio)}`,
  "",
  "### Missing Analysis Sub-Questions",
  buildMarkdownList(finalPackage.missingAnalysisSubQuestionIds, "- none"),
].join("\n");

const buildFinalStageSection = (input: {
  interaction: ResearchInteraction | null;
  finalReport: DeepResearchFinalReport | null;
  flowMode: DeepResearchFinalPackage["flowMode"];
}): string => {
  const sectionLabel = input.flowMode === "legacy_1_n_n_1"
    ? "Final Synthesis"
    : "Final Adjudication";
  const parsedSection = !input.finalReport
    ? "Final report not available."
    : [
      `directAnswer: ${input.finalReport.directAnswer}`,
      `finalVerdict: ${input.finalReport.finalVerdict}`,
      `confidence: ${input.finalReport.confidence}`,
      "decisiveReasons",
      buildMarkdownList(input.finalReport.decisiveReasons.length > 0
        ? input.finalReport.decisiveReasons
        : input.finalReport.positiveReasons),
      "weakOrRejectedClaims",
      buildMarkdownList(input.finalReport.weakOrRejectedClaims.length > 0
        ? input.finalReport.weakOrRejectedClaims
        : input.finalReport.strongestOpposingArguments),
      "evidenceGaps",
      buildMarkdownList(input.finalReport.evidenceGaps),
      "reverseConditions",
      buildMarkdownList(input.finalReport.reverseConditions),
      "followUpSignals",
      buildMarkdownList(input.finalReport.followUpSignals),
      "limitations",
      buildMarkdownList(input.finalReport.limitations),
    ].join("\n\n");
  return [
    `## ${sectionLabel}`,
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
  const finalPhase = input.finalPackage.flowMode === "legacy_1_n_n_1"
    ? "final_synthesis"
    : "final_adjudication";
  const finalInteraction = input.persisted.finalReportRecord
    ? input.persisted.interactions.find(
      (interaction) => interaction.id === input.persisted.finalReportRecord?.interactionId,
    ) ?? findInteraction(input.persisted.interactions, finalPhase)
    : findInteraction(input.persisted.interactions, finalPhase);
  return {
    subQuestionById,
    finalReport,
    stageRows: input.stageRows,
    decompositionInteraction,
    finalInteraction,
    conflictMatrixRows: finalReport?.conflictMatrix ?? (
      input.finalPackage.flowMode === "legacy_1_n_n_1"
        ? input.finalPackage.conflictMatrix
        : []
    ),
  };
};

const buildReportMetadataLines = (input: {
  finalPackage: DeepResearchFinalPackage;
  persisted: DeepResearchPersistedExportState;
  finalReport: DeepResearchFinalReport | null;
}): string[] => [
  "# Deep Research Full Flow Report",
  "",
  `Job ID: ${input.persisted.job.id}`,
  `Created At: ${input.persisted.job.createdAt}`,
  `Updated At: ${input.persisted.job.updatedAt}`,
  `Status: ${input.persisted.job.status}`,
  `Flow Mode: ${input.finalPackage.flowMode}`,
  `Question: ${input.persisted.job.userQuestion}`,
  `Analysis Goal: ${toDisplayValue(input.persisted.job.analysisGoal)}`,
  `Language: ${input.persisted.job.language}`,
  `Max SubQuestions: ${String(input.persisted.job.maxSubQuestions)}`,
  "",
  "## One-line Verdict",
  "",
  input.finalReport
    ? [`Direct Answer: ${input.finalReport.directAnswer}`, `Confidence: ${input.finalReport.confidence}`].join("\n")
    : "Final report not available.",
  "",
];

export const buildDeepResearchFullFlowReportMarkdown = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport | null;
  persisted: DeepResearchPersistedExportState;
}): string => {
  const analysisAnswerBySubQuestionId = new Map(
    input.persisted.answers
      .filter((answer) => answer.answerKind === "analysis")
      .map((answer) => [answer.subQuestionId, answer]),
  );
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
    job: input.persisted.job,
    interactions: input.persisted.interactions,
    subQuestions: input.persisted.subQuestions,
    finalReportRecord: input.persisted.finalReportRecord,
  });
  const context = buildMarkdownContext({
    ...input,
    stageRows,
  });
  const subQuestionSections = input.persisted.subQuestions.map((subQuestion) =>
    input.finalPackage.flowMode === "legacy_1_n_n_1"
      ? buildLegacySubQuestionSection({
        subQuestion,
        positiveInteraction: findInteraction(input.persisted.interactions, "positive", subQuestion.id),
        falsificationInteraction: findInteraction(input.persisted.interactions, "falsification", subQuestion.id),
        positiveAnswer: positiveAnswerBySubQuestionId.get(subQuestion.id) ?? null,
        falsificationAnswer: falsificationAnswerBySubQuestionId.get(subQuestion.id) ?? null,
      })
      : buildDefaultSubQuestionSection({
        subQuestion,
        analysisInteraction: findInteraction(input.persisted.interactions, "analysis", subQuestion.id),
        analysisAnswer: analysisAnswerBySubQuestionId.get(subQuestion.id) ?? null,
      }));

  const sections = [
    ...buildReportMetadataLines({
      finalPackage: input.finalPackage,
      persisted: input.persisted,
      finalReport: context.finalReport,
    }),
    buildDecisionSummarySection({
      finalPackage: input.finalPackage,
      finalReport: context.finalReport,
    }),
    "",
    ...(input.finalPackage.flowMode === "default_1_n_1"
      ? [buildCoverageSection(input.finalPackage), ""]
      : []),
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
    ...(input.finalPackage.flowMode === "legacy_1_n_n_1"
      ? [
        "## Conflict Matrix",
        "",
        buildConflictMatrixTable(context.conflictMatrixRows, context.subQuestionById),
        "",
      ]
      : []),
    buildFinalStageSection({
      interaction: context.finalInteraction,
      finalReport: context.finalReport,
      flowMode: input.finalPackage.flowMode,
    }),
    "",
    "## Evidence Index",
    "",
    buildEvidenceIndexTable(
      buildInteractionEvidence(input.persisted.interactions),
      context.subQuestionById,
    ),
  ];

  return sections.join("\n").trimEnd() + "\n";
};
