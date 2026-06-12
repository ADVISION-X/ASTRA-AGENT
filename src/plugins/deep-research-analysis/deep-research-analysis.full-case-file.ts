import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { stableJsonHash } from "../../lib/storage/hash.js";
import { isDeepResearchSuccessfulParseStatus } from "./deep-research-analysis.parser-support.js";
import type { DeepResearchRecordStore, ResearchAnswer, ResearchExport, ResearchInteraction, ResearchJob, ResearchSubQuestion } from "./deep-research-analysis.records.js";
import { DeepResearchInputAttachmentSchema, DeepResearchInteractionPhaseSchema, DeepResearchParseStatusSchema, DeepResearchPlanSchema } from "./deep-research-analysis.schema.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

const DeepResearchFullCaseFileJobSchema = z
  .object({
    jobId: z.string().trim().min(1),
    userQuestion: z.string().trim().min(1),
    analysisGoal: z.string().trim().min(1).nullable(),
    language: z.string().trim().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

const DeepResearchCaseInteractionSchema = z
  .object({
    interactionId: z.string().trim().min(1),
    promptId: z.string().trim().min(1),
    promptVersion: z.string().trim().min(1),
    renderedPromptText: z.string(),
    rawResponseText: z.string(),
    rawResponseHash: z.string().trim().min(1),
    normalizedText: z.string().nullable(),
    parseStatus: DeepResearchParseStatusSchema,
  })
  .strict();

const DeepResearchCasePromptInteractionSchema = DeepResearchCaseInteractionSchema.extend({
  providerProofJson: z.string().nullable(),
}).strict();

const DeepResearchCaseDecompositionSchema = DeepResearchCaseInteractionSchema.extend({
  parsedSubQuestions: z.array(z.unknown()),
}).strict();

export const DeepResearchStructuredAnswerStatusSchema = z.enum(["parsed", "missing", "parse_failed_raw_available"]);

const DeepResearchFullCaseFileSubQuestionAnalysisSchema = z
  .object({
    subQuestionId: z.string().trim().min(1),
    modelQuestionId: z.string().trim().min(1).nullable(),
    title: z.string().trim().min(1).nullable(),
    questionText: z.string().trim().min(1),
    promptInteraction: DeepResearchCasePromptInteractionSchema.nullable(),
    structuredAnswer: z.unknown().nullable(),
    structuredAnswerStatus: DeepResearchStructuredAnswerStatusSchema,
  })
  .strict();

const DeepResearchFailedRawInteractionSchema = z
  .object({
    interactionId: z.string().trim().min(1),
    phase: DeepResearchInteractionPhaseSchema,
    subQuestionId: z.string().trim().min(1).nullable(),
    promptId: z.string().trim().min(1),
    renderedPromptText: z.string(),
    rawResponseText: z.string(),
    rawResponseHash: z.string().trim().min(1),
    parseStatus: DeepResearchParseStatusSchema,
  })
  .strict();

const DeepResearchFullCaseFileCoverageSchema = z
  .object({
    totalSubQuestionCount: z.number().int().nonnegative(),
    structuredAnalysisCount: z.number().int().nonnegative(),
    rawAnalysisInteractionCount: z.number().int().nonnegative(),
    rawCoverageRatio: z.number().min(0).max(1),
    structuredCoverageRatio: z.number().min(0).max(1),
  })
  .strict();

export const DeepResearchFullCaseFileSchema = z
  .object({
    caseFileVersion: z.literal("v1"),
    job: DeepResearchFullCaseFileJobSchema,
    researchPlan: DeepResearchPlanSchema,
    inputAttachments: z.array(DeepResearchInputAttachmentSchema),
    decomposition: DeepResearchCaseDecompositionSchema.nullable(),
    subQuestionAnalyses: z.array(DeepResearchFullCaseFileSubQuestionAnalysisSchema),
    failedButRawAvailableInteractions: z.array(DeepResearchFailedRawInteractionSchema),
    structuredIndex: z.unknown(),
    sourceNotes: z.array(z.unknown()),
    recordHashes: z.record(z.string(), z.string()),
    coverage: DeepResearchFullCaseFileCoverageSchema,
  })
  .strict();

export type DeepResearchFullCaseFile = z.infer<typeof DeepResearchFullCaseFileSchema>;

const hasNonEmptyRawResponse = (interaction: ResearchInteraction): boolean => interaction.rawResponseText.trim().length > 0;

const isRawAvailableParseFailure = (interaction: ResearchInteraction): boolean => hasNonEmptyRawResponse(interaction) && !isDeepResearchSuccessfulParseStatus(interaction.parseStatus);

const buildStructuredAnswer = (answer: ResearchAnswer | null): unknown | null => {
  if (!answer) {
    return null;
  }
  return {
    id: answer.id,
    interactionId: answer.interactionId,
    answerKind: answer.answerKind,
    answerText: answer.answerText,
    keyPoints: answer.keyPoints,
    evidenceMentions: answer.evidenceMentions,
    assumptions: answer.assumptions,
    limitations: answer.limitations,
    contradictionPoints: answer.contradictionPoints,
    parsedPayload: answer.parsedPayload,
  };
};

const buildAnalysisInteractionBySubQuestionId = (interactions: readonly ResearchInteraction[]): Map<string, ResearchInteraction> => {
  const map = new Map<string, ResearchInteraction>();
  for (const interaction of interactions) {
    if (interaction.phase !== "analysis" || !interaction.subQuestionId) {
      continue;
    }
    map.set(interaction.subQuestionId, interaction);
  }
  return map;
};

const buildAnswerBySubQuestionId = (answers: readonly ResearchAnswer[]): Map<string, ResearchAnswer> => {
  const map = new Map<string, ResearchAnswer>();
  for (const answer of answers) {
    map.set(answer.subQuestionId, answer);
  }
  return map;
};

const buildInteractionById = (interactions: readonly ResearchInteraction[]): Map<string, ResearchInteraction> => new Map(interactions.map((interaction) => [interaction.id, interaction]));

const buildPromptInteraction = (interaction: ResearchInteraction | null) => {
  if (!interaction) {
    return null;
  }
  return {
    interactionId: interaction.id,
    promptId: interaction.promptId,
    promptVersion: interaction.promptVersion,
    renderedPromptText: interaction.renderedPromptText,
    rawResponseText: interaction.rawResponseText,
    rawResponseHash: interaction.rawResponseHash,
    normalizedText: interaction.normalizedText,
    parseStatus: interaction.parseStatus,
    providerProofJson: interaction.providerProofJson,
  };
};

const buildCoverage = (input: { subQuestions: readonly ResearchSubQuestion[]; answers: readonly ResearchAnswer[]; interactions: readonly ResearchInteraction[] }) => {
  const totalSubQuestionCount = input.subQuestions.length;
  const structuredAnalysisCount = new Set(input.answers.map((answer) => answer.subQuestionId)).size;
  const rawAnalysisInteractionCount = new Set(
    input.interactions.filter((interaction) => interaction.phase === "analysis" && interaction.subQuestionId && hasNonEmptyRawResponse(interaction)).map((interaction) => interaction.subQuestionId),
  ).size;
  return {
    totalSubQuestionCount,
    structuredAnalysisCount,
    rawAnalysisInteractionCount,
    rawCoverageRatio: totalSubQuestionCount === 0 ? 0 : rawAnalysisInteractionCount / totalSubQuestionCount,
    structuredCoverageRatio: totalSubQuestionCount === 0 ? 0 : structuredAnalysisCount / totalSubQuestionCount,
  };
};

const buildDecompositionCase = (input: { interactions: readonly ResearchInteraction[]; structuredIndex: DeepResearchStructuredIndex }) => {
  const interaction = input.interactions.find((entry) => entry.phase === "decomposition") ?? null;
  if (!interaction) {
    return null;
  }
  return {
    interactionId: interaction.id,
    promptId: interaction.promptId,
    promptVersion: interaction.promptVersion,
    renderedPromptText: interaction.renderedPromptText,
    rawResponseText: interaction.rawResponseText,
    rawResponseHash: interaction.rawResponseHash,
    normalizedText: interaction.normalizedText,
    parseStatus: interaction.parseStatus,
    parsedSubQuestions: input.structuredIndex.decompositionRecords,
  };
};

const buildSubQuestionAnalyses = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  interactions: readonly ResearchInteraction[];
  answers: readonly ResearchAnswer[];
}): DeepResearchFullCaseFile["subQuestionAnalyses"] => {
  const interactionById = buildInteractionById(input.interactions);
  const analysisInteractionBySubQuestionId = buildAnalysisInteractionBySubQuestionId(input.interactions);
  const answerBySubQuestionId = buildAnswerBySubQuestionId(input.answers);
  return input.subQuestions.map((subQuestion) => {
    const answer = answerBySubQuestionId.get(subQuestion.id) ?? null;
    const interaction = answer ? (interactionById.get(answer.interactionId) ?? null) : (analysisInteractionBySubQuestionId.get(subQuestion.id) ?? null);
    return {
      subQuestionId: subQuestion.id,
      modelQuestionId: subQuestion.modelQuestionId,
      title: subQuestion.question.title,
      questionText: subQuestion.question.questionText,
      promptInteraction: buildPromptInteraction(interaction),
      structuredAnswer: buildStructuredAnswer(answer),
      structuredAnswerStatus: answer ? "parsed" : interaction && isRawAvailableParseFailure(interaction) ? "parse_failed_raw_available" : "missing",
    };
  });
};

