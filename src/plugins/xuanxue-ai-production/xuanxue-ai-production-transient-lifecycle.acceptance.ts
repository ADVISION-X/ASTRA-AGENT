import assert from "node:assert/strict";
import { mkdtemp, mkdir, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  reconcileXuanxueAiProductionGeneratedInputOrphans,
  type XuanxueAiProductionTransientRecord,
} from "./xuanxue-ai-production-transient-lifecycle.js";

const record = (
  orderId: string,
  status: XuanxueAiProductionTransientRecord["status"],
): XuanxueAiProductionTransientRecord => ({
  order: { orderId },
  status,
  stages: [],
});

const exists = async (value: string): Promise<boolean> => {
  try { await access(value); return true; } catch { return false; }
};

const root = await mkdtemp(path.join(os.tmpdir(), "xuanxue-transient-"));
const inputRoot = path.join(root, "plugin-tasks", "xuanxue-ai-production", "generated-inputs");
for (const orderId of ["aiprod_completed", "aiprod_failed", "aiprod_review", "aiprod_recovery", "aiprod_rebuild", "aiprod_unknown"]) {
  await mkdir(path.join(inputRoot, orderId), { recursive: true });
}
const result = await reconcileXuanxueAiProductionGeneratedInputOrphans(
  { dataDir: root },
  [
    record("aiprod_completed", "completed"),
    record("aiprod_failed", "failed"),
    record("aiprod_review", "review_required"),
    record("aiprod_recovery", "recovery_pending"),
    record("aiprod_rebuild", "recovery_pending"),
  ],
  new Set(["aiprod_recovery"]),
);
assert.deepEqual(result.reclaimed_order_ids, ["aiprod_completed", "aiprod_failed", "aiprod_rebuild", "aiprod_review"]);
assert.deepEqual(result.retained_order_ids, ["aiprod_recovery", "aiprod_unknown"]);
assert.equal(await exists(path.join(inputRoot, "aiprod_completed")), false);
assert.equal(await exists(path.join(inputRoot, "aiprod_rebuild")), false);
assert.equal(await exists(path.join(inputRoot, "aiprod_recovery")), true);
assert.equal(await exists(path.join(inputRoot, "aiprod_unknown")), true);
process.stdout.write("XUANXUE_AI_PRODUCTION_TRANSIENT_LIFECYCLE_ACCEPTANCE_PASS\n");
