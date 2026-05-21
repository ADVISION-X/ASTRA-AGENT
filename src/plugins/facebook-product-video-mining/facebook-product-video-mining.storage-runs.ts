import Database from "better-sqlite3";

import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  CREATE_RUN_SQL,
  RUN_STATUS_SELECT_SQL,
  UPDATE_RUN_PROGRESS_SQL,
} from "./facebook-product-video-mining.storage-statements.js";
import { mapRunRow, type RunRow } from "./facebook-product-video-mining.storage-support.js";

type FacebookProductVideoMiningRunConfig = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunConfig"];
type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];

type RunProgressUpdate = {
  runId: string;
  status: FacebookProductVideoMiningRunStatus["status"];
  failureReason?: string | null;
  endedAt?: string | null;
  currentRoundId?: string | null;
  currentRoundIndex?: number | null;
};

type RunStatements = ReturnType<typeof prepareRunStatements>;

const prepareRunStatements = (db: Database.Database) => ({
  recalculateRunStatusStatement: db.prepare(`${RUN_STATUS_SELECT_SQL} WHERE id = ?`),
  getRunStatusStatement: db.prepare(`${RUN_STATUS_SELECT_SQL} WHERE id = ?`),
  getLatestRunStatement: db.prepare(`${RUN_STATUS_SELECT_SQL} ORDER BY started_at DESC LIMIT 1`),
  createRunStatement: db.prepare(CREATE_RUN_SQL),
  updateRunProgressStatement: db.prepare(UPDATE_RUN_PROGRESS_SQL),
});

export const createFacebookMiningRunCounterUpdater = (
  db: Database.Database,
): ((runId: string) => void) => {
  const updateRunCounters = db.prepare(`
    UPDATE facebook_product_video_runs
    SET
      saved_product_count = (
        SELECT COUNT(*)
        FROM facebook_product_video_candidates
        WHERE run_id = @runId AND status = 'saved'
      ),
      scanned_count = (
        SELECT COUNT(*)
        FROM facebook_product_video_candidates
        WHERE run_id = @runId
      )
    WHERE id = @runId
  `);
  return (runId: string): void => {
    updateRunCounters.run({ runId });
  };
};

const recalculateFacebookMiningRunStatus = (
  statements: RunStatements,
  runId: string,
): FacebookProductVideoMiningRunStatus => {
  const row = statements.recalculateRunStatusStatement.get(runId) as RunRow | undefined;
  if (!row) {
    throw new Error(`Facebook mining run not found: ${runId}`);
  }
  return mapRunRow(row);
};

const createStoredFacebookMiningRun = (
  statements: RunStatements,
  run: FacebookProductVideoMiningRunConfig,
): FacebookProductVideoMiningRunStatus => {
  const parsed = FacebookProductVideoMiningSchemas.FacebookProductVideoMiningRunConfigSchema.parse(run);
  statements.createRunStatement.run({
    id: parsed.runId,
    mission_id: parsed.missionId,
    feed_entry_url: parsed.feedEntryUrl,
    provider_kind: parsed.providerKind,
    target_product_count: parsed.targetProductCount,
    max_rounds: parsed.maxRounds,
    status: "queued",
    started_at: parsed.startedAt,
  });
  return recalculateFacebookMiningRunStatus(statements, parsed.runId);
};

const updateStoredFacebookMiningRunProgress = (input: {
  statements: RunStatements;
  progress: RunProgressUpdate;
  updateRunCounters: (runId: string) => void;
}): FacebookProductVideoMiningRunStatus => {
  input.statements.updateRunProgressStatement.run({
    runId: input.progress.runId,
    status: input.progress.status,
    failureReason: input.progress.failureReason ?? null,
    endedAt: input.progress.endedAt ?? null,
    currentRoundId: input.progress.currentRoundId ?? null,
    currentRoundIndex: input.progress.currentRoundIndex ?? null,
  });
  input.updateRunCounters(input.progress.runId);
  return recalculateFacebookMiningRunStatus(input.statements, input.progress.runId);
};

const getStoredFacebookMiningRunStatus = (
  statement: Database.Statement,
  runId: string,
): FacebookProductVideoMiningRunStatus | null => {
  const row = statement.get(runId) as RunRow | undefined;
  return row ? mapRunRow(row) : null;
};

const getLatestStoredFacebookMiningRun = (
  statement: Database.Statement,
): FacebookProductVideoMiningRunStatus | null => {
  const row = statement.get() as RunRow | undefined;
  return row ? mapRunRow(row) : null;
};

export const createFacebookMiningRunStore = (input: {
  db: Database.Database;
  updateRunCounters: (runId: string) => void;
}) => {
  const statements = prepareRunStatements(input.db);

  return {
    createRun: (run: FacebookProductVideoMiningRunConfig) => createStoredFacebookMiningRun(statements, run),
    updateRunProgress: (progress: RunProgressUpdate) =>
      updateStoredFacebookMiningRunProgress({
        statements,
        progress,
        updateRunCounters: input.updateRunCounters,
      }),
    getRunStatus: (runId: string) => getStoredFacebookMiningRunStatus(statements.getRunStatusStatement, runId),
    getLatestRun: () => getLatestStoredFacebookMiningRun(statements.getLatestRunStatement),
  };
};