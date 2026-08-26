import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openXuanxueAiProductionDatabase } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-database.js";
import { acknowledgeXuanxueAiControlIntent, applyXuanxueAiControlIntent, readXuanxueAiControlIntent } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-control-intent.js";

const root = await mkdtemp(join(tmpdir(), "xuanxue-control-intent-"));
const database = openXuanxueAiProductionDatabase(root);
try {
  const now = new Date().toISOString();
  database.prepare(`insert into production_orders(order_id,source_task_id,product_id,request_hash,status,order_json,created_at,updated_at)
    values('order-1','task-1','bazi_analysis',?,'running','{}',?,?)`).run(`sha256:${"a".repeat(64)}`, now, now);
  assert.equal(readXuanxueAiControlIntent(database, "order-1").intent, "none");
  const pause = applyXuanxueAiControlIntent(database, "order-1", "pause_requested", 2, "operator pause");
  assert.equal(pause.controlEpoch, 2);
  assert.equal(applyXuanxueAiControlIntent(database, "order-1", "cancel_requested", 1, "stale").intent, "pause_requested");
  assert.equal(acknowledgeXuanxueAiControlIntent(database, "order-1", "before-provider")?.acknowledgedEpoch, 2);
  assert.equal(acknowledgeXuanxueAiControlIntent(database, "order-1", "duplicate"), null);
  const resumed = applyXuanxueAiControlIntent(database, "order-1", "none", 3, null);
  assert.equal(resumed.intent, "none");
  assert.equal((database.prepare("select status from production_orders where order_id='order-1'").get() as { status: string }).status, "queued");
  assert.equal((database.prepare("select count(*) as count from sqlite_master where type='table' and name='production_interventions'").get() as { count: number }).count, 0);
  process.stdout.write("XUANXUE_AI_PRODUCTION_CONTROL_INTENT_PASS\n");
} finally {
  database.close();
  await rm(root, { recursive: true, force: true });
}
