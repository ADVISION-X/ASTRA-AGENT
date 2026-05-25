import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";

const fencedBlock = (value: string, language = "text"): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "_empty_";
  }
  return ["```" + language, normalized, "```"].join("\n");
};

const jsonBlock = (value: unknown): string =>
  fencedBlock(JSON.stringify(value, null, 2), "json");

const buildMetadataLines = (input: DeepResearchFullCaseFile): string[] => [
  `- Job ID: ${input.job.jobId}`,
  `- User Question: ${input.job.userQuestion}`,
  `- Analysis Goal: ${input.job.analysisGoal ?? "UNAVAILABLE"}`,
  `- Language: ${input.job.language}`,
  `- Flow Mode: ${input.job.flowMode}`,
  `- Created At: ${input.job.createdAt}`,
  `- Total Sub-questions: ${input.coverage.totalSubQuestionCount}`,
  `- Structured Analysis Count: ${input.coverage.structuredAnalysisCount}`,
  `- Raw Analysis Interaction Count: ${input.coverage.rawAnalysisInteractionCount}`,
  `- Structured Coverage Ratio: ${input.coverage.structuredCoverageRatio}`,
  `- Raw Coverage Ratio: ${input.coverage.rawCoverageRatio}`,
];

const buildDecompositionSection = (input: DeepResearchFullCaseFile): string => {
  if (!input.decomposition) {
    return [
      "## Decomposition",
      "_No decomposition interaction was persisted._",
    ].join("\n\n");
  }
  return [
    "## Decomposition",
    `- Interaction ID: ${input.decomposition.interactionId}`,
    `- Prompt ID: ${input.decomposition.promptId}`,
    `- Prompt Version: ${input.decomposition.promptVersion}`,
    `- Parse Status: ${input.decomposition.parseStatus}`,
    `- Raw Response Hash: ${input.decomposition.rawResponseHash}`,
    "### Rendered Prompt",
    fencedBlock(input.decomposition.renderedPromptText),
    "### Raw Response",
    fencedBlock(input.decomposition.rawResponseText),
    "### Parsed Sub-questions",
    jsonBlock(input.decomposition.parsedSubQuestions),
  ].join("\n\n");
};

const buildSubQuestionSection = (
  entry: DeepResearchFullCaseFile["subQuestionAnalyses"][number],
): string => [
  `### ${entry.title ?? entry.subQuestionId}`,
  `- Sub-question ID: ${entry.subQuestionId}`,
  `- Model Question ID: ${entry.modelQuestionId ?? "UNAVAILABLE"}`,
  `- Structured Answer Status: ${entry.structuredAnswerStatus}`,
  `- Question: ${entry.questionText}`,
  entry.promptInteraction
    ? [
      `- Interaction ID: ${entry.promptInteraction.interactionId}`,
      `- Prompt ID: ${entry.promptInteraction.promptId}`,
      `- Prompt Version: ${entry.promptInteraction.promptVersion}`,
      `- Parse Status: ${entry.promptInteraction.parseStatus}`,
      `- Raw Response Hash: ${entry.promptInteraction.rawResponseHash}`,
      "#### Rendered Prompt",
      fencedBlock(entry.promptInteraction.renderedPromptText),
      "#### Raw Response",
      fencedBlock(entry.promptInteraction.rawResponseText),
      entry.promptInteraction.providerProofJson
        ? [
          "#### Provider Proof JSON",
          fencedBlock(entry.promptInteraction.providerProofJson, "json"),
        ].join("\n\n")
        : null,
    ].filter((section): section is string => Boolean(section)).join("\n\n")
    : "_No prompt interaction was persisted for this sub-question._",
  entry.structuredAnswer
    ? [
      "#### Structured Answer",
      jsonBlock(entry.structuredAnswer),
    ].join("\n\n")
    : "_No structured answer was persisted for this sub-question._",
].join("\n\n");

const buildFailedInteractionSection = (input: DeepResearchFullCaseFile): string => {
  if (input.failedButRawAvailableInteractions.length === 0) {
    return [
      "## Failed But Raw Available Interactions",
      "_No raw-preserved parse failures were recorded._",
    ].join("\n\n");
  }
  return [
    "## Failed But Raw Available Interactions",
    ...input.failedButRawAvailableInteractions.map((interaction) => [
      `### ${interaction.phase} / ${interaction.subQuestionId ?? interaction.interactionId}`,
      `- Interaction ID: ${interaction.interactionId}`,
      `- Prompt ID: ${interaction.promptId}`,
      `- Parse Status: ${interaction.parseStatus}`,
      `- Raw Response Hash: ${interaction.rawResponseHash}`,
      "#### Rendered Prompt",
      fencedBlock(interaction.renderedPromptText),
      "#### Raw Response",
      fencedBlock(interaction.rawResponseText),
    ].join("\n\n")),
  ].join("\n\n");
};

export const renderDeepResearchFullCaseFileMarkdown = (
  input: DeepResearchFullCaseFile,
): string => [
  "# Deep Research Full Case File",
  "Structured final package is not the complete case file.",
  "The raw interactions below remain the sovereign record for final adjudication and HTML publishing.",
  buildMetadataLines(input).join("\n"),
  buildDecompositionSection(input),
  "## Sub-question Analyses",
  input.subQuestionAnalyses.length > 0
    ? input.subQuestionAnalyses.map(buildSubQuestionSection).join("\n\n")
    : "_No sub-question analysis records were persisted._",
  buildFailedInteractionSection(input),
  "## Structured Final Package",
  jsonBlock(input.structuredFinalPackage),
].join("\n\n");