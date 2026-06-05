import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Finding = {
  readonly checkId: string;
  readonly filePath: string;
  readonly lawId: string;
  readonly message: string;
};

const repoRoot = resolve(import.meta.dirname, "../../../..");
const lawId = "AMZMGR-AGENT-PRODUCT-FEE-SYNC-001-V1";

const fromRepo = (filePath: string): string => resolve(repoRoot, filePath);
const read = (filePath: string): string => readFileSync(fromRepo(filePath), "utf8");

const findings: Finding[] = [];

const addFinding = (filePath: string, message: string): void => {
  findings.push({
    checkId: "amazon-product-fee-sync/contract",
    filePath,
    lawId,
    message,
  });
};

const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-fee-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品费用同步施工图.md",
  "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.schema.ts",
  "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.dom-scripts.ts",
  "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.flow.ts",
  "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.storage.ts",
  "src/plugins/amazon-product-fee-sync/amazon-product-fee-sync-task-service.ts",
  "src/plugins/amazon-product-fee-sync/index.ts",
  "src/app/workbench-amazon-product-fee-sync-routes.ts",
  "scripts/acceptance/amazon-product-fee-sync.acceptance.ts",
  "scripts/audit/domains/amazon-product-fee-sync/manifest.json",
] as const;

for (const filePath of requiredFiles) {
  if (!existsSync(fromRepo(filePath))) {
    addFinding(filePath, "Required Amazon product fee sync artifact is missing.");
  }
}

const assertContains = (filePath: string, tokens: readonly string[]): void => {
  const source = existsSync(fromRepo(filePath)) ? read(filePath) : "";
  for (const token of tokens) {
    if (!source.includes(token)) {
      addFinding(filePath, `Missing required token: ${token}`);
    }
  }
};

const assertNotContains = (filePath: string, tokens: readonly string[]): void => {
  const source = existsSync(fromRepo(filePath)) ? read(filePath) : "";
  for (const token of tokens) {
    if (source.includes(token)) {
      addFinding(filePath, `Forbidden token is present: ${token}`);
    }
  }
};

assertContains("src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.schema.ts", [
  "totalAmazonFee",
  "fbaFulfillmentFee",
  ".length(1",
  "Amazon product fee sync task must contain exactly one SKU item",
]);

assertContains("src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.dom-scripts.ts", [
  "总费用",
  "亚马逊物流费用",
  "form#sc-global-search-form",
  "topGlobalSearchExcluded",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "not_visible_in_current_dom",
  "derived_total_minus_fba_not_referral",
]);

assertContains("src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.flow.ts", [
  "reuse-host-tab",
  "buildInventoryFeeSearchProbeScript",
  "buildInventoryFeeExtractionScript",
  "feeEvidenceRef",
  "rowEvidenceRef",
]);

assertContains("src/plugins/amazon-product-fee-sync/amazon-product-fee-sync-task-service.ts", [
  "amazon_product_fee_sync.start_received",
  "amazon_product_fee_sync.queued",
  "amazon_product_fee_sync.progress",
  "amazon_product_fee_sync.item_summary",
  "amazon_product_fee_sync.flow_finished",
  "amazon_product_fee_sync.flow_failed",
  "amazon_product_fee_sync.stale_running_task_failed",
]);

assertContains("src/app/workbench-api-boundary.ts", [
  "/api/plugins/amazon-product-fee-sync/start",
  "/api/plugins/amazon-product-fee-sync/status/",
  "/api/plugins/amazon-product-fee-sync/latest",
  "amazon-product-fee-sync",
]);

assertContains("src/app/create-workbench-server.ts", [
  "handleAmazonProductFeeSyncRequest",
]);

assertContains("src/lib/local-runtime/workbench.ts", [
  "startAmazonProductFeeSyncTask",
  "getAmazonProductFeeSyncTaskStatus",
  "getLatestAmazonProductFeeSyncTask",
]);

assertContains("src/lib/local-runtime/workbench-handle.ts", [
  "startAmazonProductFeeSyncTask",
  "getAmazonProductFeeSyncTaskStatus",
  "getLatestAmazonProductFeeSyncTask",
]);

assertContains("scripts/audit/config/plugin-status.json", [
  "\"pluginId\": \"amazon-product-fee-sync\"",
  "\"owner\": \"plugin:amazon-product-fee-sync\"",
  "\"acceptance:amazon-product-fee-sync\"",
  "\"audit:amazon-product-fee-sync\"",
]);

assertNotContains("src/plugins/amazon-product-sync/amazon-product-sync.schema.ts", [
  "totalAmazonFee",
  "fbaFulfillmentFee",
]);

const output = {
  domain: "amazon-product-fee-sync",
  ok: findings.length === 0,
  findings,
};

console.log(JSON.stringify(output, null, 2));
if (findings.length > 0) {
  process.exit(1);
}
