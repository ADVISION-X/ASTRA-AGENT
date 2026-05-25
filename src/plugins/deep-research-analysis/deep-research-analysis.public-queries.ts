import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  createDeepResearchRecordStore,
  DEEP_RESEARCH_ANALYSIS_DB_RELATIVE_PATH,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchJob,
} from "./deep-research-analysis.records.js";
import {
  type DeepResearchHistorySnapshot,
  type DeepResearchJobSnapshot,
  type DeepResearchReportViewModel,
  type DeepResearchTimelineEntry,
  type DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";
import {
  buildFullCaseFileSummary,
  buildConclusionView,
  buildEvidenceViews,
  buildHistoryJobView,
  buildReportExportViews,
  buildReportJobView,
  buildResearchPlanView,
  buildStageViews,
} from "./deep-research-analysis.public-report-support.js";
import {
  buildPrimaryBusinessReportView,
  buildJobSnapshotForId as buildJobSnapshotForIdSupport,
  buildReportSubQuestionState,
  buildTimelineSnapshot as buildTimelineSnapshotSupport,
} from "./deep-research-analysis.public-queries-support.js";
import { mapJobRow } from "./deep-research-analysis.record-db.js";

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

const JOB_STATUSES: readonly ResearchJob["status"][] = [
  "queued",
  "running",
  "completed",
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

const buildJobSnapshot = (input: {
  overview: DeepResearchTimelineSnapshot["overview"];
  timeline: readonly DeepResearchTimelineEntry[];
  subQuestions: DeepResearchTimelineSnapshot["subQuestions"];
  answers: DeepResearchTimelineSnapshot["answers"];
  exports: readonly ResearchExport[];
}): DeepResearchTimelineSnapshot["overview"] => ({
  currentPhase: input.overview.currentPhase,
  interactionCount: input.timeline.length,
  subQuestionCount: input.subQuestions.length,
  analysisCount: input.answers.filter((record) => record.answerKind === "analysis").length,
  exportCount: input.exports.length,
});

const buildTimelineSnapshot = (dataDir: string, jobId: string): DeepResearchTimelineSnapshot | null => {
  const snapshot = buildTimelineSnapshotSupport(dataDir, jobId);
  if (!snapshot) {
    return null;
  }
  const timeline = snapshot.timeline;
  const subQuestions = snapshot.subQuestions;
  const answers = snapshot.answers;
  const exports = snapshot.exports;
  return {
    ...snapshot,
    overview: buildJobSnapshot({
      overview: snapshot.overview,
      timeline,
      subQuestions,
      answers,
      exports,
    }),
  };
};

const buildReportViewModel = (dataDir: string, jobId: string): DeepResearchReportViewModel | null => {
  const snapshot = buildTimelineSnapshot(dataDir, jobId);
  if (!snapshot) {
    return null;
  }
  const {
    subQuestions,
    subQuestionById,
    answerByKindAndSubQuestionId,
    subQuestionReports,
  } = buildReportSubQuestionState(snapshot);
  const decompositionInteraction = snapshot.timeline.find((entry) => entry.phase === "decomposition") ?? null;
  const hasPairedEvidence = subQuestions.some((subQuestion) =>
    answerByKindAndSubQuestionId.has(`analysis:${subQuestion.id}`));
  const finalInteraction = [...snapshot.timeline]
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

export const getDeepResearchAnalysisJob = (input: {
  dataDir: string;
  jobId: string;
}): DeepResearchJobSnapshot | null => buildJobSnapshotForIdSupport(input.dataDir, input.jobId);

export const getLatestDeepResearchAnalysisJob = (input: {
  dataDir: string;
}): DeepResearchJobSnapshot | null => {
  const latestJobId = readLatestJobId(input.dataDir);
  return latestJobId ? buildJobSnapshotForIdSupport(input.dataDir, latestJobId) : null;
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
