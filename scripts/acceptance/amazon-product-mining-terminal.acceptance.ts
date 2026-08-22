import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getAmazonProductMiningTaskStatus,
  startAmazonProductMiningMission,
} from "../../src/plugins/amazon-product-mining/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "grasseye-mining-terminal-"));
const started = startAmazonProductMiningMission({
  dataDir,
  rawInput: {
    amazonMarketplace: "amazon.ae",
    targetMarket: "AE",
    productDirection: "terminal browser authority check",
    providerKind: "gpt-web-chat",
  },
});
const task = getAmazonProductMiningTaskStatus({ dataDir, taskId: started.taskId });
assert.equal(task?.status, "review_required");
assert.equal(task?.failureReason, "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED");

process.stdout.write("[ACCEPTANCE] amazon-product-mining-terminal PASS\n");
