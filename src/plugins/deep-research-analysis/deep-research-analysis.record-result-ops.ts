import { createId } from "../../lib/local-runtime/ids.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  DeepResearchConflictMatrixRowSchema,
  DeepResearchFinalReportSchema,
  type DeepResearchConflictMatrixRow,
  type DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import {
  ResearchConflictMatrixSchema,
  ResearchExportSchema,
  ResearchFinalReportRecordSchema,
  type ResearchConflictMatrix,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalReportRecord,
} from "./deep-research-analysis.record-contracts.js";
import {
  createDeepResearchDatabase,
  getCurrentTimestamp,
  mapConflictRow,
  mapExportRow,
  mapFinalReportRow,
} from "./deep-research-analysis.record-db.js";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

export const saveConflictMatrixRows = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    rows: readonly DeepResearchConflictMatrixRow[];
  },
): ResearchConflictMatrix[] => {
  const insert = db.prepare(
    `INSERT INTO research_conflict_matrix (
      id, job_id, sub_question_id, positive_claim_summary, falsification_summary,
      conflict_level, evidence_gap, needs_human_review, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = getCurrentTimestamp();
  return input.rows.map((row) => {
    const parsed = DeepResearchConflictMatrixRowSchema.parse(row);
    const id = createId("deep_research_conflict");
    insert.run(
      id,
      input.jobId,
      parsed.subQuestionId,
      parsed.positiveClaimSummary,
      parsed.falsificationSummary,
      parsed.conflictLevel,
      parsed.evidenceGap,
      parsed.needsHumanReview ? 1 : 0,
      createdAt,
    );
    return ResearchConflictMatrixSchema.parse({
      id,
      jobId: input.jobId,
      row: parsed,
      createdAt,
    });
  });
};

export const listConflictMatrix = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchConflictMatrix[] =>
  (db.prepare(`SELECT * FROM research_conflict_matrix WHERE job_id = ? ORDER BY created_at ASC, sub_question_id ASC`).all(jobId) as Parameters<typeof mapConflictRow>[0][])
    .map(mapConflictRow);

export const saveFinalReport = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    report: DeepResearchFinalReport;
  },
): ResearchFinalReportRecord => {
  const id = createId("deep_research_final_report");
  const createdAt = getCurrentTimestamp();
  const report = DeepResearchFinalReportSchema.parse(input.report);
  const reportHash = stableJsonHash(report);
  db.prepare(
    `INSERT INTO research_final_reports (
      id, job_id, interaction_id, report_json, report_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.interactionId,
    JSON.stringify(report),
    reportHash,
    createdAt,
  );
  return ResearchFinalReportRecordSchema.parse({
    id,
    jobId: input.jobId,
    interactionId: input.interactionId,
    report,
    reportHash,
    createdAt,
  });
};

export const getLatestFinalReport = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchFinalReportRecord | null => {
  const row = db.prepare(
    `SELECT * FROM research_final_reports WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
  ).get(jobId) as Parameters<typeof mapFinalReportRow>[0] | undefined;
  return row ? mapFinalReportRow(row) : null;
};

export const saveExport = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    exportKind: ResearchExportKind;
    filePath: string;
    fileHash: string;
    payload: unknown;
  },
): ResearchExport => {
  const id = createId("deep_research_export");
  const createdAt = getCurrentTimestamp();
  const payloadHash = stableJsonHash(input.payload);
  db.prepare(
    `INSERT INTO research_exports (
      id, job_id, export_kind, file_path, file_hash, payload_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.exportKind,
    input.filePath,
    input.fileHash,
    payloadHash,
    createdAt,
  );
  return ResearchExportSchema.parse({
    id,
    jobId: input.jobId,
    exportKind: input.exportKind,
    filePath: input.filePath,
    fileHash: input.fileHash,
    payloadHash,
    createdAt,
  });
};

export const listExports = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchExport[] =>
  (db.prepare(`SELECT * FROM research_exports WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapExportRow>[0][])
    .map(mapExportRow);