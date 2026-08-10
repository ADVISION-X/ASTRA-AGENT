import assert from "node:assert/strict";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";

import { XuanxueAiProductionStore } from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  corruptLegacyStageHash,
  legacyDatabasePath,
  makeLegacyStageActive,
  removeLegacyCompletedStageOutputProof,
  seedLegacyDatabase,
} from "./xuanxue-ai-production-v1-migration-fixture.js";
import {
  runV2DrainAcceptance,
} from "./xuanxue-ai-production-v2-drain-acceptance.js";

type StoredBytes = {
  order_json: string;
  result_json: string;
  stage_json: string;
};

type ArchiveReceipt = {
  backup_ref: string;
  backup_sha256: string;
  restored_snapshot_sha256: string;
};

const prepareTerminalFixture = async (
  root: string,
): Promise<{ terminalDir: string; before: StoredBytes }> => {
  const terminalDir = path.join(root, "legacy-terminal");
  await mkdir(path.join(terminalDir, "plugin-tasks", "xuanxue-ai-production"), { recursive: true });
  seedLegacyDatabase(terminalDir, "completed");
  const stagedObjectPath = path.join(
    terminalDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "cloud-staging",
    "legacy-order",
    "immutable-input.txt",
  );
  await mkdir(path.dirname(stagedObjectPath), { recursive: true });
  await writeFile(stagedObjectPath, "immutable legacy input", "utf8");
  const before = new Database(legacyDatabasePath(terminalDir), {
    readonly: true,
    fileMustExist: true,
  });
  const orderBefore = before.prepare(
    "select order_json,result_json from production_orders where order_id=?",
  ).get("legacy-order") as { order_json: string; result_json: string };
  const stageBefore = before.prepare(
    "select stage_json from production_stages where order_id=?",
  ).get("legacy-order") as { stage_json: string };
  before.close();
  return {
    terminalDir,
    before: { ...orderBefore, stage_json: stageBefore.stage_json },
  };
};

const runArchiveAndReadReceipt = (
  terminalDir: string,
  before: StoredBytes,
): ArchiveReceipt => {
  const migrated = new XuanxueAiProductionStore(terminalDir);
  const record = migrated.readOrder("legacy-order");
  assert.equal(record, null, "archived legacy rows must be invisible to v3 readers");
  assert.deepEqual(migrated.listRecoverableOrders(), []);
  assert.deepEqual(migrated.listCloudRecoveryOrders(), []);
  migrated.close();
  const archived = new Database(legacyDatabasePath(terminalDir), {
    readonly: true,
    fileMustExist: true,
  });
  const orderAfter = archived.prepare(
    "select order_json,result_json from production_orders where order_id=?",
  ).get("legacy-order") as { order_json: string; result_json: string };
  const stageAfter = archived.prepare(
    "select stage_json from production_stages where order_id=?",
  ).get("legacy-order") as { stage_json: string };
  const archive = archived.prepare(
    "select * from production_legacy_protocol_archives where order_id=?",
  ).get("legacy-order") as {
    backup_ref: string;
    backup_sha256: string;
    restored_snapshot_sha256: string;
  };
  assert.equal(orderAfter.order_json, before.order_json);
  assert.equal(orderAfter.result_json, before.result_json);
  assert.equal(stageAfter.stage_json, before.stage_json);
  assert.match(archive.backup_sha256, /^sha256:[0-9a-f]{64}$/u);
  assert.match(archive.restored_snapshot_sha256, /^sha256:[0-9a-f]{64}$/u);
  archived.close();
  return archive;
};

