import { createId } from "../../lib/local-runtime/ids.js";
import { stableJsonHash } from "../../lib/storage/hash.js";
import type { DeepResearchFinalAdjudicationParse } from "./deep-research-analysis.result.js";
import {
  ResearchExportSchema,
  ResearchFinalAdjudicationRecordSchema,
  type ResearchExport,
  type ResearchExportKind,
  type ResearchFinalAdjudicationRecord,
} from "./deep-research-analysis.record-contracts.js";
import {
  createDeepResearchDatabase,
  getCurrentTimestamp,
  mapExportRow,
  mapFinalAdjudicationRow,
} from "./deep-research-analysis.record-db.js";

type DeepResearchDatabaseHandle = ReturnType<typeof createDeepResearchDatabase>;

export const saveFinalAdjudication = (
  db: DeepResearchDatabaseHandle,
  input: {
    jobId: string;
    interactionId: string;
    promptId: string;
    promptVersion: string;
    parsed: DeepResearchFinalAdjudicationParse;
    promptBundleSnapshot: unknown;
  },
): ResearchFinalAdjudicationRecord => {
  const id = createId("deep_research_final_adjudication");
  const createdAt = getCurrentTimestamp();
  db.prepare(
    `INSERT INTO research_final_adjudications (
      id, job_id, interaction_id, prompt_id, prompt_version, raw_final_answer_text,
      raw_response_hash, preferred_format, parsed_json_index_json, parse_status,
      prompt_bundle_snapshot_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.jobId,
    input.interactionId,
    input.promptId,
    input.promptVersion,
    input.parsed.rawFinalAnswerText,
    input.parsed.rawResponseHash,
    input.parsed.preferredFormat,
    input.parsed.parsedJsonIndex === null ? null : JSON.stringify(input.parsed.parsedJsonIndex),
    input.parsed.parseStatus,
    JSON.stringify(input.promptBundleSnapshot),
    createdAt,
  );
  return ResearchFinalAdjudicationRecordSchema.parse({
    id,
    jobId: input.jobId,
    interactionId: input.interactionId,
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    rawFinalAnswerText: input.parsed.rawFinalAnswerText,
    rawResponseHash: input.parsed.rawResponseHash,
    preferredFormat: input.parsed.preferredFormat,
    parsedJsonIndex: input.parsed.parsedJsonIndex,
    parseStatus: input.parsed.parseStatus,
    promptBundleSnapshot: input.promptBundleSnapshot,
    createdAt,
  });
};

export const getLatestFinalAdjudication = (
  db: DeepResearchDatabaseHandle,
  jobId: string,
): ResearchFinalAdjudicationRecord | null => {
  const row = db.prepare(
    `SELECT * FROM research_final_adjudications WHERE job_id = ? ORDER BY created_at DESC LIMIT 1`,
  ).get(jobId) as Parameters<typeof mapFinalAdjudicationRow>[0] | undefined;
  return row ? mapFinalAdjudicationRow(row) : null;
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
