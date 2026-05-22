import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  buildDeepResearchFinalPackage,
  type DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import {
  runDeepResearchAnalysis,
  type DeepResearchAnalysisContext,
} from "./deep-research-analysis.flow.js";
import {
  buildRenderedDeepResearchPromptHash,
  decompositionPrompt,
  falsificationPrompt,
  finalSynthesisPrompt,
  positiveAnalysisPrompt,
  renderDeepResearchDecompositionPrompt,
  renderDeepResearchFalsificationPrompt,
  renderDeepResearchFinalSynthesisPrompt,
  renderDeepResearchPositivePrompt,
} from "./deep-research-analysis.prompts.js";
import {
  createDeepResearchRecordStore,
  DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH,
  type ResearchAnswer,
  type ResearchConflictMatrix,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type {
  DeepResearchInput,
  DeepResearchPhase,
} from "./deep-research-analysis.schema.js";

type PromptReconstructionStatus = "verified" | "hash_mismatch" | "unavailable";

type DeepResearchTimelineEntry = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  subQuestionId: string | null;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  rawResponseHash: string;
  promptText: string | null;
  rawResponseText: string;
  parsedSummary: string;
  parsedJson: unknown;
  parsedRecordIds: string[];
  createdAt: string;
  domRef: string | null;
  promptReconstructionStatus: PromptReconstructionStatus;
};

export type DeepResearchJobSnapshot = {
  job: ResearchJob;
  overview: {
    currentPhase: DeepResearchPhase;
    interactionCount: number;
    subQuestionCount: number;
    positiveCount: number;
    falsificationCount: number;
    exportCount: number;
  };
  finalReport: DeepResearchFinalReport | null;
  exports: ResearchExport[];
};

export type DeepResearchTimelineSnapshot = {
  job: ResearchJob;
  timeline: DeepResearchTimelineEntry[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
  conflictMatrix: ResearchConflictMatrix[];
  finalReport: DeepResearchFinalReport | null;
  exports: ResearchExport[];
};

export type DeepResearchExportArtifactPayload = {
  jobId: string;
  kind: ResearchExportKind;
  fileName: string;
  filePath: string;
  contentType: "text/markdown" | "application/json";
  fileHash: string;
  payloadHash: string;
  textContent?: string;
  jsonContent?: unknown;
};

const truncateText = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
};

const resolveDbPath = (dataDir: string): string =>
  path.join(dataDir, DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH);

const withStore = <T>(
  dataDir: string,
  action: (store: ReturnType<typeof createDeepResearchRecordStore>) => T,
): T => {
  const store = createDeepResearchRecordStore(dataDir);
  try {
    return action(store);
  } finally {
    store.close();
  }
};

