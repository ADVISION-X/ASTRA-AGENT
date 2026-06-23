import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { buildPick3AiGatewayInput, runPick3PromptExchange } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { parsePick3Prediction } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai-parse.js";
import { getPick3HumanReviewTask, listPick3HumanReviewHistory } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.js";
import { createPick3BlindImages, createPick3NextPredictionImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { Pick3InputSchema, type Pick3TaskRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { runPick3NextPredictionStability } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.stability.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import { buildDraw, buildFixtureAiResult, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";

const tempDataDir = mkdtempSync(resolve(tmpdir(), "pick3-free-analysis-"));
const artifactDir = resolve(tempDataDir, "artifacts", "free-analysis-batch");
const drawsAscending = Array.from({ length: 100 }, (_, index) => buildDraw(index + 1));
const images = await createPick3BlindImages({ artifactDir, batchId: "free-analysis-batch", drawsAscending, positions: ["hundreds"], targetDraws: [drawsAscending[99]!] });
const playbooks = loadBuiltInPick3Playbooks("free_analysis_strict_reasoning");
const promptPackage = buildPick3PlaybookPromptPackage(playbooks.find((item) => item.position === "hundreds")!, images[0]!, "free_analysis_strict_reasoning");
const gatewayInput = buildPick3AiGatewayInput({ batchId: "free-analysis-batch", image: images[0]!, promptPackage, providerKind: "gemini-web-chat" });
assert.equal(promptPackage.promptMode, "free_analysis_strict_reasoning");
assert.equal(gatewayInput.promptContractId, "pick3-is-blind-eval-free-analysis-one-image-v1");
for (const forbidden of ["sharp_top", "bare_low", "shoulder_hold", "tailShapes", "zoneWeight", "visual-grammar"]) assert.equal(gatewayInput.textPrompt.includes(forbidden), false, `Free Analysis prompt must not include ${forbidden}`);
for (const required of ["Strict reasoning requirements", "chartReading", "recentBehavior", "supportingEvidence", "counterEvidence", "decisionLogic"]) assert.equal(gatewayInput.textPrompt.includes(required), true, `Free Analysis prompt must include ${required}`);

const completeFreeAnalysisOutput = (input: Record<string, unknown>): Record<string, unknown> => ({
  zoneCount: { lowerCount: 41, upperCount: 39, uncertainCount: 0 },
  patternRecurrence: "The cited behavior appears four times in the L80 window, and three of those occurrences support the selected continuation.",
  weakestLink: "The weakest link is that the final visible movement could still be short-term noise rather than durable continuation.",
  ...input,
});

const completePlaybookOutput = (input: Record<string, unknown>): Record<string, unknown> => ({
  tailShapes: ["sharp_top"],
  zoneWeight: "lower_weighted",
  drivingEvidence: "sharp_top drove the lower conclusion",
  discountedEvidence: null,
  reason: "The tail shows sharp_top with lower_weighted zone pressure, so the visible evidence supports the selected continuation.",
  abstainReason: null,
  ...input,
});

const validExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
  artifactDir,
  images: [images[0]!],
  promptPackages: [promptPackage],
  providerKind: "gemini-web-chat",
  sender: async (input) => buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(completeFreeAnalysisOutput({
    imageId: input.inputRefs[0]?.id,
    promptPackageId: visiblePromptPackageId(input),
    predictionLabel: "lower",
    confidence: 4,
    chartReading: "The full visible L80 series alternates around the midline with repeated swings, but the later part spends more time losing altitude than building a durable upper platform.",
    recentBehavior: "The most recent visible segment bends down from a higher area and does not show a strong rebound before the hidden next point.",
    supportingEvidence: ["recent downward bend", "lack of late rebound"],
    counterEvidence: ["the full window is not one-sided"],
    decisionLogic: "The recent segment is the most relevant continuation clue, and its downward bend outweighs the broader mixed window because no late recovery structure appears before the hidden point.",
    abstainReason: null,
  })) }),
});
assert.equal(validExchange.predictions.length, 1);
assert.equal(validExchange.predictions[0]?.predictionLabel, "front");
assert.equal(validExchange.predictions[0]?.confidence, 0.4);
assert.equal(validExchange.predictions[0]?.tailShapes, null);
assert.equal(validExchange.predictions[0]?.zoneWeight, null);
assert.match(validExchange.predictions[0]?.reason ?? "", /chartReading:/);
const freeAnalysisFullPipelineInput = Pick3InputSchema.parse({
  mode: "full_pipeline",
  promptMode: "free_analysis_strict_reasoning",
  providerKind: "gemini-web-chat",
  batchSize: 1,
  positions: ["hundreds"],
  dryRun: false,
});
assert.equal(freeAnalysisFullPipelineInput.mode, "full_pipeline");
assert.equal(freeAnalysisFullPipelineInput.promptMode, "free_analysis_strict_reasoning");
assert.notEqual(String(freeAnalysisFullPipelineInput.mode), "next_prediction_stability");

const percentageConfidenceExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
  artifactDir,
  images: [images[0]!],
  promptPackages: [promptPackage],
  providerKind: "gemini-web-chat",
  sender: async (input) => buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(completeFreeAnalysisOutput({
    imageId: input.inputRefs[0]?.id,
    promptPackageId: visiblePromptPackageId(input),
    predictionLabel: "upper",
    confidence: 65,
    chartReading: "The full visible L80 series is volatile around the midline with repeated upper-zone peaks and lower-zone troughs, but it retains a bounded oscillatory structure.",
    recentBehavior: "The most recent visible segment holds above the midline after a rebound and shows a short upper-zone consolidation before the hidden point.",
    supportingEvidence: ["recent upper-zone hold", "late rebound stayed above the midline"],
    counterEvidence: ["the full window often mean-reverts after upper-zone holds"],
    decisionLogic: "The latest upper-zone hold carries more immediate continuation weight than the broader mean-reversion risk because the final visible points have not broken back below the midline.",
    abstainReason: null,
  })) }),
});
assert.equal(percentageConfidenceExchange.predictions.length, 1);
assert.equal(percentageConfidenceExchange.predictions[0]?.predictionLabel, "back");
assert.equal(percentageConfidenceExchange.predictions[0]?.confidence, 0.65);

const validAbstainExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
  artifactDir,
  images: [images[0]!],
  promptPackages: [promptPackage],
  providerKind: "gemini-web-chat",
  sender: async (input) => buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(completeFreeAnalysisOutput({
    imageId: input.inputRefs[0]?.id,
    promptPackageId: visiblePromptPackageId(input),
    predictionLabel: "abstain",
    confidence: null,
    chartReading: "The full visible L80 series is highly volatile around the midline with repeated sharp reversals and no durable one-sided trend across the whole window.",
    recentBehavior: "The latest segment rises and falls back into a flat midline area, leaving no clear directional break before the hidden point.",
    supportingEvidence: [],
    counterEvidence: [],
    decisionLogic: "Because the final visible points sit at the midline after mixed swings, the evidence does not support either a lower or upper call more strongly.",
    abstainReason: "The final visible points are balanced at the midline with no clear momentum or pattern advantage.",
  })) }),
});
assert.equal(validAbstainExchange.predictions.length, 1);
assert.equal(validAbstainExchange.predictions[0]?.predictionLabel, "abstain");
assert.match(validAbstainExchange.predictions[0]?.drivingEvidence ?? "", /balanced at the midline/);

const invalidExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
  artifactDir,
  images: [images[0]!],
  promptPackages: [promptPackage],
  providerKind: "gemini-web-chat",
  sender: async (input) => buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify({
    imageId: input.inputRefs[0]?.id,
    promptPackageId: visiblePromptPackageId(input),
    predictionLabel: "upper",
    confidence: 0.55,
    chartReading: "too short",
    recentBehavior: "too short",
    supportingEvidence: [],
    counterEvidence: [],
    decisionLogic: "too short",
    abstainReason: null,
  }) }),
});
assert.equal(invalidExchange.predictions.length, 0);
assert.equal(invalidExchange.interactions[0]?.parseFailureReason, "pick3_free_analysis_chart_reading_missing");

