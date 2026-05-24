import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  buildDeepResearchFinalPackage,
  type DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import type { DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
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
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type DeepResearchHistorySnapshot,
  type DeepResearchJobSnapshot,
  type DeepResearchReportViewModel,
  type DeepResearchTimelineEntry,
  type DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";
import {
  buildParsedEntry,
  buildPromptText,
} from "./deep-research-analysis.public-prompt-support.js";
import {
  buildAnswerByKindAndSubQuestionId,
  buildConclusionView,
  buildConflictBySubQuestionId,
  buildEvidenceViews,
  buildHistoryJobView,
  buildReportExportViews,
  buildReportJobView,
  buildReportSubQuestionViews,
  buildStageViews,
  buildSubQuestionReports,
  buildTimelineByPhaseAndSubQuestionId,
} from "./deep-research-analysis.public-report-support.js";
import { mapJobRow } from "./deep-research-analysis.record-db.js";

export type DeepResearchExportArtifactPayload = {
  jobId: string;
  kind: ResearchExportKind;
  fileName: string;
  filePath: string;
  contentType: "text/markdown" | "application/json" | "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  fileHash: string;
  payloadHash: string;
  textContent?: string;
  jsonContent?: unknown;
  base64Content?: string;
};

const JOB_STATUSES: readonly ResearchJob["status"][] = [
  "queued",
  "running",
  "completed",
  "deck_export_partial",
  "review_required",
  "failed",
];

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
      "SELECT id FROM research_jobs ORDER BY updated_at DESC, created_at DESC LIMIT 1",
    ).get() as { id: string } | undefined;
    return row?.id ?? null;
  } finally {
    db.close();
  }
};

