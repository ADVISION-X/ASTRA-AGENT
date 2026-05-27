import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

const homePage = readFileSync(resolve(repoRoot, "src/app/workbench-home-page.ts"), "utf8");
const homeClient = readFileSync(resolve(repoRoot, "src/app/workbench-home-client.ts"), "utf8");
const routes = readFileSync(resolve(repoRoot, "src/app/workbench-amazon-product-mining-routes.ts"), "utf8");

for (const requiredToken of [
  "Keyword Opportunity Review History",
  "data-amazon-product-mining-review-task-filter",
  "data-amazon-product-mining-review-filter",
  "data-amazon-product-mining-refresh-reviews",
  "PASS",
  "WATCH",
  "REJECT",
  "INSUFFICIENT_DATA",
]) {
  assert.equal(homePage.includes(requiredToken), true, `workbench-home-page.ts must include ${requiredToken}`);
}

for (const requiredToken of [
  "amazonProductMiningReviews",
  "refreshAmazonProductMiningReviews",
  "/api/amazon-product-mining/keyword-reviews",
  "Open Package",
  "Open AI Review",
]) {
  assert.equal(homeClient.includes(requiredToken), true, `workbench-home-client.ts must include ${requiredToken}`);
}

for (const requiredToken of [
  "GET:/api/amazon-product-mining/keyword-reviews",
  "GET:/api/amazon-product-mining/keyword-review",
  "POST:/api/amazon-product-mining/keyword-review/manual-ingest",
]) {
  assert.equal(routes.includes(requiredToken), true, `workbench-amazon-product-mining-routes.ts must include ${requiredToken}`);
}

for (const forbiddenToken of [
  "Procure",
  "Sample Now",
  "Place Order",
  "Run Ads",
  "Final Selection",
]) {
  assert.equal(homePage.includes(forbiddenToken), false, `workbench-home-page.ts must not include ${forbiddenToken}`);
  assert.equal(homeClient.includes(forbiddenToken), false, `workbench-home-client.ts must not include ${forbiddenToken}`);
}

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-review-app-ui\n");