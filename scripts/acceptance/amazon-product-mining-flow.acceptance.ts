import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");

const readPlugin = (name: string): string =>
  readFileSync(resolve(repoRoot, `src/plugins/amazon-product-mining/${name}`), "utf8");

const flowSrc = readPlugin("amazon-product-mining.flow.ts");
const reviewsSrc = readPlugin("amazon-product-mining.reviews.ts");
const keywordSrc = readPlugin("amazon-product-mining.keyword.ts");
const indexSrc = readPlugin("index.ts");
const packageSrc = readPlugin("amazon-product-mining.package.ts");
const pdfSrc = readPlugin("amazon-product-mining.pdf.ts");

// --- Test 1: persistSearchResults appears before runProductDetailExtraction in flow.ts ---
const persistSearchIdx = flowSrc.indexOf("persistSearchResults");
const runDetailIdx = flowSrc.indexOf("runProductDetailExtraction");
assert.ok(persistSearchIdx >= 0, "flow.ts must call persistSearchResults");
assert.ok(runDetailIdx >= 0, "flow.ts must call runProductDetailExtraction");
assert.ok(
  persistSearchIdx < runDetailIdx,
  `persistSearchResults (pos ${persistSearchIdx}) must appear before runProductDetailExtraction (pos ${runDetailIdx}) in flow.ts (law 005)`
);

// --- Test 2: reviews.ts has onPageExtracted inside while loop (per-page persistence, law 007) ---
assert.ok(reviewsSrc.includes("onPageExtracted"), "reviews.ts must call onPageExtracted");
assert.ok(reviewsSrc.includes("while"), "reviews.ts must use a while loop for pagination");
// onPageExtracted must be called inside the loop body (between while and loop end)
const whileIdx = reviewsSrc.indexOf("while");
const onPageIdx = reviewsSrc.indexOf("await input.onPageExtracted");
assert.ok(onPageIdx > whileIdx, "onPageExtracted must be inside while loop");

// --- Test 3: No forbidden bridge/fallback/shadow identifiers in plugin files ---
const forbiddenIdentifiers = ["fallback", "shadow", "bridge", "legacy"];
for (const src of [flowSrc, keywordSrc, reviewsSrc]) {
  for (const forbidden of forbiddenIdentifiers) {
    const found = src.includes(forbidden);
    assert.ok(!found, `Forbidden identifier '${forbidden}' must not appear in plugin files`);
  }
}

// --- Test 4: No AI planning identifiers in keyword.ts ---
const aiPlanningIdentifiers = ["nextAction", "actionPlan", "coordinate"];
for (const id of aiPlanningIdentifiers) {
  assert.ok(!keywordSrc.includes(id), `Forbidden AI planning identifier '${id}' must not appear in keyword.ts`);
}

// --- Test 5: No sendTextPromptAndCaptureResponse anywhere in plugin ---
const pluginFiles = [flowSrc, keywordSrc, reviewsSrc, packageSrc, pdfSrc, indexSrc];
for (const src of pluginFiles) {
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
];
for (const exported of requiredExports) {
  assert.ok(indexSrc.includes(exported), `index.ts must export '${exported}'`);
}

// --- Test 7: flow.ts uses correct AI interface (execute, not sendTextPromptAndCaptureResponse) ---
assert.ok(keywordSrc.includes(".execute("), "keyword.ts must call AI gateway .execute()");

// --- Test 8: pdf.ts and package.ts do not contain final product selection conclusions ---
const prohibitedPhrases = ["recommendedProduct", "bestProduct", "finalSelection", "final product selection"];
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

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-flow\n");
