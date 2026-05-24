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

type PersistedAnswerMaps = {
  analysisAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  falsificationAnswerBySubQuestionId: Map<string, ResearchAnswer>;
};

const buildAnswerMapByKind = (
  answers: readonly ResearchAnswer[],
  answerKind: ResearchAnswer["answerKind"],
): Map<string, ResearchAnswer> =>
  new Map(
    answers
      .filter((answer) => answer.answerKind === answerKind)
      .map((answer) => [answer.subQuestionId, answer]),
  );

const buildPersistedAnswerMaps = (answers: readonly ResearchAnswer[]): PersistedAnswerMaps => ({
  analysisAnswerBySubQuestionId: buildAnswerMapByKind(answers, "analysis"),
  positiveAnswerBySubQuestionId: buildAnswerMapByKind(answers, "positive"),
  falsificationAnswerBySubQuestionId: buildAnswerMapByKind(answers, "falsification"),
});

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

const buildReportMetadataLines = (input: {
  finalPackage: DeepResearchFinalPackage;
  persisted: DeepResearchPersistedExportState;
  finalReport: DeepResearchFinalReport | null;
}): string[] => [
  "# Deep Research Full Flow Report",
  "",
  `Job ID: ${input.persisted.job.id}`,
  `User Question: ${input.persisted.job.userQuestion}`,
  `Analysis Goal: ${toDisplayValue(input.persisted.job.analysisGoal)}`,
  `Flow Mode: ${input.finalPackage.flowMode}`,
  `Job Status: ${input.persisted.job.status}`,
  `Updated At: ${input.persisted.job.updatedAt}`,
  `Final Report Available: ${input.finalReport ? "yes" : "no"}`,
  "",
];

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
  return {
    subQuestionById,
    finalReport,
    stageRows: input.stageRows,
    decompositionInteraction: findInteraction(input.persisted.interactions, "decomposition"),
    finalInteraction: input.finalPackage.flowMode === "legacy_1_n_n_1"
      ? findInteraction(input.persisted.interactions, "final_synthesis")
      : findInteraction(input.persisted.interactions, "final_adjudication"),
    conflictMatrixRows: input.finalPackage.flowMode === "legacy_1_n_n_1"
      ? input.finalPackage.conflictMatrix
      : [],
  };
};

const buildSubQuestionSections = (input: {
  finalPackage: DeepResearchFinalPackage;
  persisted: DeepResearchPersistedExportState;
  answerMaps: PersistedAnswerMaps;
}): string[] =>
  input.persisted.subQuestions.map((subQuestion) =>
    input.finalPackage.flowMode === "legacy_1_n_n_1"
      ? buildLegacySubQuestionSection({
        subQuestion,
        positiveInteraction: findInteraction(input.persisted.interactions, "positive", subQuestion.id),
        falsificationInteraction: findInteraction(input.persisted.interactions, "falsification", subQuestion.id),
        positiveAnswer: input.answerMaps.positiveAnswerBySubQuestionId.get(subQuestion.id) ?? null,
        falsificationAnswer: input.answerMaps.falsificationAnswerBySubQuestionId.get(subQuestion.id) ?? null,
      })
      : buildDefaultSubQuestionSection({
        subQuestion,
        analysisInteraction: findInteraction(input.persisted.interactions, "analysis", subQuestion.id),
        analysisAnswer: input.answerMaps.analysisAnswerBySubQuestionId.get(subQuestion.id) ?? null,
      }),
  );

const buildFullFlowReportSections = (input: {
  finalPackage: DeepResearchFinalPackage;
  persisted: DeepResearchPersistedExportState;
  context: DeepResearchMarkdownContext;
  stageRows: ReturnType<typeof buildStageOverviewRows>;
  subQuestionSections: readonly string[];
}): string[] => [
  ...buildReportMetadataLines({
    finalPackage: input.finalPackage,
    persisted: input.persisted,
    finalReport: input.context.finalReport,
  }),
  buildDecisionSummarySection({
    finalPackage: input.finalPackage,
    finalReport: input.context.finalReport,
  }),
  "",
  ...((input.finalPackage.flowMode === "default_1_n_1" || input.finalPackage.flowMode === "default_1_n_1_1")
    ? [buildCoverageSection(input.finalPackage), ""]
    : []),
  "## Stage Overview",
  "",
  buildStageOverviewTable(input.stageRows),
  "",
  buildDecompositionSection({
    interaction: input.context.decompositionInteraction,
    subQuestions: input.persisted.subQuestions,
  }),
  "",
  ...input.subQuestionSections.flatMap((section) => [section, ""]),
  ...(input.finalPackage.flowMode === "legacy_1_n_n_1"
    ? [
      "## Conflict Matrix",
      "",
      buildConflictMatrixTable(input.context.conflictMatrixRows, input.context.subQuestionById),
      "",
    ]
    : []),
  buildFinalStageSection({
    interaction: input.context.finalInteraction,
    finalReport: input.context.finalReport,
    flowMode: input.finalPackage.flowMode,
  }),
  "",
  "## Evidence Index",
  "",
  buildEvidenceIndexTable(
    buildInteractionEvidence(input.persisted.interactions),
    input.context.subQuestionById,
  ),
];

export const buildDeepResearchFullFlowReportMarkdown = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport | null;
  persisted: DeepResearchPersistedExportState;
}): string => {
  const answerMaps = buildPersistedAnswerMaps(input.persisted.answers);
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
  const subQuestionSections = buildSubQuestionSections({
    finalPackage: input.finalPackage,
    persisted: input.persisted,
    answerMaps,
  });
  return buildFullFlowReportSections({
    finalPackage: input.finalPackage,
    persisted: input.persisted,
    context,
    stageRows,
    subQuestionSections,
  }).join("\n").trimEnd() + "\n";
};
