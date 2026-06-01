import assert from "node:assert/strict";

import { deduplicateKeywords, buildKeywordRecords, runKeywordGeneration } from "../../src/plugins/amazon-product-mining/amazon-product-mining.keyword.js";

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

// --- Test 6.1: historical near-duplicate phrases must not bypass exact keyword dedup ---
const nearDuplicateCandidates = ["shoe rack organizer", "fresh kitchen mat", "led strip light"];
const nearDuplicateExisting = ["shoe rack", "led strip lights"];
const dedupedNearDuplicates = deduplicateKeywords(nearDuplicateCandidates, nearDuplicateExisting, []);
assert.deepEqual(dedupedNearDuplicates, ["fresh kitchen mat"], "Near-duplicate keyword expansions must be filtered before AI refill.");

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

// --- Test 9: keyword AI request obeys selected gateway provider and no file payload ---
let capturedAiInput: { providerKind?: unknown; maxFileCount?: unknown; maxFileBytes?: unknown; textPrompt?: unknown } = {};
const aiInputGateway = {
  abilityGroupId: "ai-input-gateway" as const,
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once" as const],
  async execute(input: unknown) {
    capturedAiInput = input as Record<string, unknown>;
    return {
      abilityGroupId: "ai-input-gateway" as const,
      childCapabilityId: "feed-gpt-web-chat-once" as const,
      providerKind: "gpt-web-chat" as const,
      status: "success" as const,
      normalizedText: JSON.stringify({ keywords: [{ keyword: "foldable storage box", reason: "lightweight" }] }),
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "json_valid" as const,
      parsedJson: null,
      schemaValidationStatus: "not_applicable" as const,
      providerProof: {
        providerKind: "gpt-web-chat" as const,
        modelName: null,
        inputHash: "hash-in",
        outputHash: "hash-out",
        inputRefs: [],
        outputRefs: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0,
        transport: "web-chat" as const,
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        retryCount: 0,
        cooldownMs: 0,
        estimatedInputTokens: null,
        estimatedOutputTokens: null,
        tokenEstimateUnavailableReason: null,
      },
      failureReason: null,
      reviewRequiredReason: null,
    };
  },
};
await runKeywordGeneration({
  taskId,
  aiInputGateway,
  existingMinedKeywords: [],
  miningInput: {
    amazonMarketplace: "amazon.ae",
    targetMarket: "United Arab Emirates",
    productDirection: "China supply products",
    requestedKeywordCount: 1,
    languagePreference: "en",
    providerKind: "gpt-web-chat",
  },
  providerKind: "gpt-web-chat",
});
assert.equal(capturedAiInput?.providerKind, "gpt-web-chat", "Keyword generation must use the provider selected by the user");
assert.equal(capturedAiInput?.maxFileCount, 0, "Keyword generation must not attach files");
assert.equal(capturedAiInput?.maxFileBytes, 1, "Keyword generation must pass a positive file-byte budget");
assert.equal(typeof capturedAiInput?.textPrompt, "string", "Keyword generation must send a governed prompt");
const capturedPrompt = typeof capturedAiInput.textPrompt === "string" ? capturedAiInput.textPrompt : "";
assert.ok(capturedPrompt.length > 0, "Keyword generation prompt must be readable text");
assert.ok(capturedPrompt.includes("The system only supplies marketplace, market, user product direction, deduplication data, and JSON format rules"), "Keyword prompt must keep the system role to format and dedup only.");
assert.ok(capturedPrompt.includes("If the user mentions China suppliers, treat it only as sourcing background"), "Keyword prompt must not turn China supplier background into product trait constraints.");
assert.ok(capturedPrompt.includes("Do not add or infer these constraints unless they appear in the user's Product Direction"), "Keyword prompt must forbid system-invented size or shipping constraints.");

// --- Test 10: keyword AI must receive historical keywords and refill duplicate responses instead of silently accepting shortage ---
const capturedPrompts: string[] = [];
let generationCallCount = 0;
const refillGateway = {
  abilityGroupId: "ai-input-gateway" as const,
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once" as const],
  async execute(input: unknown) {
    const prompt = (input as { textPrompt?: string }).textPrompt ?? "";
    capturedPrompts.push(prompt);
    generationCallCount += 1;
    const keywords = generationCallCount === 1
      ? ["water bottle", "shoe rack", "fresh kitchen mat"]
      : ["fresh kitchen mat", "new cabinet organizer"];
    return {
      abilityGroupId: "ai-input-gateway" as const,
      childCapabilityId: "feed-gpt-web-chat-once" as const,
      providerKind: "gpt-web-chat" as const,
      status: "success" as const,
      normalizedText: JSON.stringify({ keywords: keywords.map((keyword) => ({ keyword })) }),
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "json_valid" as const,
      parsedJson: null,
      schemaValidationStatus: "not_applicable" as const,
      providerProof: {
        providerKind: "gpt-web-chat" as const,
        modelName: null,
        inputHash: "hash-in",
        outputHash: "hash-out",
        inputRefs: [],
        outputRefs: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0,
        transport: "web-chat" as const,
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        retryCount: 0,
        cooldownMs: 0,
        estimatedInputTokens: null,
        estimatedOutputTokens: null,
        tokenEstimateUnavailableReason: null,
      },
      failureReason: null,
      reviewRequiredReason: null,
    };
  },
};
const refillResult = await runKeywordGeneration({
  taskId,
  aiInputGateway: refillGateway,
  existingMinedKeywords: ["water bottle", "shoe rack"],
  miningInput: {
    amazonMarketplace: "amazon.ae",
    targetMarket: "United Arab Emirates",
    productDirection: "China supply products",
    requestedKeywordCount: 2,
    languagePreference: "en",
    providerKind: "gpt-web-chat",
  },
  providerKind: "gpt-web-chat",
});
assert.equal(refillResult.status, "success");
assert.deepEqual(refillResult.dedupedKeywords, ["fresh kitchen mat", "new cabinet organizer"]);
assert.equal(refillResult.runs.length, 2, "Duplicate-heavy first answer must trigger same-stage refill");
assert.ok(capturedPrompts[0]?.includes("Historical keyword exclusions for this canonical marketplace/target market"));
assert.ok(capturedPrompts[0]?.includes("- water bottle"));
assert.ok(capturedPrompts[0]?.includes("- shoe rack"));
assert.ok(capturedPrompts[1]?.includes("- fresh kitchen mat"), "Refill prompt must also exclude already accepted current-task keywords");

// --- Test 11: keyword generation must fail honestly when refills cannot reach requested new count ---
const shortageGateway = {
  ...refillGateway,
  async execute(input: unknown) {
    capturedPrompts.push((input as { textPrompt?: string }).textPrompt ?? "");
    return {
      ...(await refillGateway.execute(input)),
      normalizedText: JSON.stringify({ keywords: [{ keyword: "water bottle" }] }),
    };
  },
};
const shortageResult = await runKeywordGeneration({
  taskId,
  aiInputGateway: shortageGateway,
  existingMinedKeywords: ["water bottle"],
  miningInput: {
    amazonMarketplace: "amazon.ae",
    targetMarket: "United Arab Emirates",
    productDirection: "China supply products",
    requestedKeywordCount: 2,
    languagePreference: "en",
    providerKind: "gpt-web-chat",
  },
  providerKind: "gpt-web-chat",
});
assert.equal(shortageResult.status, "failed");
assert.equal(shortageResult.failureReason?.includes("keyword_generation_insufficient_new_keywords"), true);

process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-dedup\n");
