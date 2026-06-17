import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { AiFeedInput, AiFeedResult } from "../../src/capabilities/ai-input-gateway/index.js";
import { createPick3BlindImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { verifyPick3FullHistoryCoverage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.js";
import {
  buildPick3AiGatewayInput,
  runPick3PromptExchange,
  type Pick3GatewaySender,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import {
  buildPick3PlaybookPromptPackage,
  loadBuiltInPick3Playbooks,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { writeCandidatePick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.prompt-versioning.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import {
  PICK3_LOTTERY_TYPE,
  PICK3_OFFICIAL_SOURCE,
  type Pick3Draw,
} from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const fromRepo = (path: string): string => resolve(repoRoot, path);
const readRepoText = (path: string): string => readFileSync(fromRepo(path), "utf8");
function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const misplacedLawPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 法案.md";
const manifestPath = "scripts/audit/domains/pick3-is-blind-eval/manifest.json";
const inspectorPath = "scripts/audit/domains/pick3-is-blind-eval/inspector.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const playbookLoaderPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts";
const aiExchangePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const playbookPaths = [
  "src/plugins/pick3-is-blind-eval/playbooks/system.md",
  "src/plugins/pick3-is-blind-eval/playbooks/visual-grammar.md",
  "src/plugins/pick3-is-blind-eval/playbooks/is_hundreds_l80_v1.md",
  "src/plugins/pick3-is-blind-eval/playbooks/is_tens_l80_v1.md",
  "src/plugins/pick3-is-blind-eval/playbooks/is_ones_l80_v1.md",
];

assert.equal(existsSync(fromRepo(lawPath)), true);
assert.equal(existsSync(fromRepo(blueprintPath)), true);
assert.equal(existsSync(fromRepo(manifestPath)), true);
assert.equal(existsSync(fromRepo(inspectorPath)), true);
assert.equal(existsSync(fromRepo(appShellLayoutPath)), true);
assert.equal(existsSync(fromRepo(playbookLoaderPath)), true);
assert.equal(existsSync(fromRepo(aiExchangePath)), true);
assert.equal(existsSync(fromRepo(workbenchPick3SupportPath)), true);
for (const playbookPath of playbookPaths) {
  assert.equal(existsSync(fromRepo(playbookPath)), true, `${playbookPath} must exist`);
}
assert.equal(existsSync(fromRepo(misplacedLawPath)), false);

const lawText = readRepoText(lawPath);
const blueprintText = readRepoText(blueprintPath);
const appShellLayoutText = readRepoText(appShellLayoutPath);
const workbenchPick3SupportText = readRepoText(workbenchPick3SupportPath);

for (const token of [
  "```apex-law",
  "\"capabilityDomain\": \"pick3-is-blind-eval\"",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1",
  "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1",
  "GRASSEYE-PICK3-IS-BRAIN-006-V1",
  "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1",
]) {
  assert.equal(lawText.includes(token), true, `law must include ${token}`);
}

for (const token of [
  "https://www.theuaelottery.ae/lottery/pick3",
  "https://www.theuaelottery.ae/lottery/pick3/results",
  "lotteryType=72",
  "command=660201",
  "command=660104",
  "command=660301",
  "260616",
  "4 2 7",
  "L=80",
  "no Chart #",
  "no point-count text",
  "PredictionSeal",
  "failure_replay",
  "not_valid_for_accuracy",
  "model_id",
  "temperature",
  "image_detail",
  "system_prompt_version_id",
  "business_prompt_version_id",
  "confidence_is_probability",
  "abstain",
  "coverageRate",
  "officialStartTime",
  "officialEndTime",
  "pick3_full_history_missing_earliest",
  "pick3_full_history_missing_latest",
  "pick3_full_history_date_gap",
  "one-position baseline = 50%",
  "three-position combination baseline = 12.5%",
  "three-position hit rate > 25%",
  "approximate stable per-position hit rate > 63%",
  "confidence is not probability",
  "## AGENT-Owned IS Brain",
  "pick3_playbooks",
  "Pick3PlaybookPromptPackage",
  "Pick3 Prompt Exchange",
  "pick3_ai_interactions",
  "prompt_package_id",
  "prompt_contract_id",
  "raw_response_text",
  "raw_response_hash",
  "raw_output_ref",
  "provider_proof_json",
  "parse_status",
  "parse_failed_raw_available",
  "Pick3GatewaySender",
]) {
  assert.equal(blueprintText.includes(token), true, `blueprint must include ${token}`);
}

for (const runtimePath of [
  "src/plugins/pick3-is-blind-eval/index.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.ts",
  "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts",
]) {
  assert.equal(readRepoText(runtimePath).includes("trend-intuition-brain"), false, `${runtimePath} must not read external IS brain`);
}
assert.equal(appShellLayoutText.includes('value="full_pipeline"'), true, "Pick3 App Shell must expose full_pipeline mode.");
assert.equal(workbenchPick3SupportText.includes("assembly.aiInputGateway.execute"), true, "Workbench Pick3 handle must reuse canonical AI Input Gateway.");
assert.equal(workbenchPick3SupportText.includes("pick3GatewaySender"), true, "Workbench Pick3 handle must pass Pick3GatewaySender.");
assert.equal(workbenchPick3SupportText.includes("assembly.browserController"), true, "Workbench Pick3 sender must use governed BrowserController.");

for (const playbookPath of playbookPaths) {
  const playbookText = readRepoText(playbookPath);
  for (const forbidden of ["0-4", "5-9", "0-2", "7-9"]) {
    assert.equal(playbookText.includes(forbidden), false, `${playbookPath} must not contain numeric bucket ${forbidden}`);
  }
}

const latestPayload = {
  data: {
    lotteryType: 72,
    includeSelf: 1,
    isDesc: 1,
    prePhases: 10,
    alreadyDrawn: 1,
  },
};
const encoded = Buffer.from(JSON.stringify(latestPayload), "utf8").toString("base64");
assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")), latestPayload);

const officialRow = {
  phase: "260616",
  result: [{ key: "pick3", data: ["4", "2", "7"] }],
};
const nums = officialRow.result[0]?.data ?? [];
assert.deepEqual({
  drawNo: officialRow.phase,
  hundreds: Number(nums[0]),
  tens: Number(nums[1]),
  ones: Number(nums[2]),
}, {
  drawNo: "260616",
  hundreds: 4,
  tens: 2,
  ones: 7,
});

assert.equal(0.5, 1 / 2);
assert.equal(0.125, 1 / 8);
assert.ok(Math.pow(0.63, 3) < 0.251);
assert.ok(Math.pow(0.64, 3) > 0.25);

const buildDraw = (index: number): Pick3Draw => {
  const hundreds = index % 10;
  const tens = (index * 3) % 10;
  const ones = (index * 7) % 10;
  const phase = String(260000 + index);
  const rawJson = JSON.stringify({ phase, result: [{ key: "pick3", data: [String(hundreds), String(tens), String(ones)] }] });
  return {
    source: PICK3_OFFICIAL_SOURCE,
    lotteryType: PICK3_LOTTERY_TYPE,
    phase,
    expectedPrizeTime: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T21:30:00+04:00`,
    expectedPrizeTimestamp: String(1_800_000_000_000 + index),
    resultText: `${hundreds} ${tens} ${ones}`,
    hundreds,
    tens,
    ones,
    totalWinningBetCount: null,
    resultDetailJson: "[]",
    rawJson,
    rawHash: `hash-${phase}`,
  };
};

const buildDatedDraw = (date: string, index: number): Pick3Draw => ({
  ...buildDraw(index),
  phase: date.replaceAll("-", "").slice(2),
  expectedPrizeTime: `${date} 21:30:00`,
  expectedPrizeTimestamp: String(Date.parse(`${date}T17:30:00.000Z`)),
});

function buildFixtureAiResult(input: {
  gatewayInput: AiFeedInput;
  rawText: string;
}): AiFeedResult {
  const now = new Date().toISOString();
  const inputHash = hashText(JSON.stringify(input.gatewayInput));
  const outputHash = hashText(input.rawText);
  return {
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat",
    status: "success",
    normalizedText: input.rawText,
    rawOutputRef: `artifact://pick3-fixture/${outputHash}`,
    rawOutputHash: outputHash,
    parseStatus: "json_valid",
    parsedJson: JSON.parse(input.rawText),
    schemaValidationStatus: "valid",
    providerProof: {
      providerKind: "gpt-web-chat",
      modelName: "fixture-gpt-chat",
      inputHash,
      outputHash,
      inputRefs: input.gatewayInput.inputRefs.map((ref) => ref.id),
      outputRefs: [`artifact://pick3-fixture/${outputHash}`],
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      transport: "web-chat",
      webChatUrl: "https://chatgpt.com/",
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      retryCount: 0,
      cooldownMs: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture",
    },
    failureReason: null,
    reviewRequiredReason: null,
  };
}

function oppositeLabel(label: "front" | "back"): "front" | "back" {
  return label === "front" ? "back" : "front";
}

const fullCoverageDraws = [
  buildDatedDraw("2025-06-04", 1),
  buildDatedDraw("2025-06-05", 2),
  buildDatedDraw("2025-06-06", 3),
];
verifyPick3FullHistoryCoverage({
  bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
  drawsAscending: fullCoverageDraws,
});
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: fullCoverageDraws.slice(1),
  }),
  /pick3_full_history_missing_earliest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: fullCoverageDraws.slice(0, 2),
  }),
  /pick3_full_history_missing_latest/,
);
assert.throws(
  () => verifyPick3FullHistoryCoverage({
    bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
    drawsAscending: [fullCoverageDraws[0]!, fullCoverageDraws[2]!],
  }),
  /pick3_full_history_date_gap_2025-06-05/,
);

