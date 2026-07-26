import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";
import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { createPick3BlindImages, renderPick3BlindChartSvg } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { verifyPick3FullHistoryCoverage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.js";
import { buildPick3AiGatewayInput, runPick3PromptExchange, type Pick3GatewaySender } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import { listPick3TrendSnapshot } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.trend.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import { buildDatedDraw, buildDraw, buildEmptyFixtureAiResult, buildFixtureAiResult, buildRawTextFixtureAiResult, oppositeLabel, toVisibleLabel, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";
import { pick3StaticContractAcceptanceCompleted } from "./pick3-is-blind-eval.contracts.acceptance.js";
type ValidFixtureInput = {
  imageId: string | undefined;
  promptPackageId: string;
  predictionLabel: string;
  confidence: number;
  reason: string;
};
const buildValidPredictionFixture = (input: ValidFixtureInput): Record<string, unknown> => ({
  imageId: input.imageId,
  promptPackageId: input.promptPackageId,
  predictionLabel: input.predictionLabel,
  confidence: input.confidence,
  tailShapes: ["sharp_top"],
  zoneWeight: "lower_weighted",
  drivingEvidence: "sharp_top drove the lower conclusion",
  discountedEvidence: null,
  reason: input.reason,
  abstainReason: null,
});
assert.equal(pick3StaticContractAcceptanceCompleted, true);
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
assert.deepEqual(
  {
    drawNo: officialRow.phase,
    hundreds: Number(nums[0]),
    tens: Number(nums[1]),
    ones: Number(nums[2]),
  },
  { drawNo: "260616", hundreds: 4, tens: 2, ones: 7 },
);

assert.equal(0.5, 1 / 2);
assert.equal(0.125, 1 / 8);
assert.ok(Math.pow(0.63, 3) < 0.251);
assert.ok(Math.pow(0.64, 3) > 0.25);

const fullCoverageDraws = [buildDatedDraw("2025-06-04", 1), buildDatedDraw("2025-06-05", 2), buildDatedDraw("2025-06-06", 3)];
verifyPick3FullHistoryCoverage({
  bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
  drawsAscending: fullCoverageDraws,
});
assert.throws(
  () =>
    verifyPick3FullHistoryCoverage({
      bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
      drawsAscending: fullCoverageDraws.slice(1),
    }),
  /pick3_full_history_missing_earliest/,
);
assert.throws(
  () =>
    verifyPick3FullHistoryCoverage({
      bounds: { startTime: "2025-06-04", endTime: "2025-06-06" },
      drawsAscending: fullCoverageDraws.slice(0, 2),
    }),
  /pick3_full_history_missing_latest/,
);
assert.throws(
  () =>
    verifyPick3FullHistoryCoverage({
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
  const trendSnapshot = listPick3TrendSnapshot(tempDataDir);
  assert.equal(trendSnapshot.source, "pick3_draws");
  assert.equal(trendSnapshot.windowSize, 80);
  assert.equal(trendSnapshot.drawCount, 100);
  assert.equal(trendSnapshot.latestWindowStartIndex, 20);
  assert.equal(trendSnapshot.latestPhase, draws[99]?.phase);
  assert.equal(trendSnapshot.draws[0]?.positions.hundreds, draws[0]?.hundreds);
  assert.equal(trendSnapshot.draws[0]?.numbers, draws[0]?.resultText);

  const targets = storage.listTargetDraws({ batchSize: 2 });
  assert.equal(targets.length, 2);
  assert.deepEqual(
    targets.map((draw) => draw.phase),
    [draws[98]!.phase, draws[99]!.phase],
  );
  const historicalTargets = storage.listTargetDraws({
    batchSize: 3,
    lastPhase: draws[90]!.phase,
  });
  assert.deepEqual(
    historicalTargets.map((draw) => draw.phase),
    [draws[88]!.phase, draws[89]!.phase, draws[90]!.phase],
  );
  assert.equal(storage.listTargetDraws({ batchSize: 3, lastPhase: draws[20]!.phase }).length, 0);
  assert.equal(storage.listTargetDraws({ batchSize: 3, lastPhase: "missing-phase" }).length, 0);
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
    const imageSource = readFileSync(image.imagePath);
    const { width: imgWidth, height: imgHeight } = await sharp(imageSource).metadata();
    assert.equal(imgWidth, 12340, `blind chart image must be 5x wide; got ${imgWidth}`);
    assert.equal(imgHeight, 1500, `blind chart image must be 5x tall; got ${imgHeight}`);
    const playbook = playbooks.find((item) => item.position === image.position);
    assert.ok(playbook);
    const sampleSvg = renderPick3BlindChartSvg([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(sampleSvg.includes('stroke="#dc2626"'), true, "midline must render as red (#dc2626), not the old gray, for AI visual contrast against the blue data line");
    assert.equal(sampleSvg.includes('stroke-dasharray="40 30"'), true, "midline must render dashed (40 30 dash pattern) so the AI can distinguish it from the solid blue data line");
    assert.equal(sampleSvg.includes('stroke="#d1d5db"'), false, "midline must not still use the old solid gray color");
    const promptPackage = buildPick3PlaybookPromptPackage(playbook, image);
    promptPackages.push(promptPackage);
    assert.equal(promptPackage.confidenceIsProbability, false);
    assert.deepEqual(promptPackage.allowedLabels, ["lower", "upper", "abstain"]);
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
    providerKind: "gemini-web-chat",
  });
  assert.equal(sampleGatewayInput.providerKind, "gemini-web-chat");
  assert.equal(sampleGatewayInput.inputRefs.length, 1);
  assert.equal(sampleGatewayInput.textPrompt.includes("predictionLabel"), true);
  assert.equal(sampleGatewayInput.textPrompt.includes("lower | upper | abstain"), true);
  assert.equal(sampleGatewayInput.textPrompt.includes("front | back | abstain"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("AGENT-owned"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("Pick3"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("UAE"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("lottery"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("pick3_"), false);
  assert.equal(sampleGatewayInput.textPrompt.includes("blind_series_package_"), true);
  const observedInputs: AiFeedInput[] = [];
  const sender: Pick3GatewaySender = async (input) => {
    observedInputs.push(input);
    const image = imageById.get(input.inputRefs[0]?.id ?? "");
    assert.ok(image);
    assert.ok(image.answerLabel);
    const predictionLabel = observedInputs.length === 1 ? oppositeLabel(image.answerLabel) : image.answerLabel;
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify(
        buildValidPredictionFixture({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: toVisibleLabel(predictionLabel),
          confidence: 0.56,
          reason: "sharp_top tail shape is clear enough for this fixture",
        }),
      ),
    });
  };
  const exchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images,
    promptPackages,
    sender,
  });
  assert.equal(observedInputs.length, images.length);
  assert.equal(exchange.interactions.length, images.length);
  assert.equal(exchange.predictions.length, images.length);
  assert.equal(
    exchange.interactions.every((interaction) => interaction.parseStatus === "parsed"),
    true,
  );
  assert.equal(
    exchange.predictions.every((prediction) => prediction.sealedBeforeReveal),
    true,
  );
  storage.insertAiInteractions(exchange.interactions);
  storage.insertPredictions(exchange.predictions);
  assert.equal(storage.listAiInteractions("acceptance-batch").length, images.length);
  assert.equal(storage.listPredictions("acceptance-batch").length, images.length);

  const reveals = revealPick3Predictions({
    images,
    predictions: exchange.predictions,
  });
  storage.insertReveals(reveals);
  assert.equal(storage.listReveals("acceptance-batch").length, images.length);
  const scoring = scorePick3Predictions({
    predictions: exchange.predictions,
    reveals,
  });
  assert.equal(scoring.total, images.length);
  assert.equal(scoring.misses, 1);
  assert.equal(scoring.hits, images.length - 1);
  assert.equal(scoring.randomBaseline.onePositionFrontBack, 0.5);
  assert.equal(scoring.randomBaseline.threePositionCombination, 0.125);
  assert.equal(
    scoring.calibration.every((row) => row.confidenceIsProbability === false),
    true,
  );

  const failureReviews = reviewPick3Failures({
    images,
    predictions: exchange.predictions,
    reveals,
  });
  storage.insertFailureReviews(failureReviews);
  assert.deepEqual(
    failureReviews.map((review) => review.failureType),
    ["high_exhaustion_missed"],
  );
  assert.equal(storage.listFailureReviews("acceptance-batch").length, 1);

  const badExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
    sender: async (input) =>
      buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
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
  let nonDirectionalLabelCalls = 0;
  const nonDirectionalLabelExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
    sender: async (input) => {
      nonDirectionalLabelCalls += 1;
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(
          buildValidPredictionFixture({
            imageId: input.inputRefs[0]?.id,
            promptPackageId: visiblePromptPackageId(input),
            predictionLabel: "hold",
            confidence: 0.55,
            reason: "non-directional invalid label fixture",
          }),
        ),
      });
    },
  });
  assert.equal(nonDirectionalLabelCalls, 1);
  assert.equal(nonDirectionalLabelExchange.interactions.length, 1);
  assert.equal(nonDirectionalLabelExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(nonDirectionalLabelExchange.predictions.length, 1);
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.predictionLabel, "abstain");
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.confidence, null);
  assert.equal(nonDirectionalLabelExchange.predictions[0]?.abstainReason, "non_directional_prediction_label_hold");

  const directionalAliasExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
    sender: async (input) =>
      buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(
          buildValidPredictionFixture({
            imageId: input.inputRefs[0]?.id,
            promptPackageId: visiblePromptPackageId(input),
            predictionLabel: "rise",
            confidence: 0.55,
            reason: "directional alias fixture",
          }),
        ),
      }),
  });
  assert.equal(directionalAliasExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(directionalAliasExchange.predictions[0]?.predictionLabel, "back");

  let emptyRetryCalls = 0;
  const emptyRetryExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[1]!],
    promptPackages: [promptPackages[1]!],
    sender: async (input) => {
      emptyRetryCalls += 1;
      if (emptyRetryCalls === 1) {
        return buildEmptyFixtureAiResult({ gatewayInput: input });
      }
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(
          buildValidPredictionFixture({
            imageId: input.inputRefs[0]?.id,
            promptPackageId: visiblePromptPackageId(input),
            predictionLabel: "lower",
            confidence: 0.55,
            reason: "retry recovered from empty web-chat capture",
          }),
        ),
      });
    },
  });
  assert.equal(emptyRetryCalls, 2);
  assert.equal(emptyRetryExchange.interactions.length, 1);
  assert.equal(emptyRetryExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(emptyRetryExchange.predictions.length, 1);
  let missingImageRetryCalls = 0;
  const missingImageRetryExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[1]!],
    promptPackages: [promptPackages[1]!],
    sender: async (input) => {
      missingImageRetryCalls += 1;
      if (missingImageRetryCalls <= 3)
        return buildRawTextFixtureAiResult({
          gatewayInput: input,
          rawText: "未收到图片",
        });
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(
          buildValidPredictionFixture({
            imageId: input.inputRefs[0]?.id,
            promptPackageId: visiblePromptPackageId(input),
            predictionLabel: "lower",
            confidence: 0.55,
            reason: "retry recovered from provider-reported missing image",
          }),
        ),
      });
    },
  });
  assert.equal(missingImageRetryCalls, 4);
  assert.equal(missingImageRetryExchange.interactions.length, 1);
  assert.equal(missingImageRetryExchange.interactions[0]?.parseStatus, "parsed");
  assert.equal(missingImageRetryExchange.predictions.length, 1);
  const mismatchedIdentityExchange = await runPick3PromptExchange({
    postParseDelayMsOverride: 0,
    artifactDir,
    images: [images[0]!],
    promptPackages: [promptPackages[0]!],
    sender: async (input) =>
      buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify({
          imageId: "wrong-image-id",
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: "lower",
          confidence: 0.56,
          reason: "identity mismatch fixture",
          abstainReason: null,
        }),
      }),
  });
  assert.equal(mismatchedIdentityExchange.interactions.length, 1);
  assert.equal(mismatchedIdentityExchange.interactions[0]?.parseFailureReason, "pick3_prediction_image_id_mismatch");
  assert.equal(mismatchedIdentityExchange.predictions.length, 0);
} finally {
  storage.close();
}
console.log("pick3-is-blind-eval acceptance passed");
