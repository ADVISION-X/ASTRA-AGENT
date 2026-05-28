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
  "data-amazon-product-mining-page-nav",
  'data-amazon-product-mining-page="history"',
  'data-amazon-product-mining-page="publish"',
  'data-amazon-product-mining-page="latest"',
  'data-amazon-product-mining-surface="history"',
  'data-amazon-product-mining-surface="publish"',
  'data-amazon-product-mining-surface="latest"',
]) {
  assert(workspace.includes(token), `Amazon Product Mining workspace must include ${token}.`);
}

assert(publish.includes("Publish Task Card"), "Amazon Product Mining publish module must render Publish Task Card.");
assert(workspace.includes("Latest Task Summary Card"), "Amazon Product Mining workspace must render Latest Task Summary Card.");
assert(history.includes("Keyword Opportunity Review History"), "Amazon Product Mining history module must render Keyword Opportunity Review History.");
assert(publish.includes("data-amazon-product-mining-publish-area"), "Publish Task Area must remain available.");
assert(history.includes("data-primary-history-surface"), "Keyword History must be the primary history surface.");
assert(workspace.indexOf('data-amazon-product-mining-surface="history"') < workspace.indexOf('data-amazon-product-mining-surface="publish"'), "Keyword History must be the default Level 2 surface before Publish Task.");
assert(workspace.includes('class="skill-page-surface publish-surface hidden"'), "Publish Task must be a secondary Level 2 surface, hidden by default.");
assert(workspace.includes('class="skill-page-surface latest-surface hidden"'), "Latest Task must be a secondary Level 2 surface, hidden by default.");
assert(client.includes("showAmazonProductMiningPage"), "Client must switch Amazon Product Mining Level 2 surfaces.");

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
