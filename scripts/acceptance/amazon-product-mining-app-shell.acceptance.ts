import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync("src/app/skills/amazon-product-mining/amazon-product-mining-workspace.ts", "utf8");
const publish = readFileSync("src/app/skills/amazon-product-mining/amazon-product-mining-task-publish.ts", "utf8");
const history = readFileSync("src/app/skills/amazon-product-mining/amazon-product-mining-keyword-history.ts", "utf8");
const client = readFileSync("src/app/workbench-home-client.ts", "utf8");
const reviewClient = readFileSync("src/app/workbench-home-amazon-product-mining-review-client.ts", "utf8");

for (const token of [
  'data-skill-workspace="amazon-product-mining"',
  "skill-header",
]) {
  assert(workspace.includes(token), `Amazon Product Mining workspace must include ${token}.`);
}

assert(publish.includes("Publish Task Card"), "Amazon Product Mining publish module must render Publish Task Card.");
assert(workspace.includes("Latest Task Summary Card"), "Amazon Product Mining workspace must render Latest Task Summary Card.");
assert(history.includes("Keyword Opportunity Review History"), "Amazon Product Mining history module must render Keyword Opportunity Review History.");
assert(publish.includes("data-amazon-product-mining-publish-area"), "Publish Task Area must remain available.");
assert(history.includes("data-primary-history-surface"), "Keyword History must be the primary history surface.");

for (const token of [
  "data-amazon-product-mining-review-filter",
  "data-amazon-product-mining-review-keyword-filter",
  "data-amazon-product-mining-review-marketplace-filter",
]) {
  assert(history.includes(token), `Keyword History must include P0 filter ${token}.`);
}

for (const column of [
  "Created At",
  "Keyword",
  "Decision",
  "Human Next Step",
  "Demand Signal",
  "Review Health",
  "Price Ceiling",
  "Competition Openness",
  "Improvement Opportunity",
  "Data Confidence",
  "Product Count",
  "Review Count",
  "Package Integrity",
  "Data Completeness",
  "Status",
]) {
  assert(history.includes(column), `Keyword History must include ${column}.`);
}

for (const token of [
  "renderReviewInspector",
  "Keyword",
  "Decision",
  "Human Next Step",
  "Demand Signal",
  "Review Health",
  "Price Ceiling",
  "Competition Openness",
  "Improvement Opportunity",
  "Data Confidence",
  "AI Reason",
  "Evidence refs",
  "Missing evidence",
  "Risk points",
  "Package link",
  "Master Report link",
  "AI raw response link",
  "Open Package",
  "Open Master Report",
  "Open AI Review",
  "Open Evidence",
]) {
  assert(reviewClient.includes(token), `Review client must support Inspector detail token ${token}.`);
}

assert(!reviewClient.includes("renderAmazonProductMiningReviewDetail"), "Details must not be expanded inside the history table.");
assert(!client.includes("localStorage"), "App client must not use localStorage as production truth source.");

process.stdout.write("[ACCEPTANCE][amazon-product-mining-app-shell] PASS\n");