const readLatestJobId = (dataDir: string): string | null => {
  const dbPath = resolveDbPath(dataDir);
  if (!existsSync(dbPath)) {
    return null;
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare(
      `SELECT id FROM research_jobs ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    ).get() as { id: string } | undefined;
    return row?.id ?? null;
  } finally {
    db.close();
  }
};

const inferCurrentPhase = (input: {
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
  exports: readonly ResearchExport[];
}): DeepResearchPhase => {
  if (input.job.status !== "queued") {
    return input.job.phase;
  }
  if (input.exports.length > 0) {
    return "EXPORT_REPORT";
  }
  if (input.finalReport) {
    return "FINAL_PERSIST";
  }
  if (input.subQuestions.length === 0) {
    return "DECOMPOSE_PARSE";
  }
  if (input.positiveAnswers.length < input.subQuestions.length) {
    return "POSITIVE_PERSIST";
  }
  if (input.falsificationAnswers.length < input.subQuestions.length) {
    return "FALSIFY_PERSIST";
  }
  return "FINAL_PACKAGE_BUILD";
};

const buildJobSnapshot = (input: {
  job: ResearchJob;
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
  exports: readonly ResearchExport[];
}): DeepResearchJobSnapshot => {
  const positiveAnswers = input.answers.filter((record) => record.answerKind === "positive");
  const falsificationAnswers = input.answers.filter((record) => record.answerKind === "falsification");
  return {
    job: input.job,
    overview: {
      currentPhase: inferCurrentPhase({
        job: input.job,
        subQuestions: input.subQuestions,
        positiveAnswers,
        falsificationAnswers,
        finalReport: input.finalReport,
        exports: input.exports,
      }),
      interactionCount: input.interactions.length,
      subQuestionCount: input.subQuestions.length,
      positiveCount: positiveAnswers.length,
      falsificationCount: falsificationAnswers.length,
      exportCount: input.exports.length,
    },
    finalReport: input.finalReport,
    exports: [...input.exports],
  };
};

const renderVerifiedPrompt = (input: {
  interaction: ResearchInteraction;
  promptText: string | null;
  promptDefinition:
    | typeof decompositionPrompt
    | typeof positiveAnalysisPrompt
    | typeof falsificationPrompt
    | typeof finalSynthesisPrompt;
}): { promptText: string | null; promptReconstructionStatus: PromptReconstructionStatus } => {
  if (!input.promptText) {
    return { promptText: null, promptReconstructionStatus: "unavailable" };
  }
  const renderedHash = buildRenderedDeepResearchPromptHash({
    prompt: input.promptDefinition,
    renderedPromptText: input.promptText,
  });
  return {
    promptText: input.promptText,
    promptReconstructionStatus:
      renderedHash === input.interaction.promptHash ? "verified" : "hash_mismatch",
  };
};

const buildPromptText = (input: {
  job: ResearchJob;
  interaction: ResearchInteraction;
  subQuestionById: Map<string, ResearchSubQuestion>;
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  finalPackage: DeepResearchFinalPackage | null;
}): { promptText: string | null; promptReconstructionStatus: PromptReconstructionStatus } => {
  if (input.interaction.phase === "decomposition") {
    return renderVerifiedPrompt({
      interaction: input.interaction,
      promptText: renderDeepResearchDecompositionPrompt({
        userQuestion: input.job.userQuestion,
        analysisGoal: input.job.analysisGoal,
        language: input.job.language,
        maxSubQuestions: input.job.maxSubQuestions,
      }),
      promptDefinition: decompositionPrompt,
    });
  }
  const subQuestionId = input.interaction.subQuestionId;
  const subQuestion = subQuestionId ? input.subQuestionById.get(subQuestionId) : undefined;
  if (!subQuestion) {
    return { promptText: null, promptReconstructionStatus: "unavailable" };
  }
  if (input.interaction.phase === "positive") {
    return renderVerifiedPrompt({
      interaction: input.interaction,
      promptText: renderDeepResearchPositivePrompt({
        userQuestion: input.job.userQuestion,
        analysisGoal: input.job.analysisGoal,
        language: input.job.language,
        subQuestion: subQuestion.question,
      }),
      promptDefinition: positiveAnalysisPrompt,
    });
  }
  if (input.interaction.phase === "falsification") {
    if (!subQuestionId) {
      return { promptText: null, promptReconstructionStatus: "unavailable" };
    }
    const positiveAnswer = input.positiveAnswerBySubQuestionId.get(subQuestionId);
    if (!positiveAnswer) {
      return { promptText: null, promptReconstructionStatus: "unavailable" };
    }
    return renderVerifiedPrompt({
      interaction: input.interaction,
      promptText: renderDeepResearchFalsificationPrompt({
        userQuestion: input.job.userQuestion,
        analysisGoal: input.job.analysisGoal,
        language: input.job.language,
        subQuestion: subQuestion.question,
        positiveAnswer,
      }),
      promptDefinition: falsificationPrompt,
    });
  }
  if (!input.finalPackage) {
    return { promptText: null, promptReconstructionStatus: "unavailable" };
  }
  return renderVerifiedPrompt({
    interaction: input.interaction,
    promptText: renderDeepResearchFinalSynthesisPrompt({
      userQuestion: input.job.userQuestion,
      analysisGoal: input.job.analysisGoal,
      language: input.job.language,
      finalPackage: input.finalPackage,
    }),
    promptDefinition: finalSynthesisPrompt,
  });
};

const buildParsedEntry = (input: {
  interaction: ResearchInteraction;
  subQuestions: readonly ResearchSubQuestion[];
  answersByInteractionId: Map<string, ResearchAnswer>;
  finalReportRecord: { id: string; report: DeepResearchFinalReport } | null;
}): { parsedSummary: string; parsedJson: unknown; parsedRecordIds: string[] } => {
  if (input.interaction.phase === "decomposition") {
    const parsedRecords = input.subQuestions.filter(
      (record) => record.interactionId === input.interaction.id,
    );
    return {
      parsedSummary: `${parsedRecords.length} sub-questions parsed`,
      parsedJson: parsedRecords.map((record) => record.question),
      parsedRecordIds: parsedRecords.map((record) => record.id),
    };
  }
  if (input.interaction.phase === "positive" || input.interaction.phase === "falsification") {
    const answer = input.answersByInteractionId.get(input.interaction.id);
    if (!answer) {
      return {
        parsedSummary: "Parsed record unavailable.",
        parsedJson: null,
        parsedRecordIds: [],
      };
    }
    return {
      parsedSummary: truncateText(answer.answerText),
      parsedJson: answer,
      parsedRecordIds: [answer.id],
    };
  }
  if (!input.finalReportRecord) {
    return {
      parsedSummary: "Final report unavailable.",
      parsedJson: null,
      parsedRecordIds: [],
    };
  }
  return {
    parsedSummary: truncateText(input.finalReportRecord.report.executiveConclusion),
    parsedJson: input.finalReportRecord.report,
    parsedRecordIds: [input.finalReportRecord.id],
  };
};

const buildTimelineSnapshot = (dataDir: string, jobId: string): DeepResearchTimelineSnapshot | null =>
  withStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const conflictMatrix = store.listConflictMatrix(jobId);
    const finalReportRecord = store.getLatestFinalReport(jobId);
    const exports = store.listExports(jobId);
    const subQuestionById = new Map(subQuestions.map((record) => [record.id, record]));
    const answersByInteractionId = new Map(answers.map((record) => [record.interactionId, record]));
    const positiveAnswerBySubQuestionId = new Map(
      answers
        .filter((record) => record.answerKind === "positive")
        .map((record) => [record.subQuestionId, record]),
    );
    const finalPackage = interactions.some((record) => record.phase === "final_synthesis")
      ? buildDeepResearchFinalPackage({ store, jobId })
      : null;
    const timeline = interactions.map((interaction) => {
      const prompt = buildPromptText({
        job,
        interaction,
        subQuestionById,
        positiveAnswerBySubQuestionId,
        finalPackage,
      });
      const parsed = buildParsedEntry({
        interaction,
        subQuestions,
        answersByInteractionId,
        finalReportRecord: finalReportRecord
          ? { id: finalReportRecord.id, report: finalReportRecord.report }
          : null,
      });
      return {
        interactionId: interaction.id,
        phase: interaction.phase,
        subQuestionId: interaction.subQuestionId,
        promptId: interaction.promptId,
        promptVersion: interaction.promptVersion,
        promptHash: interaction.promptHash,
        rawResponseHash: interaction.rawResponseHash,
        promptText: prompt.promptText,
        rawResponseText: interaction.rawResponseText,
        parsedSummary: parsed.parsedSummary,
        parsedJson: parsed.parsedJson,
        parsedRecordIds: parsed.parsedRecordIds,
        createdAt: interaction.createdAt,
        domRef: interaction.domRef,
        promptReconstructionStatus: prompt.promptReconstructionStatus,
      };
    });
    return {
      job,
      timeline,
      subQuestions,
      answers,
      conflictMatrix,
      finalReport: finalReportRecord?.report ?? null,
      exports,
    };
  });

const buildJobSnapshotForId = (dataDir: string, jobId: string): DeepResearchJobSnapshot | null =>
  withStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const finalReport = store.getLatestFinalReport(jobId)?.report ?? null;
    const exports = store.listExports(jobId);
    return buildJobSnapshot({
      job,
      interactions,
      subQuestions,
      answers,
      finalReport,
      exports,
    });
  });

const getDeepResearchAnalysisJob = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchJobSnapshot | null => buildJobSnapshotForId(input.dataDir, input.jobId);

const getLatestDeepResearchAnalysisJob = (input: {
  dataDir: string;
}): DeepResearchJobSnapshot | null => {
  const latestJobId = readLatestJobId(input.dataDir);
  return latestJobId ? buildJobSnapshotForId(input.dataDir, latestJobId) : null;
};

const getDeepResearchAnalysisTimeline = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchTimelineSnapshot | null => buildTimelineSnapshot(input.dataDir, input.jobId);

const getDeepResearchExportArtifact = (input: {
  dataDir: string;
  jobId: string;
  kind: ResearchExportKind;
}): DeepResearchExportArtifactPayload | null =>
  withStore(input.dataDir, (store) => {
    const exported = store.listExports(input.jobId).find((record) => record.exportKind === input.kind);
    if (!exported || !existsSync(exported.filePath)) {
      return null;
    }
    const fileName = path.basename(exported.filePath);
    if (input.kind === "final-report.md") {
      return {
        jobId: input.jobId,
        kind: input.kind,
        fileName,
        filePath: exported.filePath,
        contentType: "text/markdown",
        fileHash: exported.fileHash,
        payloadHash: exported.payloadHash,
        textContent: readFileSync(exported.filePath, "utf8"),
      };
    }
    return {
      jobId: input.jobId,
      kind: input.kind,
      fileName,
      filePath: exported.filePath,
      contentType: "application/json",
      fileHash: exported.fileHash,
      payloadHash: exported.payloadHash,
      jsonContent: JSON.parse(readFileSync(exported.filePath, "utf8")) as unknown,
    };
  });

export const deepResearchAnalysisPublicFacade = {
  runDeepResearchAnalysis,
  getDeepResearchAnalysisJob,
  getLatestDeepResearchAnalysisJob,
  getDeepResearchAnalysisTimeline,
  getDeepResearchExportArtifact,
} as const;
export type DeepResearchAnalysisStartInput = DeepResearchInput & {
  providerKind: DeepResearchAnalysisContext["providerKind"];
};