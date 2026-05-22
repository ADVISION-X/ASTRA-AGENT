import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

import {
  createFacebookProductVideoMiningStorage,
  FacebookProductVideoMiningSchemas,
} from "../../src/plugins/facebook-product-video-mining/index.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "facebook-product-video-mining-"));
const now = new Date().toISOString();

try {
  const parsed = FacebookProductVideoMiningSchemas.FacebookProductVideoMiningMissionInputSchema.parse({
    targetProductCount: 1,
  });
  assert.equal(parsed.feedEntryUrl, "https://www.facebook.com/reels/");
  assert.equal(parsed.providerKind, "gpt-web-chat");
  assert.equal(parsed.modelName, null);
  assert.equal(parsed.maxMinutes, 20);
  assert.equal(parsed.maxRounds >= parsed.targetProductCount, true);
  const storage = createFacebookProductVideoMiningStorage(dataDir);
  const run = storage.createRun({
    ...parsed,
    missionId: "facebook_mission_acceptance",
    runId: "facebook_run_acceptance",
    modelName: null,
    startedAt: now,
  });
  assert.equal(run.runId, "facebook_run_acceptance");
  assert.equal(run.savedProductCount, 0);
  assert.equal(storage.getLatestRun()?.runId, run.runId);
  storage.close();
  process.stdout.write("[facebook-product-video-mining-storage] PASS\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