const tempDataDir = mkdtempSync(resolve(tmpdir(), "pick3-is-blind-eval-"));
const storage = openPick3Storage(tempDataDir);
try {
  const draws = Array.from({ length: 100 }, (_, index) => buildDraw(index + 1));
  const firstUpsert = storage.upsertDraws(draws);
  assert.equal(firstUpsert.inserted, 100);
  assert.equal(firstUpsert.updated, 0);
  const secondUpsert = storage.upsertDraws(draws);
  assert.equal(secondUpsert.inserted, 0);
  assert.equal(secondUpsert.updated, 0);
  assert.equal(storage.listDrawsAscending().length, 100);

  const targets = storage.listTargetDraws({ batchSize: 2 });
  assert.equal(targets.length, 2);
  const artifactDir = resolve(tempDataDir, "artifacts", "acceptance-batch");
  const images = await createPick3BlindImages({
    artifactDir,
    batchId: "acceptance-batch",
    drawsAscending: storage.listDrawsAscending(),
    positions: ["hundreds", "tens", "ones"],
    targetDraws: targets,
  });
  assert.equal(images.length, 6);
  const playbooks = loadBuiltInPick3Playbooks();
  assert.equal(playbooks.length, 3);
  storage.upsertPlaybooks(playbooks);
  assert.equal(storage.listActivePlaybooks().length, 3);
  const promptPackages = [];
  for (const image of images) {
    assert.equal(existsSync(image.imagePath), true);
    assert.ok(statSync(image.imagePath).size > 1000);
    assert.equal(image.imagePath.includes(image.targetPhase), false);
    assert.equal(image.imagePath.includes(`answer_${image.answerDigit}`), false);
    assert.equal(image.imagePath.includes(`/${image.position}/`), false);
    assert.equal(image.imagePath.includes("Chart"), false);
    assert.equal(image.imagePath.includes("points"), false);
    const playbook = playbooks.find((item) => item.position === image.position);
    assert.ok(playbook);
    const promptPackage = buildPick3PlaybookPromptPackage(playbook, image);
    promptPackages.push(promptPackage);
    assert.equal(promptPackage.confidenceIsProbability, false);
    assert.deepEqual(promptPackage.allowedLabels, ["front", "back", "abstain"]);
    const promptJson = JSON.stringify(promptPackage);
    assert.equal(promptJson.includes(image.targetPhase), false);
    assert.equal(promptJson.includes(image.targetExpectedPrizeTime), false);
    assert.equal(promptJson.includes("answerDigit"), false);
    assert.equal(promptJson.includes("answerLabel"), false);
    assert.equal(promptJson.includes("targetPhase"), false);
    assert.equal(promptJson.includes("expectedPrizeTime"), false);
    assert.equal(promptJson.includes("trend-intuition-brain"), false);
  }
  const imageById = new Map(images.map((image) => [image.imageId, image]));
  const sampleGatewayInput = buildPick3AiGatewayInput({
    batchId: "acceptance-batch",
    image: images[0]!,
    promptPackage: promptPackages[0]!,
  });
  assert.equal(sampleGatewayInput.inputRefs.length, 1);
  assert.equal(sampleGatewayInput.textPrompt.includes("predictionLabel"), true);
  const observedInputs: AiFeedInput[] = [];
  const sender: Pick3GatewaySender = async (input) => {
    observedInputs.push(input);
    const image = imageById.get(input.inputRefs[0]?.id ?? "");
    assert.ok(image);
    const predictionLabel = observedInputs.length === 1 ? oppositeLabel(image.answerLabel) : image.answerLabel;
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        predictionLabel,
        confidence: 0.56,
        reason: "tail shape is clear enough for this fixture",
        abstainReason: null,
      }),
    });
  };
  const exchange = await runPick3PromptExchange({
    artifactDir,
    images,
    promptPackages,
    sender,
  });
  assert.equal(observedInputs.length, images.length);
  assert.equal(exchange.interactions.length, images.length);
  assert.equal(exchange.predictions.length, images.length);
  assert.equal(exchange.interactions.every((interaction) => interaction.parseStatus === "parsed"), true);
  assert.equal(exchange.predictions.every((prediction) => prediction.sealedBeforeReveal), true);
  storage.insertAiInteractions(exchange.interactions);
  storage.insertPredictions(exchange.predictions);
  assert.equal(storage.listAiInteractions("acceptance-batch").length, images.length);
  assert.equal(storage.listPredictions("acceptance-batch").length, images.length);

  const reveals = revealPick3Predictions({ images, predictions: exchange.predictions });
  storage.insertReveals(reveals);
  assert.equal(storage.listReveals("acceptance-batch").length, images.length);
  const scoring = scorePick3Predictions({ predictions: exchange.predictions, reveals });
  assert.equal(scoring.total, images.length);
  assert.equal(scoring.misses, 1);
  assert.equal(scoring.hits, images.length - 1);
  assert.equal(scoring.randomBaseline.onePositionFrontBack, 0.5);
  assert.equal(scoring.randomBaseline.threePositionCombination, 0.125);
  assert.equal(scoring.calibration.every((row) => row.confidenceIsProbability === false), true);

  const failureReviews = reviewPick3Failures({ images, predictions: exchange.predictions, reveals });
  storage.insertFailureReviews(failureReviews);
  assert.equal(failureReviews.length, 1);
  assert.equal(storage.listFailureReviews("acceptance-batch").length, 1);
  const candidatePlaybooks = writeCandidatePick3Playbooks({
    artifactDir,
    activePlaybooks: playbooks,
    failureReviews,
  });
  storage.upsertPlaybooks(candidatePlaybooks);
  assert.equal(candidatePlaybooks.length, 1);
  assert.equal(candidatePlaybooks[0]?.status, "candidate");
  assert.equal(readFileSync(candidatePlaybooks[0]!.contentPath, "utf8").includes("Do not memorize concrete answers"), true);

  const badExchange = await runPick3PromptExchange({
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        predictionLabel: "not-a-label",
        confidence: 0.56,
        reason: "invalid fixture",
      abstainReason: null,
      }),
    }),
  });
  assert.equal(badExchange.interactions.length, 1);
  assert.equal(badExchange.interactions[0]?.parseStatus, "parse_failed_raw_available");
  assert.equal(badExchange.predictions.length, 0);
} finally {
  storage.close();
}

console.log("pick3-is-blind-eval acceptance passed");