const assertBackupReceipt = async (
  terminalDir: string,
  archive: ArchiveReceipt,
): Promise<void> => {
  const backupRoot = path.join(terminalDir, archive.backup_ref);
  assert.equal((await stat(backupRoot)).mode & 0o077, 0);
  const restoredDatabaseBytes = await readFile(path.join(
    backupRoot,
    "xuanxue_ai_production.pre-cutover.sqlite",
  ));
  assert.equal((await stat(path.join(
    backupRoot,
    "xuanxue_ai_production.pre-cutover.sqlite",
  ))).mode & 0o077, 0);
  assert.ok(restoredDatabaseBytes.byteLength > 0);
  const manifest = JSON.parse(await readFile(
    path.join(backupRoot, "restore-verification.json"),
    "utf8",
  )) as {
    objectFiles: Array<{ relativePath: string; byteSize: number; sha256: string }>;
    restoredSnapshot: { snapshotSha256: string };
    sourceSnapshot: { snapshotSha256: string };
  };
  assert.equal(
    manifest.restoredSnapshot.snapshotSha256,
    manifest.sourceSnapshot.snapshotSha256,
  );
  assert.deepEqual(manifest.objectFiles.map((file) => file.relativePath), [
    path.join("cloud-staging", "legacy-order", "immutable-input.txt"),
  ]);
  assert.equal(manifest.objectFiles[0]?.byteSize, 22);
  assert.match(manifest.objectFiles[0]?.sha256 ?? "", /^sha256:[0-9a-f]{64}$/u);
  assert.equal(await readFile(path.join(
    backupRoot,
    "objects",
    "cloud-staging",
    "legacy-order",
    "immutable-input.txt",
  ), "utf8"), "immutable legacy input");
  const reopened = new XuanxueAiProductionStore(terminalDir);
  reopened.close();
  assert.equal((await readdir(path.join(
    terminalDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "migration-backups",
  ))).length, 1, "legacy cutover must be idempotent");
};

const acceptActiveLegacyBlock = async (root: string): Promise<void> => {
  const activeDir = path.join(root, "legacy-active");
  await mkdir(path.join(activeDir, "plugin-tasks", "xuanxue-ai-production"), { recursive: true });
  seedLegacyDatabase(activeDir, "running");
  assert.throws(
    () => new XuanxueAiProductionStore(activeDir),
    /XUANXUE_AI_PRODUCTION_LEGACY_ACTIVE_DRAIN_REQUIRED/u,
  );
  await assert.rejects(
    readdir(path.join(
      activeDir,
      "plugin-tasks",
      "xuanxue-ai-production",
      "migration-backups",
    )),
  );
};

const acceptCorruptLegacyBlock = async (root: string): Promise<void> => {
  const corruptDir = path.join(root, "legacy-corrupt");
  const corruptPath = path.join(corruptDir, "plugin-tasks", "xuanxue-ai-production");
  await mkdir(corruptPath, { recursive: true });
  seedLegacyDatabase(corruptDir, "completed");
  const corruptDb = new Database(legacyDatabasePath(corruptDir));
  corruptLegacyStageHash(corruptDb);
  corruptDb.close();
  assert.throws(
    () => new XuanxueAiProductionStore(corruptDir),
    /XUANXUE_AI_PRODUCTION_V1_HASH_MISMATCH/u,
  );
};

const acceptTerminalOrderWithActiveStageBlock = async (
  root: string,
): Promise<void> => {
  const dataDir = path.join(root, "legacy-active-stage");
  const databaseDir = path.join(
    dataDir, "plugin-tasks", "xuanxue-ai-production",
  );
  await mkdir(databaseDir, { recursive: true });
  seedLegacyDatabase(dataDir, "completed");
  const database = new Database(legacyDatabasePath(dataDir));
  makeLegacyStageActive(database);
  database.close();
  assert.throws(
    () => new XuanxueAiProductionStore(dataDir),
    /XUANXUE_AI_PRODUCTION_LEGACY_STAGE_ACTIVE_DRAIN_REQUIRED/u,
  );
};

const acceptCompletedStageWithoutOutputProofBlock = async (
  root: string,
): Promise<void> => {
  const dataDir = path.join(root, "legacy-missing-output-proof");
  const databaseDir = path.join(
    dataDir, "plugin-tasks", "xuanxue-ai-production",
  );
  await mkdir(databaseDir, { recursive: true });
  seedLegacyDatabase(dataDir, "completed");
  const database = new Database(legacyDatabasePath(dataDir));
  removeLegacyCompletedStageOutputProof(database);
  database.close();
  assert.throws(
    () => new XuanxueAiProductionStore(dataDir),
    /XUANXUE_AI_PRODUCTION_V1_OUTPUT_PROOF_MISSING/u,
  );
};

export async function acceptXuanxueV1Migration(root: string): Promise<void> {
  await runV2DrainAcceptance(root);
  const fixture = await prepareTerminalFixture(root);
  const archive = runArchiveAndReadReceipt(
    fixture.terminalDir,
    fixture.before,
  );
  await assertBackupReceipt(fixture.terminalDir, archive);
  await acceptActiveLegacyBlock(root);
  await acceptTerminalOrderWithActiveStageBlock(root);
  await acceptCompletedStageWithoutOutputProofBlock(root);
  await acceptCorruptLegacyBlock(root);
}
