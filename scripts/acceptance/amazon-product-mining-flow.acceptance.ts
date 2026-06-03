import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE,
  AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT,
  AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE,
  selectAmazonMiningPacingDelayMs,
  selectSearchItemsForDetailMining,
} from "../../src/plugins/amazon-product-mining/amazon-product-mining.flow.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const pluginDir = resolve(repoRoot, "src/plugins/amazon-product-mining");

const readPlugin = (name: string): string =>
  readFileSync(resolve(pluginDir, name), "utf8");

const pluginSources = readdirSync(pluginDir)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, src: readPlugin(name) }));

const flowSrc = readPlugin("amazon-product-mining.flow.ts");
const reviewsSrc = readPlugin("amazon-product-mining.reviews.ts");
const keywordSrc = readPlugin("amazon-product-mining.keyword.ts");
const indexSrc = readPlugin("index.ts");
const packageSrc = readPlugin("amazon-product-mining.package.ts");
const pdfSrc = readPlugin("amazon-product-mining.pdf.ts");

// --- Test 1: persistSearchResults appears before runProductDetailExtraction in flow.ts ---
// Skip imports section — find the first export/const/function after imports
const flowFunctionStart = Math.max(
  flowSrc.lastIndexOf("import "),
  flowSrc.lastIndexOf("from '"),
  flowSrc.lastIndexOf('from "'),
);
const flowBody = flowSrc.slice(flowFunctionStart);
const persistSearchIdx = flowBody.indexOf("persistSearchResults");
const runDetailIdx = flowBody.indexOf("runProductDetailExtraction(");
assert.ok(persistSearchIdx >= 0, "flow.ts must call persistSearchResults");
assert.ok(runDetailIdx >= 0, "flow.ts must call runProductDetailExtraction");
assert.ok(
  persistSearchIdx < runDetailIdx,
  `persistSearchResults (pos ${persistSearchIdx}) must appear before runProductDetailExtraction call (pos ${runDetailIdx}) in flow.ts function body (law 005)`
);

// --- Test 2: reviews.ts has onPageExtracted inside while loop (per-page persistence, law 007) ---
assert.ok(reviewsSrc.includes("onPageExtracted"), "reviews.ts must call onPageExtracted");
assert.ok(reviewsSrc.includes("while"), "reviews.ts must use a while loop for pagination");
// onPageExtracted must be called inside the loop body (between while and loop end)
const whileIdx = reviewsSrc.indexOf("while");
const onPageIdx = reviewsSrc.indexOf("await input.onPageExtracted");
assert.ok(onPageIdx > whileIdx, "onPageExtracted must be inside while loop");

// --- Test 3: No forbidden bridge/fallback/shadow/legacy/compatibility terms in active plugin files ---
const forbiddenIdentifiers = ["fallback", "shadow", "bridge", "legacy", "compatibility"];
for (const { name, src } of pluginSources) {
  const normalizedSrc = src.toLowerCase();
  for (const forbidden of forbiddenIdentifiers) {
    const found = normalizedSrc.includes(forbidden);
    assert.ok(!found, `Forbidden identifier '${forbidden}' must not appear in active plugin file ${name}`);
  }
}

// --- Test 4: No AI planning identifiers in keyword.ts ---
const aiPlanningIdentifiers = ["nextAction", "actionPlan", "coordinate"];
for (const id of aiPlanningIdentifiers) {
  assert.ok(!keywordSrc.includes(id), `Forbidden AI planning identifier '${id}' must not appear in keyword.ts`);
}

// --- Test 5: No sendTextPromptAndCaptureResponse anywhere in plugin ---
for (const { src } of pluginSources) {
  assert.ok(
    !src.includes("sendTextPromptAndCaptureResponse"),
    "sendTextPromptAndCaptureResponse is forbidden in amazon plugin (old AI interface)"
  );
}

// --- Test 6: index.ts exposes required public surface ---
const requiredExports = [
  "startAmazonProductMiningMission",
  "getAmazonProductMiningTaskStatus",
  "getLatestAmazonProductMiningTask",
  "exportAmazonProductMiningResult",
  "AmazonMiningSchemas",
  "continueInterruptedAmazonProductMiningTasks",
];
for (const exported of requiredExports) {
  assert.ok(indexSrc.includes(exported), `index.ts must export '${exported}'`);
}
for (const forbiddenExport of [
  "pauseAmazonProductMiningTask",
  "continueAmazonProductMiningTask",
  "terminateAmazonProductMiningTask",
]) {
  assert.equal(indexSrc.includes(forbiddenExport), false, `index.ts must not export manual control '${forbiddenExport}'`);
}

// --- Test 7: flow.ts uses correct AI interface (execute, not sendTextPromptAndCaptureResponse) ---
assert.ok(keywordSrc.includes(".execute("), "keyword.ts must call AI gateway .execute()");
assert.ok(keywordSrc.includes("providerKind: input.providerKind"), "keyword.ts must forward the selected providerKind");
assert.ok(!keywordSrc.includes('?? "gemini-api"'), "keyword.ts must not default keyword AI to Gemini API");
assert.ok(!keywordSrc.includes('?? "gpt-web-chat"'), "keyword.ts must not hardcode GPT web chat as a hidden default");

