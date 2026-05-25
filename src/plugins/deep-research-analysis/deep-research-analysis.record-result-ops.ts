import { createId } from "../../lib/local-runtime/ids.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  DeepResearchFinalReportSchema,
  type DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import {
  ResearchExportSchema,
  ResearchFinalReportRecordSchema,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalReportRecord,
} from "./deep-research-analysis.record-contracts.js";
import {
  createDeepResearchDatabase,
  getCurrentTimestamp,
  mapExportRow,
  mapFinalReportRow,
} from "./deep-research-analysis.record-db.js";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

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
  const payloadJson = JSON.stringify(input.payload);
  db.prepare(
    `INSERT INTO research_exports (
      id, job_id, export_kind, file_path, file_hash, payload_hash, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.exportKind,
    input.filePath,
    input.fileHash,
    payloadHash,
    payloadJson,
    createdAt,
  );
  return ResearchExportSchema.parse({
    id,
    jobId: input.jobId,
    exportKind: input.exportKind,
    filePath: input.filePath,
    fileHash: input.fileHash,
    payloadHash,
    payloadJson,
    createdAt,
  });
};

export const listExports = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchExport[] =>
  (db.prepare(`SELECT * FROM research_exports WHERE job_id = ? ORDER BY created_at ASC`).all(jobId) as Parameters<typeof mapExportRow>[0][])
    .map(mapExportRow);
