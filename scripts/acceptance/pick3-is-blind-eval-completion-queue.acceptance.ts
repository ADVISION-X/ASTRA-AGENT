import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { AiFeedInput } from "../../src/capabilities/ai-input-gateway/index.js";
import { runPick3PromptExchange } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import type { Pick3ImageRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { buildFixtureAiResult, buildRawTextFixtureAiResult, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";

const buildImage = (imageId: string, position: Pick3ImageRecord["position"]): Pick3ImageRecord => ({
  imageId,
  batchId: "completion-queue-batch",
  position,
  targetPhase: "260100",
  targetExpectedPrizeTime: "2026-06-20 21:30:00",
  visibleStartPhase: "260020",
  visibleEndPhase: "260099",
  imagePath: resolve(tmpdir(), `${imageId}.png`),
  imageSha256: `sha-${imageId}`,
  answerDigit: 1,
  answerLabel: "front",
});

const buildValidPredictionFixture = (input: {
  confidence: number;
  imageId: string | undefined;
  predictionLabel: string;
  promptPackageId: string;
  reason: string;
}): Record<string, unknown> => ({
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

const invalidLabelRaw = (input: AiFeedInput): string => JSON.stringify({
  imageId: input.inputRefs[0]?.id,
  promptPackageId: visiblePromptPackageId(input),
  predictionLabel: "not-a-label",
  confidence: 0.56,
  reason: "invalid fixture before completion round",
  abstainReason: null,
});

const images = [buildImage("completion-image-1", "hundreds"), buildImage("completion-image-2", "tens")];
const playbooks = loadBuiltInPick3Playbooks();
const promptPackages = images.map((image) => {
  const playbook = playbooks.find((item) => item.position === image.position);
  assert.ok(playbook);
  return buildPick3PlaybookPromptPackage(playbook, image);
});
const artifactDir = mkdtempSync(resolve(tmpdir(), "pick3-completion-queue-"));

let convergenceCalls = 0;
const convergenceExchange = await runPick3PromptExchange({
  artifactDir,
  images,
  promptPackages,
  sender: async (input) => {
    convergenceCalls += 1;
    const imageId = input.inputRefs[0]?.id;
    if (imageId === images[0]?.imageId && !String(input.roundId ?? "").includes("completion-1")) {
      return buildFixtureAiResult({ gatewayInput: input, rawText: invalidLabelRaw(input) });
    }
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify(buildValidPredictionFixture({
        imageId,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: "lower",
        confidence: 0.56,
        reason: "completion queue recovered the request without blocking the batch",
      })),
    });
  },
});

assert.equal(convergenceCalls, 4);
assert.equal(convergenceExchange.completion.expectedCount, 2);
assert.equal(convergenceExchange.completion.completedCount, 2);
assert.equal(convergenceExchange.completion.deferredRetryCount, 1);
assert.equal(convergenceExchange.completion.unresolvedCount, 0);
assert.equal(convergenceExchange.interactions.length, 2);
assert.equal(convergenceExchange.predictions.length, 2);

const exhaustedExchange = await runPick3PromptExchange({
  artifactDir,
  images: [images[0]!],
  maxCompletionRounds: 1,
  promptPackages: [promptPackages[0]!],
  sender: async (input) => buildFixtureAiResult({ gatewayInput: input, rawText: invalidLabelRaw(input) }),
});

assert.equal(exhaustedExchange.completion.expectedCount, 1);
assert.equal(exhaustedExchange.completion.completedCount, 0);
assert.equal(exhaustedExchange.completion.unresolvedCount, 1);
assert.equal(exhaustedExchange.interactions.length, 1);
assert.equal(exhaustedExchange.interactions[0]?.parseStatus, "parse_failed_raw_available");
assert.equal(exhaustedExchange.predictions.length, 0);

let missingImageSkipCalls = 0;
const missingImageSkipExchange = await runPick3PromptExchange({
  artifactDir,
  images,
  promptPackages,
  sender: async (input) => {
    if (input.inputRefs[0]?.id === images[0]?.imageId) {
      missingImageSkipCalls += 1;
      return buildRawTextFixtureAiResult({ gatewayInput: input, rawText: "未收到图片" });
    }
    return buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify(buildValidPredictionFixture({
        imageId: input.inputRefs[0]?.id,
        promptPackageId: visiblePromptPackageId(input),
        predictionLabel: "upper",
        confidence: 0.55,
        reason: "batch continued after provider-reported missing image skip",
      })),
    });
  },
});

assert.equal(missingImageSkipCalls, 4);
assert.equal(missingImageSkipExchange.completion.completedCount, 2);
assert.equal(missingImageSkipExchange.completion.skippedCount, 1);
assert.equal(missingImageSkipExchange.completion.unresolvedCount, 0);
assert.equal(missingImageSkipExchange.interactions[0]?.parseStatus, "skipped_provider_reported_image_missing");
assert.equal(missingImageSkipExchange.interactions[0]?.parseFailureReason, "pick3_provider_reported_image_missing_retry_exhausted");
assert.equal(missingImageSkipExchange.predictions.length, 1);
console.log("pick3-is-blind-eval completion queue acceptance passed");
