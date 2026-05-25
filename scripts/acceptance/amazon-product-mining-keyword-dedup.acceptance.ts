import assert from "node:assert/strict";

import { deduplicateKeywords, buildKeywordRecords } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword.js";

const taskId = "test-task-dedup";

// --- Test 1: No existing keywords, all new candidates pass ---
const candidates1 = ["lightweight tent", "camping cookware", "backpacking stove"];
const deduped1 = deduplicateKeywords(candidates1, [], []);
assert.deepEqual(deduped1, candidates1, "All candidates pass when no existing keywords");

// --- Test 2: Exact match dedup against existing ---
const existing = ["lightweight tent", "camping cookware"];
const deduped2 = deduplicateKeywords(candidates1, existing, []);
assert.deepEqual(deduped2, ["backpacking stove"], "Should filter out exact matches to existing");

// --- Test 3: Case-insensitive dedup ---
const candidatesWithCase = ["Lightweight Tent", "CAMPING COOKWARE", "new keyword"];
const deduped3 = deduplicateKeywords(candidatesWithCase, existing, []);
assert.deepEqual(deduped3, ["new keyword"], "Case-insensitive dedup should filter normalized matches");

// --- Test 4: Multiple-space normalization ---
const candidatesWithSpaces = ["lightweight  tent", "  camping cookware  ", "unique keyword"];
const deduped4 = deduplicateKeywords(candidatesWithSpaces, existing, []);
assert.deepEqual(deduped4, ["unique keyword"], "Multi-space and trimming normalization should deduplicate");

// --- Test 5: Deduplicate within same batch ---
const duplicatedCandidates = ["stove", "stove", "STOVE", "tent"];
const deduped5 = deduplicateKeywords(duplicatedCandidates, [], []);
assert.equal(deduped5.length, 2, "Within-batch duplicates should be removed");
assert.ok(deduped5.includes("stove"), "First occurrence of 'stove' should survive");
assert.ok(deduped5.includes("tent"), "'tent' should survive");

// --- Test 6: currentTaskKeywords cross-dedup ---
const current = ["existing keyword"];
const deduped6 = deduplicateKeywords(["existing keyword", "brand new"], [], current);
assert.deepEqual(deduped6, ["brand new"], "Should filter against currentTaskKeywords");

// --- Test 7: Empty candidates returns empty ---
const deduped7 = deduplicateKeywords([], ["something"], []);
assert.deepEqual(deduped7, [], "Empty candidates returns empty array");

// --- Test 8: buildKeywordRecords structure ---
const keywords = ["stove", "tent"];
const records = buildKeywordRecords({ taskId, keywords, aiRunId: "run-abc" });
assert.equal(records.length, 2);
assert.ok(records[0]!.keyword === "stove");
assert.equal(records[0]!.taskId, taskId);
assert.equal(records[0]!.source, "ai_generated");
assert.equal(records[0]!.aiRunId, "run-abc");
assert.equal(records[0]!.status, "pending");
assert.ok(records[0]!.keywordId.length > 0, "keywordId should be non-empty UUID");
assert.notEqual(records[0]!.keywordId, records[1]!.keywordId, "keywordIds should be unique");

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-dedup\n");