const listJobs = (input: {
  dataDir: string;
  limit?: number;
  status?: ResearchJob["status"];
}): ResearchJob[] => {
  const dbPath = resolveDbPath(input.dataDir);
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    if (input.status && JOB_STATUSES.includes(input.status)) {
      const rows = db.prepare(
        `SELECT * FROM research_jobs
         WHERE status = ?
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ?`,
      ).all(input.status, limit) as Parameters<typeof mapJobRow>[0][];
      return rows.map((row) => mapJobRow(row));
    }
    const rows = db.prepare(
      `SELECT * FROM research_jobs
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    ).all(limit) as Parameters<typeof mapJobRow>[0][];
    return rows.map((row) => mapJobRow(row));
  } finally {
    db.close();
  }
};

const inferCurrentPhase = (input: {
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
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
  if (input.subQuestions.length === 0) {
    return "DECOMPOSE_PARSE";
  }
  return input.job.flowMode === "default_1_n_1" || input.job.flowMode === "default_1_n_1_1"
    ? inferDefaultFlowPhase({
      subQuestions: input.subQuestions,
      analysisAnswers: input.analysisAnswers,
      finalReport: input.finalReport,
    })
    : inferLegacyFlowPhase({
      subQuestions: input.subQuestions,
      positiveAnswers: input.positiveAnswers,
      falsificationAnswers: input.falsificationAnswers,
      finalReport: input.finalReport,
    });
};

const inferDefaultFlowPhase = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
}): DeepResearchPhase => {
  if (input.analysisAnswers.length < input.subQuestions.length) {
    return "ANALYSIS_PERSIST";
  }
  return input.finalReport ? "FINAL_ADJUDICATION_PERSIST" : "FINAL_PACKAGE_BUILD";
};

const inferLegacyFlowPhase = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
}): DeepResearchPhase => {
  if (input.finalReport) {
    return "FINAL_PERSIST";
  }
  if (input.positiveAnswers.length < input.subQuestions.length) {
    return "POSITIVE_PERSIST";
  }
  return input.falsificationAnswers.length < input.subQuestions.length
    ? "FALSIFY_PERSIST"
    : "FINAL_PACKAGE_BUILD";
};

const buildJobSnapshot = (input: {
  job: ResearchJob;
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
  exports: readonly ResearchExport[];
}): DeepResearchJobSnapshot => {
  const analysisAnswers = input.answers.filter((record) => record.answerKind === "analysis");
  const positiveAnswers = input.answers.filter((record) => record.answerKind === "positive");
  const falsificationAnswers = input.answers.filter((record) => record.answerKind === "falsification");
  return {
    job: input.job,
    overview: {
      currentPhase: inferCurrentPhase({
        job: input.job,
        subQuestions: input.subQuestions,
        analysisAnswers,
        positiveAnswers,
        falsificationAnswers,
        finalReport: input.finalReport,
        exports: input.exports,
      }),
      interactionCount: input.interactions.length,
      subQuestionCount: input.subQuestions.length,
      analysisCount: analysisAnswers.length,
      positiveCount: positiveAnswers.length,
      falsificationCount: falsificationAnswers.length,
      exportCount: input.exports.length,
    },
    finalReport: input.finalReport,
    exports: [...input.exports],
  };
};

const buildTimelineEntries = (input: {
  interactions: readonly ResearchInteraction[];
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  finalPackage: DeepResearchFinalPackage | null;
  finalReportRecord: { id: string; report: DeepResearchFinalReport } | null;
}): DeepResearchTimelineEntry[] => {
  const subQuestionById = new Map(input.subQuestions.map((record) => [record.id, record]));
  const answersByInteractionId = new Map(
    input.answers.map((record) => [record.interactionId, record]),
  );
  return input.interactions.map((interaction): DeepResearchTimelineEntry => {
    const prompt = buildPromptText({
      job: input.job,
      interaction,
      subQuestionById,
      positiveAnswerBySubQuestionId: input.positiveAnswerBySubQuestionId,
      finalPackage: input.finalPackage,
    });
    const parsed = buildParsedEntry({
      interaction,
      subQuestions: input.subQuestions,
      answersByInteractionId,
      finalReportRecord: input.finalReportRecord,
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
      providerKind: interaction.providerKind,
      providerProofJson: interaction.providerProofJson,
      promptReconstructionStatus: prompt.promptReconstructionStatus,
    };
  });
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
    const positiveAnswerBySubQuestionId = new Map(
      answers
        .filter((record) => record.answerKind === "positive")
        .map((record) => [record.subQuestionId, record]),
    );
    const finalPackage = interactions.some((record) =>
      record.phase === "final_synthesis" || record.phase === "final_adjudication")
      ? buildDeepResearchFinalPackage({ store, jobId })
      : null;
    const timeline = buildTimelineEntries({
      interactions,
      job,
      subQuestions,
      answers,
      positiveAnswerBySubQuestionId,
      finalPackage,
      finalReportRecord: finalReportRecord
        ? { id: finalReportRecord.id, report: finalReportRecord.report }
        : null,
    });
    return {
      job,
      overview: buildJobSnapshot({
        job,
        interactions,
        subQuestions,
        answers,
        finalReport: finalReportRecord?.report ?? null,
        exports,
      }).overview,
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

const buildReportViewModel = (dataDir: string, jobId: string): DeepResearchReportViewModel | null => {
  const snapshot = buildTimelineSnapshot(dataDir, jobId);
  if (!snapshot) {
    return null;
  }
  const subQuestions = buildReportSubQuestionViews(snapshot.subQuestions);
  const subQuestionById = new Map(subQuestions.map((record) => [record.id, record]));
  const timelineByPhaseAndSubQuestionId = buildTimelineByPhaseAndSubQuestionId(snapshot.timeline);
  const answerByKindAndSubQuestionId = buildAnswerByKindAndSubQuestionId(snapshot.answers);
  const conflictBySubQuestionId = buildConflictBySubQuestionId(snapshot.conflictMatrix);
  const subQuestionReports = buildSubQuestionReports({
    subQuestions,
    timelineByPhaseAndSubQuestionId,
    answerByKindAndSubQuestionId,
    conflictBySubQuestionId,
  });
  const decompositionInteraction = snapshot.timeline.find((entry) => entry.phase === "decomposition") ?? null;
  const finalInteraction = [...snapshot.timeline]
    .reverse()
    .find((entry) => entry.phase === "final_adjudication" || entry.phase === "final_synthesis") ?? null;
  const exportViews = buildReportExportViews(snapshot.exports);
  const outlineExport = snapshot.exports.find((entry) => entry.exportKind === "business-deck-outline.json") ?? null;
  const pptxExport = snapshot.exports.find((entry) => entry.exportKind === "business-deck.pptx") ?? null;
  const deckOutline = outlineExport
    ? JSON.parse(readFileSync(outlineExport.filePath, "utf8")) as DeepResearchBusinessDeckOutline
    : null;
  return {
    job: buildReportJobView(snapshot),
    conclusion: buildConclusionView(snapshot.finalReport),
    stages: buildStageViews({
      job: snapshot.job,
      decompositionInteraction,
      subQuestionReports,
      finalInteraction,
      finalReport: snapshot.finalReport,
    }),
    decomposition: {
      interaction: decompositionInteraction,
      subQuestions,
    },
    subQuestionReports,
    finalAdjudication: {
      interaction: finalInteraction,
      parsedFinalReport: snapshot.finalReport,
    },
    businessDeck: outlineExport
      ? {
        generatedAt: pptxExport?.createdAt ?? outlineExport.createdAt,
        outlineExport: exportViews.find((entry) => entry.exportKind === "business-deck-outline.json") ?? null,
        pptxExport: exportViews.find((entry) => entry.exportKind === "business-deck.pptx") ?? null,
        deckTitle: deckOutline?.deckTitle ?? null,
        deckSubtitle: deckOutline?.deckSubtitle ?? null,
        audience: deckOutline?.audience ?? null,
        slideCount: deckOutline?.slides.length ?? 0,
        warnings: deckOutline?.deckWarnings ?? [],
        preservationSummary: deckOutline
          ? {
            usedRankedConclusionCount: deckOutline.contentPreservationSummary.usedRankedConclusionCount,
            usedReverseConditionCount: deckOutline.contentPreservationSummary.usedReverseConditionCount,
            usedEvidenceGapCount: deckOutline.contentPreservationSummary.usedEvidenceGapCount,
            usedReferenceCount: deckOutline.contentPreservationSummary.usedReferenceCount,
            omittedItemCount: deckOutline.contentPreservationSummary.omittedItems.length,
          }
          : null,
        slideSummaries: deckOutline?.slides.map((slide) => ({
          slideNumber: slide.slideNumber,
          slideType: slide.slideType,
          title: slide.title,
          headline: slide.headline,
        })) ?? [],
      }
      : null,
    evidence: buildEvidenceViews({ timeline: snapshot.timeline, subQuestionById }),
    exports: exportViews,
  };
};

export const getDeepResearchAnalysisJob = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchJobSnapshot | null => buildJobSnapshotForId(input.dataDir, input.jobId);

export const getLatestDeepResearchAnalysisJob = (input: {
  dataDir: string;
}): DeepResearchJobSnapshot | null => {
  const latestJobId = readLatestJobId(input.dataDir);
  return latestJobId ? buildJobSnapshotForId(input.dataDir, latestJobId) : null;
};

export const getDeepResearchAnalysisTimeline = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchTimelineSnapshot | null => buildTimelineSnapshot(input.dataDir, input.jobId);

export const listDeepResearchAnalysisHistory = (input: {
  dataDir: string;
  limit?: number;
  status?: ResearchJob["status"];
}): DeepResearchHistorySnapshot =>
  withStore(input.dataDir, (store) => ({
    jobs: listJobs(input).map((job) => buildHistoryJobView({ store, job })),
  }));

export const getDeepResearchAnalysisReport = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchReportViewModel | null => buildReportViewModel(input.dataDir, input.jobId);

export const deleteDeepResearchAnalysisJob = (input: {
  dataDir: string;
  jobId: string;
}): { deleted: boolean; jobId: string } =>
  withStore(input.dataDir, (store) => {
    const job = store.getJob(input.jobId);
    if (!job) {
      return { deleted: false, jobId: input.jobId };
    }
    const exportedPaths = store.listExports(input.jobId).map((record) => record.filePath);
    const deleted = store.deleteJob(input.jobId);
    for (const filePath of exportedPaths) {
      rmSync(filePath, { force: true });
    }
    rmSync(path.join(input.dataDir, "deep-research-analysis", "exports", input.jobId), {
      force: true,
      recursive: true,
    });
    return { deleted, jobId: input.jobId };
  });

export const getDeepResearchExportArtifact = (input: {
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
    if (input.kind === "business-deck.pptx") {
      return {
        jobId: input.jobId,
        kind: input.kind,
        fileName,
        filePath: exported.filePath,
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileHash: exported.fileHash,
        payloadHash: exported.payloadHash,
        base64Content: readFileSync(exported.filePath).toString("base64"),
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