const freeAnalysisParseInput = {
  expectedImageId: "free-analysis-probe-image",
  expectedPromptPackageId: "free-analysis-probe-package",
  promptMode: "free_analysis_strict_reasoning" as const,
};
const validFreeAnalysisFixture = completeFreeAnalysisOutput({
  imageId: "free-analysis-probe-image",
  promptPackageId: "free-analysis-probe-package",
  predictionLabel: "lower",
  confidence: 0.6,
  chartReading: "The anonymous L80 line moves through alternating zones with enough visible structure to compare the final segment against the broader window without using any hidden answer or outside identity clue.",
  recentBehavior: "The most recent visible segment changes slope near the right edge and creates a clear continuation question for the hidden next point while still leaving enough tail movement to analyze.",
  supportingEvidence: ["latest segment has a readable slope change", "the line remains visually inspectable at the right edge"],
  counterEvidence: ["the broader L80 window has mixed movement"],
  decisionLogic: "Probe fixture for zoneCount, patternRecurrence, and weakestLink validation. The answer uses only visible L80 structure and does not rely on hidden identity or any future answer.",
  abstainReason: null,
});
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify(validFreeAnalysisFixture) }).parsed !== null, true);
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, zoneCount: undefined }) }).reason, "pick3_free_analysis_zone_count_invalid");
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, zoneCount: { lowerCount: 29, upperCount: 26, uncertainCount: 5 } }) }).parsed !== null, true);
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, zoneCount: { lowerCount: 41.5, upperCount: 39, uncertainCount: 0 } }) }).reason, "pick3_free_analysis_zone_count_invalid");
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, zoneCount: { lowerCount: 29, upperCount: 26 } }) }).reason, "pick3_free_analysis_zone_count_invalid", "uncertainCount is now a required third zoneCount field, not optional");
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, patternRecurrence: undefined }) }).reason, "pick3_free_analysis_pattern_recurrence_missing");
assert.equal(parsePick3Prediction({ ...freeAnalysisParseInput, rawText: JSON.stringify({ ...validFreeAnalysisFixture, weakestLink: undefined }) }).reason, "pick3_free_analysis_weakest_link_missing");