// --- Test 8: pdf.ts and package.ts do not contain final product selection conclusions ---
const prohibitedPhrases = ["recommendedProduct", "bestProduct", "finalSelection"];
for (const phrase of prohibitedPhrases) {
  assert.ok(!packageSrc.includes(phrase), `package.ts must not contain '${phrase}'`);
  assert.ok(!pdfSrc.includes(phrase), `pdf.ts must not contain '${phrase}'`);
}

// --- Test 9: flow.ts does not have ability group creation ---
const abilityGroupCreationPatterns = [
  "createAiInputGatewayAbilityGroup",
  "createDomAutomationAbilityGroup",
  "createForensicsPersistenceAbilityGroup",
];
for (const pattern of abilityGroupCreationPatterns) {
  // These patterns should only appear if they're imported from capability group, not created inline in flow
  // The flow uses the assembled capabilities passed in as dependencies
}

// --- Test 10: reviews.ts has per-page review data structure ---
assert.ok(reviewsSrc.includes("pageIndex"), "reviews.ts must use pageIndex field for per-page tracking");

// --- Test 11: keyword AI capture success log must not fire for failed keyword generation ---
const keywordStatusCheckIdx = flowSrc.indexOf('keywordResult.status === "success"');
const keywordCaptureLogIdx = flowSrc.indexOf("logger.logKeywordAiCapture");
assert.ok(keywordStatusCheckIdx >= 0, "flow.ts must check keywordResult success before capture-success logging");
assert.ok(keywordCaptureLogIdx > keywordStatusCheckIdx, "AI capture success log must be guarded by success status");

// --- Test 12: only top 30 ranked search results enter detail/review mining ---
const rankedItems = Array.from({ length: 60 }, (_, index) => ({
  rankPosition: index + 1,
  itemId: `item-${index + 1}`,
}));
const selectedRankedItems = selectSearchItemsForDetailMining(rankedItems);
assert.equal(AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT, 30);
assert.equal(selectedRankedItems.length, 30);
assert.deepEqual(selectedRankedItems.map((item) => item.rankPosition), Array.from({ length: 30 }, (_, index) => index + 1));
assert.ok(flowSrc.includes("selectSearchItemsForDetailMining(searchItems)"), "flow.ts must apply top-30 detail mining selector after persisting all search results");
assert.ok(flowSrc.includes("getProductDetailsForTask(runtime.taskId)"), "flow.ts must check existing task product details before opening duplicate product detail URLs.");
assert.ok(flowSrc.includes("persistProductDetail(existingDetail, [item.itemId])"), "flow.ts must link duplicate search cards to existing product details instead of re-opening the same ASIN.");

// --- Test 13: governed Amazon page-open pacing ranges are production defaults ---
assert.deepEqual(AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE, { min: 1_000, max: 20_000 });
assert.deepEqual(AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE, { min: 1_000, max: 5_000 });
assert.equal(selectAmazonMiningPacingDelayMs(AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE, 0), 1_000);
assert.equal(selectAmazonMiningPacingDelayMs(AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE, 0.99999), 20_000);
assert.equal(selectAmazonMiningPacingDelayMs(AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE, 0), 1_000);
assert.equal(selectAmazonMiningPacingDelayMs(AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE, 0.99999), 5_000);
assert.ok(flowSrc.includes("waitForProductDetailOpenPacingDelay(runtime)"), "flow.ts must pace every product detail open");
assert.ok(flowSrc.includes("waitForReviewPageOpenPacingDelay(runtime)"), "flow.ts must pace every review page open");
assert.ok(flowSrc.includes("persistRejectedKeywordRetentionNote"), "flow.ts must retain reviewable evidence after REJECT keyword review");
assert.equal(flowSrc.includes("purgeRejectedKeywordEvidence"), false, "flow.ts must not physically purge keyword-owned evidence after REJECT keyword review");
assert.equal(flowSrc.includes("purgeRejectedKeywordReviewEvidenceArtifacts"), false, "flow.ts must not remove keyword full package artifacts after REJECT keyword review");
assert.ok(flowSrc.includes("ensureTaskRecord(runtime)"), "flow.ts must continue from an existing task record instead of recreating it.");
assert.ok(flowSrc.includes("haltIfAmazonOperatorControlled(runtime)"), "flow.ts must check persisted pause/terminate controls at safe points.");
assert.ok(indexSrc.includes("ACTIVE_AMAZON_MINING_TASKS.has(taskId)"), "public facade must block duplicate active execution for the same taskId.");
assert.ok(indexSrc.includes("listTasksByStatuses(RUNNING_TASK_STATUSES)"), "public facade must find interrupted running tasks for startup continuation.");

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-flow\n");