const buildFailedButRawAvailableInteractions = (interactions: readonly ResearchInteraction[]): DeepResearchFullCaseFile["failedButRawAvailableInteractions"] =>
  interactions.filter(isRawAvailableParseFailure).map((interaction) => ({
    interactionId: interaction.id,
    phase: interaction.phase,
    subQuestionId: interaction.subQuestionId,
    promptId: interaction.promptId,
    renderedPromptText: interaction.renderedPromptText,
    rawResponseText: interaction.rawResponseText,
    rawResponseHash: interaction.rawResponseHash,
    parseStatus: interaction.parseStatus,
  }));

const loadFullCaseFileState = (
  store: DeepResearchRecordStore,
  jobId: string,
): {
  job: ResearchJob;
  researchPlan: DeepResearchFullCaseFile["researchPlan"];
  inputAttachments: DeepResearchFullCaseFile["inputAttachments"];
  interactions: ResearchInteraction[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
} => {
  const job = store.getJob(jobId);
  const researchPlan = store.getResearchPlan(jobId);
  if (!job) {
    throw new Error(`Deep research job ${jobId} was not found.`);
  }
  if (!researchPlan) {
    throw new Error(`Deep research job ${jobId} has no persisted ResearchPlan.`);
  }
  return {
    job,
    researchPlan,
    inputAttachments: job.inputAttachments,
    interactions: store.listInteractions(jobId),
    subQuestions: store.listSubQuestions(jobId),
    answers: store.listAnswers({ jobId, answerKind: "analysis" }),
  };
};

export const buildDeepResearchFullCaseFile = (input: { store: DeepResearchRecordStore; jobId: string; structuredIndex: DeepResearchStructuredIndex }): DeepResearchFullCaseFile => {
  const state = loadFullCaseFileState(input.store, input.jobId);
  const fullCaseFile: DeepResearchFullCaseFile = {
    caseFileVersion: "v1",
    job: {
      jobId: state.job.id,
      userQuestion: state.job.userQuestion,
      analysisGoal: state.job.analysisGoal,
      language: state.job.language,
      createdAt: state.job.createdAt,
    },
    researchPlan: state.researchPlan,
    inputAttachments: state.inputAttachments,
    decomposition: buildDecompositionCase({
      interactions: state.interactions,
      structuredIndex: input.structuredIndex,
    }),
    subQuestionAnalyses: buildSubQuestionAnalyses({
      subQuestions: state.subQuestions,
      interactions: state.interactions,
      answers: state.answers,
    }),
    failedButRawAvailableInteractions: buildFailedButRawAvailableInteractions(state.interactions),
    structuredIndex: input.structuredIndex,
    sourceNotes: input.structuredIndex.sourceNotes,
    recordHashes: input.structuredIndex.recordHashes,
    coverage: buildCoverage({
      subQuestions: state.subQuestions,
      answers: state.answers,
      interactions: state.interactions,
    }),
  };
  return DeepResearchFullCaseFileSchema.parse(fullCaseFile) as DeepResearchFullCaseFile;
};

const fencedBlock = (value: string, language = "text"): string => {
  const normalized = value.trim();
  if (!normalized) {
    return "_empty_";
  }
  return ["```" + language, normalized, "```"].join("\n");
};

const jsonBlock = (value: unknown): string => fencedBlock(JSON.stringify(value, null, 2), "json");

const buildMetadataLines = (input: DeepResearchFullCaseFile): string[] => [
  `- Job ID: ${input.job.jobId}`,
  `- User Question: ${input.job.userQuestion}`,
  `- Analysis Goal: ${input.job.analysisGoal ?? "UNAVAILABLE"}`,
  `- Language: ${input.job.language}`,
  `- Created At: ${input.job.createdAt}`,
  `- Total Sub-questions: ${input.coverage.totalSubQuestionCount}`,
  `- Structured Analysis Count: ${input.coverage.structuredAnalysisCount}`,
  `- Raw Analysis Interaction Count: ${input.coverage.rawAnalysisInteractionCount}`,
  `- Structured Coverage Ratio: ${input.coverage.structuredCoverageRatio}`,
  `- Raw Coverage Ratio: ${input.coverage.rawCoverageRatio}`,
];

const buildInputAttachmentsSection = (input: DeepResearchFullCaseFile): string => {
  if (input.inputAttachments.length === 0) {
    return ["## Input Attachments", "_No input attachments were supplied._"].join("\n\n");
  }
  return [
    "## Input Attachments",
    ...input.inputAttachments.map((attachment) => [
      `### ${attachment.summary}`,
      `- Attachment ID: ${attachment.id}`,
      `- File Path: ${attachment.filePath}`,
      `- MIME Type: ${attachment.mimeType ?? "UNAVAILABLE"}`,
      `- File Hash: ${attachment.fileHash ?? "UNAVAILABLE"}`,
      `- File Size Bytes: ${attachment.fileSizeBytes ?? "UNAVAILABLE"}`,
      `- Source Kind: ${attachment.sourceKind}`,
    ].join("\n")),
  ].join("\n\n");
};

const buildDecompositionSection = (input: DeepResearchFullCaseFile): string => {
  if (!input.decomposition) {
    return ["## Decomposition", "_No decomposition interaction was persisted._"].join("\n\n");
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

const buildSubQuestionSection = (entry: DeepResearchFullCaseFile["subQuestionAnalyses"][number]): string =>
  [
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
          entry.promptInteraction.providerProofJson ? ["#### Provider Proof JSON", fencedBlock(entry.promptInteraction.providerProofJson, "json")].join("\n\n") : null,
        ]
          .filter((section): section is string => Boolean(section))
          .join("\n\n")
      : "_No prompt interaction was persisted for this sub-question._",
    entry.structuredAnswer ? ["#### Structured Answer", jsonBlock(entry.structuredAnswer)].join("\n\n") : "_No structured answer was persisted for this sub-question._",
  ].join("\n\n");

const buildFailedInteractionSection = (input: DeepResearchFullCaseFile): string => {
  if (input.failedButRawAvailableInteractions.length === 0) {
    return ["## Failed But Raw Available Interactions", "_No raw-preserved parse failures were recorded._"].join("\n\n");
  }
  return [
    "## Failed But Raw Available Interactions",
    ...input.failedButRawAvailableInteractions.map((interaction) =>
      [
        `### ${interaction.phase} / ${interaction.subQuestionId ?? interaction.interactionId}`,
        `- Interaction ID: ${interaction.interactionId}`,
        `- Prompt ID: ${interaction.promptId}`,
        `- Parse Status: ${interaction.parseStatus}`,
        `- Raw Response Hash: ${interaction.rawResponseHash}`,
        "#### Rendered Prompt",
        fencedBlock(interaction.renderedPromptText),
        "#### Raw Response",
        fencedBlock(interaction.rawResponseText),
      ].join("\n\n"),
    ),
  ].join("\n\n");
};

export const renderDeepResearchFullCaseFileMarkdown = (input: DeepResearchFullCaseFile): string =>
  [
    "# Deep Research Full Case File",
    "The structured index is not the complete case file.",
    "The raw interactions below remain the sovereign record for final adjudication and HTML publishing.",
    buildMetadataLines(input).join("\n"),
    buildInputAttachmentsSection(input),
    buildDecompositionSection(input),
    "## Sub-question Analyses",
    input.subQuestionAnalyses.length > 0 ? input.subQuestionAnalyses.map(buildSubQuestionSection).join("\n\n") : "_No sub-question analysis records were persisted._",
    buildFailedInteractionSection(input),
    "## Structured Index",
    jsonBlock(input.structuredIndex),
  ].join("\n\n");

const buildTextHash = (value: string): string => "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const writeTextArtifact = (filePath: string, text: string): { filePath: string; fileHash: string } => {
  const fileHash = buildTextHash(text);
  writeFileSync(filePath, `${text.trimEnd()}\n`, "utf8");
  return { filePath, fileHash };
};

const writeJsonArtifact = <TPayload>(filePath: string, payload: TPayload): { filePath: string; fileHash: string } => {
  const fileHash = stableJsonHash(payload);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { filePath, fileHash };
};

export type DeepResearchFullCaseFileExports = {
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdownText: string;
  fullCaseFileJson: ResearchExport;
  fullCaseFileMarkdown: ResearchExport;
};

export const saveFullCaseFileExports = (input: { store: DeepResearchRecordStore; jobId: string; exportDir: string; fullCaseFile: DeepResearchFullCaseFile }): DeepResearchFullCaseFileExports => {
  mkdirSync(input.exportDir, { recursive: true });
  const fullCaseFileMarkdownText = renderDeepResearchFullCaseFileMarkdown(input.fullCaseFile);
  const fullCaseFileJsonArtifact = writeJsonArtifact(path.join(input.exportDir, "full-case-file.json"), input.fullCaseFile);
  const fullCaseFileMarkdownArtifact = writeTextArtifact(path.join(input.exportDir, "full-case-file.md"), fullCaseFileMarkdownText);
  return {
    fullCaseFile: input.fullCaseFile,
    fullCaseFileMarkdownText,
    fullCaseFileJson: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "full-case-file.json",
      filePath: fullCaseFileJsonArtifact.filePath,
      fileHash: fullCaseFileJsonArtifact.fileHash,
      payload: input.fullCaseFile,
    }),
    fullCaseFileMarkdown: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "full-case-file.md",
      filePath: fullCaseFileMarkdownArtifact.filePath,
      fileHash: fullCaseFileMarkdownArtifact.fileHash,
      payload: {
        fullCaseFileJsonHash: fullCaseFileJsonArtifact.fileHash,
        content: fullCaseFileMarkdownText,
      },
    }),
  };
};
