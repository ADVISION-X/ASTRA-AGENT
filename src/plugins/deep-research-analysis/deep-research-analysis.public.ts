import Database from "better-sqlite3";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { runDeepResearchAnalysis, type DeepResearchAnalysisContext } from "./deep-research-analysis.analysis-runner.js";
export { runDeepResearchAnalysis } from "./deep-research-analysis.analysis-runner.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.parser.js";
import type { DeepResearchTimelineEntry, PromptReconstructionStatus } from "./deep-research-analysis.public-contracts.js";
import { type DeepResearchHistorySnapshot, type DeepResearchJobSnapshot, type DeepResearchPrimaryBusinessReportView, type DeepResearchReportViewModel, type DeepResearchTimelineSnapshot } from "./deep-research-analysis.public-contracts.js";
import {
  buildAnswerByKindAndSubQuestionId,
  buildConclusionView,
  buildEvidenceViews,
  buildFullCaseFileSummary,
  buildHistoryJobView,
  buildReportExportViews,
  buildReportJobView,
  buildReportSubQuestionViews,
  buildResearchPlanView,
  buildStageViews,
  buildSubQuestionReports,
  buildTimelineByPhaseAndSubQuestionId,
} from "./deep-research-analysis.public-report-support.js";
import { mapJobRow } from "./deep-research-analysis.record-db.js";
import type { ResearchAnswer, ResearchInteraction, ResearchSubQuestion } from "./deep-research-analysis.records.js";
import { createDeepResearchRecordStore, DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH, type ResearchExport, type ResearchExportKind, type ResearchJob } from "./deep-research-analysis.records.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import { type DeepResearchInputAttachment, type DeepResearchInputPayload } from "./deep-research-analysis.schema.js";
export { DeepResearchInputSchema } from "./deep-research-analysis.schema.js";
const truncateText = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
};
export const buildPromptText = (input: {
  interaction: ResearchInteraction;
}): {
  promptText: string | null;
  promptReconstructionStatus: PromptReconstructionStatus;
} => {
  if (input.interaction.renderedPromptText.trim().length > 0) {
    return {
      promptText: input.interaction.renderedPromptText,
      promptReconstructionStatus: "verified",
    };
  }
  return {
    promptText: null,
    promptReconstructionStatus: "unavailable",
  };
};
export const buildParsedEntry = (input: {
  interaction: ResearchInteraction;
  subQuestions: readonly ResearchSubQuestion[];
  answersByInteractionId: Map<string, ResearchAnswer>;
  finalAdjudicationRecord: { id: string; finalAdjudication: DeepResearchFinalAdjudicationRecord } | null;
}): Pick<DeepResearchTimelineEntry, "parsedSummary" | "parsedJson" | "parsedRecordIds"> => {
  if (input.interaction.phase === "decomposition") {
    const records = input.subQuestions.filter((record) => record.interactionId === input.interaction.id);
    if (!records.length) {
      return {
        parsedSummary: "No sub-questions were parsed.",
        parsedJson: null,
        parsedRecordIds: [],
      };
    }
    return {
      parsedSummary: truncateText(records.map((record) => record.question.title).join("; ")),
      parsedJson: records.map((record) => record.question),
      parsedRecordIds: records.map((record) => record.id),
    };
  }
  if (input.interaction.phase === "analysis") {
    const answer = input.answersByInteractionId.get(input.interaction.id);
    if (!answer) {
      return {
        parsedSummary: "Answer unavailable.",
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
  if (!input.finalAdjudicationRecord) {
    return {
      parsedSummary: "Final adjudication unavailable.",
      parsedJson: null,
      parsedRecordIds: [],
    };
  }
  return {
    parsedSummary: truncateText(input.finalAdjudicationRecord.finalAdjudication.rawFinalAnswerText),
    parsedJson: input.finalAdjudicationRecord.finalAdjudication.parsedJsonIndex,
    parsedRecordIds: [input.finalAdjudicationRecord.id],
  };
};
const withTimelineStore = <T>(dataDir: string, action: (store: ReturnType<typeof createDeepResearchRecordStore>) => T): T => {
  const store = createDeepResearchRecordStore(dataDir);
  try {
    return action(store);
  } finally {
    store.close();
  }
};
const inferDefaultFlowPhase = (input: { subQuestions: readonly ResearchSubQuestion[]; analysisAnswers: readonly ResearchAnswer[]; finalAdjudication: DeepResearchFinalAdjudicationRecord | null }): DeepResearchPhase => {
  if (input.analysisAnswers.length < input.subQuestions.length) {
    return "ANALYSIS_PERSIST";
  }
  return input.finalAdjudication ? "FINAL_ADJUDICATION_PERSIST" : "FULL_CASE_FILE_BUILD";
};
const inferCurrentPhase = (input: { job: ResearchJob; subQuestions: readonly ResearchSubQuestion[]; analysisAnswers: readonly ResearchAnswer[]; finalAdjudication: DeepResearchFinalAdjudicationRecord | null; exports: readonly ResearchExport[] }): DeepResearchPhase => {
  if (input.job.status !== "queued") {
    return input.job.phase;
  }
  if (input.exports.length > 0) {
    return "EXPORT_REPORT";
  }
  if (input.subQuestions.length === 0) {
    return "DECOMPOSE_PARSE";
  }
  return inferDefaultFlowPhase({
    subQuestions: input.subQuestions,
    analysisAnswers: input.analysisAnswers,
    finalAdjudication: input.finalAdjudication,
  });
};
const buildStoredJobSnapshot = (input: { job: ResearchJob; interactions: readonly ResearchInteraction[]; subQuestions: readonly ResearchSubQuestion[]; answers: readonly ResearchAnswer[]; finalAdjudication: DeepResearchFinalAdjudicationRecord | null; exports: readonly ResearchExport[] }): DeepResearchJobSnapshot => {
  const analysisAnswers = input.answers.filter((record) => record.answerKind === "analysis");
  return {
    job: input.job,
    overview: {
      currentPhase: inferCurrentPhase({
        job: input.job,
        subQuestions: input.subQuestions,
        analysisAnswers,
        finalAdjudication: input.finalAdjudication,
        exports: input.exports,
      }),
      interactionCount: input.interactions.length,
      subQuestionCount: input.subQuestions.length,
      analysisCount: analysisAnswers.length,
      exportCount: input.exports.length,
    },
    finalAdjudication: input.finalAdjudication,
    exports: [...input.exports],
  };
};
const buildTimelineEntries = (input: { interactions: readonly ResearchInteraction[]; subQuestions: readonly ResearchSubQuestion[]; answers: readonly ResearchAnswer[]; finalAdjudicationRecord: { id: string; finalAdjudication: DeepResearchFinalAdjudicationRecord } | null }): DeepResearchTimelineEntry[] => {
  const answersByInteractionId = new Map(input.answers.map((record) => [record.interactionId, record]));
  return input.interactions.map((interaction): DeepResearchTimelineEntry => {
    const prompt = buildPromptText({
      interaction,
    });
    const parsed = buildParsedEntry({
      interaction,
      subQuestions: input.subQuestions,
      answersByInteractionId,
      finalAdjudicationRecord: input.finalAdjudicationRecord,
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
      parseStatus: interaction.parseStatus,
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
export const buildTimelineSnapshot = (dataDir: string, jobId: string): DeepResearchTimelineSnapshot | null =>
  withTimelineStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const researchPlan = store.getResearchPlan(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const finalAdjudicationRecord = store.getLatestFinalAdjudication(jobId);
    const exports = store.listExports(jobId);
    const timeline = buildTimelineEntries({
      interactions,
      subQuestions,
      answers,
      finalAdjudicationRecord: finalAdjudicationRecord ? { id: finalAdjudicationRecord.id, finalAdjudication: finalAdjudicationRecord } : null,
    });
    return {
      job,
      overview: buildStoredJobSnapshot({
        job,
        interactions,
        subQuestions,
        answers,
        finalAdjudication: finalAdjudicationRecord,
        exports,
      }).overview,
      researchPlan,
      timeline,
      subQuestions,
      answers,
      finalAdjudication: finalAdjudicationRecord,
      exports,
    };
  });
export const buildJobSnapshotForId = (dataDir: string, jobId: string): DeepResearchJobSnapshot | null =>
  withTimelineStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const finalAdjudication = store.getLatestFinalAdjudication(jobId);
    const exports = store.listExports(jobId);
    return buildStoredJobSnapshot({
      job,
      interactions,
      subQuestions,
      answers,
      finalAdjudication,
      exports,
    });
  });
export const buildReportSubQuestionState = (snapshot: DeepResearchTimelineSnapshot) => {
  const subQuestions = buildReportSubQuestionViews(snapshot.subQuestions);
  const subQuestionById = new Map(subQuestions.map((record) => [record.id, record]));
  const timelineByPhaseAndSubQuestionId = buildTimelineByPhaseAndSubQuestionId(snapshot.timeline);
  const answerByKindAndSubQuestionId = buildAnswerByKindAndSubQuestionId(snapshot.answers);
  const subQuestionReports = buildSubQuestionReports({
    subQuestions,
    timelineByPhaseAndSubQuestionId,
    answerByKindAndSubQuestionId,
  });
  return {
    subQuestions,
    subQuestionById,
    answerByKindAndSubQuestionId,
    subQuestionReports,
  };
};
const readExportPayload = (record: ResearchExport | null): Record<string, unknown> | null => {
  if (!record) {
    return null;
  }
  try {
    const parsed = JSON.parse(record.payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const selectBusinessHtmlExport = (exports: DeepResearchTimelineSnapshot["exports"]): ResearchExport | null => exports.find((entry) => entry.exportKind === "business-report.html") ?? null;
export const buildPrimaryBusinessReportView = (input: { job: DeepResearchTimelineSnapshot["job"]; exports: DeepResearchTimelineSnapshot["exports"]; exportViews: ReturnType<typeof buildReportExportViews> }): DeepResearchPrimaryBusinessReportView => {
  const htmlExport = selectBusinessHtmlExport(input.exports);
  const htmlExportView = input.exportViews.find((entry) => entry.exportKind === "business-report.html") ?? null;
  const payload = readExportPayload(htmlExport);
  const sourceKind = payload?.sourceKind === "html_artifact" || htmlExportView ? "html_artifact" : null;
  return {
    generatedAt: htmlExportView?.createdAt ?? null,
    status: htmlExportView ? "generated" : input.job.status === "failed" || input.job.status === "review_required" ? "failed" : "missing",
    generatedBy: "AI HTML Report Publisher" as const,
    htmlExport: htmlExportView,
    sourceKind,
    failureReason: htmlExportView ? null : input.job.failureReason,
    reviewReason: htmlExportView ? null : input.job.reviewReason,
  };
};
export type DeepResearchExportArtifactPayload = {
  jobId: string;
  kind: ResearchExportKind;
  fileName: string;
  filePath: string;
  contentType: "text/markdown" | "text/html" | "application/json";
  fileHash: string;
  payloadHash: string;
  textContent?: string;
  jsonContent?: unknown;
  base64Content?: string;
};
const JOB_STATUSES: readonly ResearchJob["status"][] = ["queued", "running", "completed", "review_required", "failed"];
const resolveDbPath = (dataDir: string): string => path.join(dataDir, DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH);
const withStore = <T>(dataDir: string, action: (store: ReturnType<typeof createDeepResearchRecordStore>) => T): T => {
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
    const row = db.prepare("SELECT id FROM research_jobs ORDER BY updated_at DESC, created_at DESC LIMIT 1").get() as { id: string } | undefined;
    return row?.id ?? null;
  } finally {
    db.close();
  }
};
const listJobs = (input: { dataDir: string; limit?: number; status?: ResearchJob["status"] }): ResearchJob[] => {
  const dbPath = resolveDbPath(input.dataDir);
  if (!existsSync(dbPath)) {
    return [];
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    if (input.status && JOB_STATUSES.includes(input.status)) {
      const rows = db
        .prepare(
          `SELECT * FROM research_jobs
         WHERE status = ?
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ?`,
        )
        .all(input.status, limit) as Parameters<typeof mapJobRow>[0][];
      return rows.map((row) => mapJobRow(row));
    }
    const rows = db
      .prepare(
        `SELECT * FROM research_jobs
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
      )
      .all(limit) as Parameters<typeof mapJobRow>[0][];
    return rows.map((row) => mapJobRow(row));
  } finally {
    db.close();
  }
};
const buildReportViewModel = (dataDir: string, jobId: string): DeepResearchReportViewModel | null => {
  const snapshot = buildTimelineSnapshot(dataDir, jobId);
  if (!snapshot) {
    return null;
  }
  const { subQuestions, subQuestionById, answerByKindAndSubQuestionId, subQuestionReports } = buildReportSubQuestionState(snapshot);
  const decompositionInteraction = snapshot.timeline.find((entry) => entry.phase === "decomposition") ?? null;
  const hasPairedEvidence = subQuestions.some((subQuestion) => answerByKindAndSubQuestionId.has(`analysis:${subQuestion.id}`));
  const finalInteraction =
    [...snapshot.timeline]
      .reverse()
      .filter((entry) => hasPairedEvidence || snapshot.finalAdjudication !== null)
      .find((entry) => entry.phase === "final_adjudication") ?? null;
  const exportViews = buildReportExportViews(snapshot.exports);
  const fullCaseFileSummary = buildFullCaseFileSummary({
    timeline: snapshot.timeline,
    subQuestionCount: subQuestions.length,
    finalAdjudication: snapshot.finalAdjudication,
    exports: snapshot.exports,
  });
  return {
    job: buildReportJobView(snapshot),
    conclusion: buildConclusionView(snapshot.finalAdjudication),
    stages: buildStageViews({
      job: snapshot.job,
      timeline: snapshot.timeline,
      subQuestionCount: subQuestions.length,
      analysisCount: snapshot.answers.filter((record) => record.answerKind === "analysis").length,
      finalAdjudication: snapshot.finalAdjudication,
      fullCaseFileSummary,
      exports: snapshot.exports,
    }),
    researchPlan: buildResearchPlanView({
      researchPlan: snapshot.researchPlan,
      decompositionInteraction,
      subQuestionReports,
    }),
    decomposition: {
      interaction: decompositionInteraction,
      subQuestions,
    },
    subQuestionReports,
    finalAdjudication: {
      interaction: finalInteraction,
      record: snapshot.finalAdjudication,
    },
    primaryBusinessReport: buildPrimaryBusinessReportView({
      job: snapshot.job,
      exports: snapshot.exports,
      exportViews,
    }),
    fullCaseFileSummary,
    evidence: buildEvidenceViews({ timeline: snapshot.timeline, subQuestionById }),
    exports: exportViews,
  };
};
export const getDeepResearchAnalysisJob = (input: { dataDir: string; jobId: string }): DeepResearchJobSnapshot | null => buildJobSnapshotForId(input.dataDir, input.jobId);
export const getLatestDeepResearchAnalysisJob = (input: { dataDir: string }): DeepResearchJobSnapshot | null => {
  const latestJobId = readLatestJobId(input.dataDir);
  return latestJobId ? buildJobSnapshotForId(input.dataDir, latestJobId) : null;
};
export const getDeepResearchAnalysisTimeline = (input: { dataDir: string; jobId: string }): DeepResearchTimelineSnapshot | null => buildTimelineSnapshot(input.dataDir, input.jobId);
export const listDeepResearchAnalysisHistory = (input: { dataDir: string; limit?: number; status?: ResearchJob["status"] }): DeepResearchHistorySnapshot =>
  withStore(input.dataDir, (store) => ({
    jobs: listJobs(input).map((job) => buildHistoryJobView({ store, job })),
  }));
export const getDeepResearchAnalysisReport = (input: { dataDir: string; jobId: string }): DeepResearchReportViewModel | null => buildReportViewModel(input.dataDir, input.jobId);
export const deleteDeepResearchAnalysisJob = (input: { dataDir: string; jobId: string }): { deleted: boolean; jobId: string } =>
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
export const getDeepResearchExportArtifact = (input: { dataDir: string; jobId: string; kind: ResearchExportKind }): DeepResearchExportArtifactPayload | null =>
  withStore(input.dataDir, (store) => {
    const exported = store.listExports(input.jobId).find((record) => record.exportKind === input.kind);
    if (!exported || !existsSync(exported.filePath)) {
      return null;
    }
    const fileName = path.basename(exported.filePath);
    if (input.kind === "final-adjudication-raw.md" || input.kind === "full-case-file.md") {
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
    if (input.kind === "business-report.html") {
      return {
        jobId: input.jobId,
        kind: input.kind,
        fileName,
        filePath: exported.filePath,
        contentType: "text/html",
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
export type { DeepResearchInputAttachment };
export type { DeepResearchHistorySnapshot, DeepResearchJobSnapshot, DeepResearchReportViewModel, DeepResearchTimelineSnapshot } from "./deep-research-analysis.public-contracts.js";
export const deepResearchAnalysisPublicFacade = {
  runDeepResearchAnalysis,
  getDeepResearchAnalysisJob,
  listDeepResearchAnalysisHistory,
  getDeepResearchAnalysisReport,
  getLatestDeepResearchAnalysisJob,
  getDeepResearchAnalysisTimeline,
  getDeepResearchExportArtifact,
  deleteDeepResearchAnalysisJob,
} as const;
export type DeepResearchAnalysisStartInput = DeepResearchInputPayload & {
  providerKind: DeepResearchAnalysisContext["providerKind"];
};