const nextStorage = openPick3Storage(tempDataDir);
try {
  nextStorage.upsertDraws(drawsAscending);
  const nextImages = await createPick3NextPredictionImages({
    artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability"),
    batchId: "free-analysis-next-stability",
    drawsAscending,
    positions: ["hundreds"],
  });
  assert.equal(nextImages.length, 1);
  assert.equal(nextImages[0]?.answerDigit, null);
  assert.equal(nextImages[0]?.answerLabel, null);
  assert.equal(nextImages[0]?.targetPhase, `next_after_${drawsAscending[drawsAscending.length - 1]?.phase}`);
  const stabilityInputs: AiFeedInput[] = [];
  const stabilitySummary = await runPick3NextPredictionStability({
    batch: {
      batchId: "free-analysis-next-stability",
      artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability"),
      imageCount: nextImages.length,
      sealedAnswersHash: "free-analysis-next-stability-no-answer",
      images: nextImages,
      playbooks,
      promptPackages: [],
    },
    batchInput: {
      mode: "next_prediction_stability",
      providerKind: "gemini-web-chat",
      source: "theuaelottery",
      promptMode: "free_analysis_strict_reasoning",
      lotteryType: 72,
      windowSize: 80,
      batchSize: 5,
      positions: ["hundreds"],
      dryRun: false,
    },
    storage: nextStorage,
    sender: async (input) => {
      stabilityInputs.push(input);
      const predictionLabel = stabilityInputs.length <= 3 ? "upper" : "lower";
      return buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(completeFreeAnalysisOutput({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel,
        confidence: 0.57,
        chartReading: "The repeated next-image fixture keeps the same anonymous L80 chart and makes the model judge the same visible line without any hidden answer.",
        recentBehavior: "The final visible segment stays readable across each repeat, so the test can prove batch count and drift capture on the identical image.",
        supportingEvidence: ["same image reference is reused", "repeat calls are persisted separately"],
        counterEvidence: ["fixture intentionally changes returned labels to simulate drift"],
        decisionLogic: "The fixture intentionally returns this label from the same image repeat so the stability test can prove repeated free-analysis calls are independently persisted and can disagree without the system choosing a final answer.",
        abstainReason: null,
      })) });
    },
  });
  assert.equal(stabilityInputs.length, 5);
  assert.equal(stabilitySummary.repeatCount, 5);
  assert.equal(stabilitySummary.results.length, 5);
  assert.equal(new Set(stabilityInputs.map((input) => input.inputRefs[0]?.id)).size, 1);
  assert.equal(stabilityInputs.every((input) => input.promptContractId === "pick3-is-blind-eval-free-analysis-one-image-v1"), true);
  assert.equal(stabilityInputs.every((input) => input.textPrompt.includes("Strict reasoning requirements")), true);
  assert.equal(stabilityInputs.some((input) => input.textPrompt.includes("tailShapes") || input.textPrompt.includes("zoneWeight")), false);
  assert.deepEqual(stabilitySummary.results.map((result) => result.predictionLabel), ["back", "back", "back", "front", "front"]);
  assert.deepEqual([...new Set(stabilitySummary.results.map((result) => result.visiblePredictionLabel))].sort(), ["lower", "upper"]);
  const taskRecord: Pick3TaskRecord = {
    taskId: "free-analysis-next-stability-task",
    mode: "next_prediction_stability",
    promptMode: "free_analysis_strict_reasoning",
    status: "success",
    reachedStep: "next_prediction_stability_complete",
    reason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sync: {
      runId: "free-analysis-next-stability-sync",
      status: "success",
      officialStartTime: "fixture-start",
      officialEndTime: "fixture-end",
      rowsSeen: drawsAscending.length,
      rowsInserted: drawsAscending.length,
      rowsUpdated: 0,
      newestPhase: drawsAscending[drawsAscending.length - 1]?.phase ?? null,
      oldestPhase: drawsAscending[0]?.phase ?? null,
      reason: null,
      officialApiResponseHash: "fixture-official-hash",
    },
    batch: {
      batchId: "free-analysis-next-stability",
      artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability"),
      imageCount: nextImages.length,
      sealedAnswersHash: "free-analysis-next-stability-no-answer",
      images: nextImages,
    },
    scoring: null,
    stability: stabilitySummary,
  };
  nextStorage.writeTask(taskRecord);
  const history = listPick3HumanReviewHistory(tempDataDir);
  assert.equal(history[0]?.taskId, taskRecord.taskId);
  assert.equal(history[0]?.newestOfficialPhase, taskRecord.sync.newestPhase);
  assert.equal(history[0]?.targetPhase, `next_after_${taskRecord.sync.newestPhase}`);
  assert.equal(history[0]?.repeatCount, 5);
  assert.deepEqual(history[0]?.selectedPositions, ["hundreds"]);
  assert.equal(history[0]?.evidenceCompleteness.status, "complete");
  const detail = getPick3HumanReviewTask(tempDataDir, taskRecord.taskId);
  assert.equal(detail?.repeats.length, 5);
  assert.equal(new Set(detail?.repeats.map((repeat) => repeat.imageId)).size, 1);
  assert.equal(detail?.repeats.every((repeat) => repeat.sameImageForPosition), true);
  assert.equal(detail?.repeats.every((repeat) => (repeat.aiAnswer?.rawResponseText ?? "").includes("decisionLogic")), true);
  assert.equal("finalRecommendation" in (detail ?? {}), false);
  assert.deepEqual(detail?.observedDistribution, { hundreds: { upper: 3, lower: 2 } });

  const multiPositionImages = await createPick3NextPredictionImages({
    artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability-multi"),
    batchId: "free-analysis-next-stability-multi",
    drawsAscending,
    positions: ["hundreds", "tens"],
  });
  assert.equal(multiPositionImages.length, 2);
  const multiStabilityInputs: AiFeedInput[] = [];
  const multiStabilitySummary = await runPick3NextPredictionStability({
    batch: {
      batchId: "free-analysis-next-stability-multi",
      artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability-multi"),
      imageCount: multiPositionImages.length,
      sealedAnswersHash: "free-analysis-next-stability-multi-no-answer",
      images: multiPositionImages,
      playbooks,
      promptPackages: [],
    },
    batchInput: {
      mode: "next_prediction_stability",
      providerKind: "gemini-web-chat",
      source: "theuaelottery",
      promptMode: "playbook_v1",
      lotteryType: 72,
      windowSize: 80,
      batchSize: 2,
      positions: ["hundreds", "tens"],
      dryRun: false,
    },
    storage: nextStorage,
    sender: async (input) => {
      multiStabilityInputs.push(input);
      const predictionLabel = input.roundId?.toString().startsWith("hundreds") ? "lower" : "upper";
      return buildFixtureAiResult({ gatewayInput: input, rawText: JSON.stringify(completePlaybookOutput({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel,
        confidence: 0.55,
      })) });
    },
  });
  assert.equal(multiStabilitySummary.results.length, 4);
  assert.equal(multiStabilityInputs.length, 4);
  assert.equal(multiStabilityInputs.every((input) => input.promptContractId === "pick3-is-blind-eval-one-image-v1"), true);
  assert.equal(multiStabilityInputs.every((input) => input.textPrompt.includes("tailShapes") && input.textPrompt.includes("zoneWeight")), true);
  assert.equal(multiStabilityInputs.some((input) => input.textPrompt.includes("Strict reasoning requirements")), false);
  const multiTaskRecord: Pick3TaskRecord = {
    taskId: "free-analysis-next-stability-multi-task",
    mode: "next_prediction_stability",
    promptMode: "playbook_v1",
    status: "success",
    reachedStep: "next_prediction_stability_complete",
    reason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sync: {
      runId: "free-analysis-next-stability-multi-sync",
      status: "success",
      officialStartTime: "fixture-start",
      officialEndTime: "fixture-end",
      rowsSeen: drawsAscending.length,
      rowsInserted: drawsAscending.length,
      rowsUpdated: 0,
      newestPhase: drawsAscending[drawsAscending.length - 1]?.phase ?? null,
      oldestPhase: drawsAscending[0]?.phase ?? null,
      reason: null,
      officialApiResponseHash: "fixture-official-hash",
    },
    batch: {
      batchId: "free-analysis-next-stability-multi",
      artifactDir: resolve(tempDataDir, "artifacts", "free-analysis-next-stability-multi"),
      imageCount: multiPositionImages.length,
      sealedAnswersHash: "free-analysis-next-stability-multi-no-answer",
      images: multiPositionImages,
    },
    scoring: null,
    stability: multiStabilitySummary,
  };
  nextStorage.writeTask(multiTaskRecord);
  const multiDetail = getPick3HumanReviewTask(tempDataDir, multiTaskRecord.taskId);
  assert.deepEqual(multiDetail?.observedDistribution, { hundreds: { lower: 2 }, tens: { upper: 2 } });
  assert.equal(Object.keys(multiDetail?.observedDistribution ?? {}).length, 2, "observedDistribution must keep hundreds and tens as separate buckets, never summed together");
} finally {
  nextStorage.close();
}
console.log("pick3-is-blind-eval free-analysis acceptance passed");
