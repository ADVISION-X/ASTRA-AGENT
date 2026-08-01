import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import Database from "better-sqlite3";

import { XuanxueAiProductionStore } from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  corruptLegacyStageHash,
  legacyDatabasePath,
  seedLegacyDatabase,
} from "./xuanxue-ai-production-v1-migration-fixture.js";

export async function acceptXuanxueV1Migration(root: string): Promise<void> {
  const terminalDir = path.join(root, "legacy-terminal");
  await mkdir(path.join(terminalDir, "plugin-tasks", "xuanxue-ai-production"), { recursive: true });
  seedLegacyDatabase(terminalDir, "completed");
  const migrated = new XuanxueAiProductionStore(terminalDir);
  const record = migrated.readOrder("legacy-order");
  assert.equal(record?.order.protocolVersion, "xuanxue-ai-production-v2");
  assert.equal(record?.order.materials[0]?.expectedOutputKind, "text");
  assert.deepEqual(record?.stages[0]?.aiFeedResult?.outputArtifacts, []);
  assert.equal(record?.result?.stages[0]?.outputKind, "text");
  migrated.close();
  const sqliteBytes = await readFile(path.join(terminalDir, "plugin-tasks", "xuanxue-ai-production", "xuanxue_ai_production.sqlite"));
  assert.ok(sqliteBytes.byteLength > 0);

  const activeDir = path.join(root, "legacy-active");
  await mkdir(path.join(activeDir, "plugin-tasks", "xuanxue-ai-production"), { recursive: true });
  seedLegacyDatabase(activeDir, "running");
  assert.throws(
    () => new XuanxueAiProductionStore(activeDir),
    /XUANXUE_AI_PRODUCTION_V1_ACTIVE_DRAIN_REQUIRED/u,
  );

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
}
