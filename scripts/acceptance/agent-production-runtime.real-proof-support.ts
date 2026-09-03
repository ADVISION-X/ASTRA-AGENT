import { existsSync } from "node:fs";
import Database from "better-sqlite3";

export const sentProductionCheckpointPrefix = (
  productionDatabasePath: string,
  jobId: string,
): Readonly<{ attemptId: string | null; acceptedSeq1: boolean; progressSeq2: boolean; progressSeq3: boolean }> => {
  if (!existsSync(productionDatabasePath)) {
    return { attemptId: null, acceptedSeq1: false, progressSeq2: false, progressSeq3: false };
  }
  const database = new Database(productionDatabasePath, { readonly: true, fileMustExist: true });
  try {
    const jobPathMarker = `/jobs/${encodeURIComponent(jobId)}/`;
    const rows = database.prepare(`select body_blob,sent_at from production_outbox
      where kind='checkpoint' and instr(path,?)>0 order by created_at,idempotency_key`
    ).all(jobPathMarker) as Array<{ body_blob: Buffer; sent_at: string | null }>;
    const sent = rows.filter((row) => row.sent_at).map((row) =>
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>);
    const attempts = [...new Set(sent.map((row) => String(row.attempt_id ?? "")).filter(Boolean))];
    const attemptId = attempts.length === 1 ? attempts[0]! : null;
    const has = (seq: number, kind: string): boolean => sent.some((row) =>
      row.attempt_id === attemptId && row.checkpoint_seq === seq && row.checkpoint_kind === kind);
    return { attemptId, acceptedSeq1: has(1, "accepted"), progressSeq2: has(2, "progress"),
      progressSeq3: has(3, "progress") };
  } finally {
    database.close();
  }
};
