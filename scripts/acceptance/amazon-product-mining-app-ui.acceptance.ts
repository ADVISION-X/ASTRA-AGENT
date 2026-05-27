import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

const homePage = readFileSync(resolve(repoRoot, "src/app/workbench-home-page.ts"), "utf8");
const homeClient = readFileSync(resolve(repoRoot, "src/app/workbench-home-client.ts"), "utf8");

for (const requiredToken of [
  'data-job-card="amazon-product-mining"',
  'data-job-panel="amazon-product-mining"',
  'data-amazon-product-mining-publish-area',
  'Task Publish Area',
  'data-amazon-product-mining-latest-summary',
  'Latest Task Summary',
  'name="amazonMarketplace"',
  'name="targetMarket"',
  'name="productDirection"',
  'name="requestedKeywordCount"',
  'name="amazonKeywordProviderKind"',
  'value="gemini-api"',
  'value="gemini-web-chat"',
  'value="gpt-web-chat"',
  'name="languagePreference"',
  'data-amazon-product-mining-latest',
  'data-amazon-product-mining-export',
  'data-amazon-product-mining-status',
  'Keyword Opportunity Review History',
]) {
  assert(homePage.includes(requiredToken), `workbench-home-page.ts must include ${requiredToken}`);
}

for (const forbiddenToken of [
  'name="profit"',
  'name="purchase"',
  'name="sampling"',
  'name="inventory"',
  'name="finalSelection"',
  'name="runId"',
]) {
  assert(!homePage.includes(forbiddenToken), `workbench-home-page.ts must not include ${forbiddenToken}`);
}

for (const requiredToken of [
  "amazonProductMiningTaskId",
  "startAmazonProductMining",
  "refreshAmazonProductMiningLatest",
  "exportAmazonProductMining",
  "amazonKeywordProviderKind",
  "/api/amazon-product-mining/mission",
  "/api/amazon-product-mining/latest",
  "/api/amazon-product-mining/export?taskId=",
]) {
  assert(homeClient.includes(requiredToken), `workbench-home-client.ts must include ${requiredToken}`);
}

for (const forbiddenToken of [
  "/api/amazon-product-mining/export?runId=",
  "taskId || runId",
]) {
  assert(!homeClient.includes(forbiddenToken), `workbench-home-client.ts must not include ${forbiddenToken}`);
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-app-ui\n");
