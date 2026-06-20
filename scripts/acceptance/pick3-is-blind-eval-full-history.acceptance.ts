import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runPick3PromptExchange } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import { getPick3HumanReviewTask, listPick3HumanReviewHistory } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.js";
import { createPick3BlindImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import type { Pick3TaskRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import { buildDraw, buildFixtureAiResult, toVisibleLabel, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";

const dataDir = mkdtempSync(resolve(tmpdir(), "pick3-full-history-"));
const storage = openPick3Storage(dataDir);
try {
  const draws = Array.from({ length: 100 }, (_, index) => buildDraw(index + 1));
  storage.upsertDraws(draws);
  const batchId = "full-history-batch";
  const artifactDir = resolve(dataDir, "artifacts", batchId);
  const images = await createPick3BlindImages({
    artifactDir,
    batchId,
    drawsAscending: draws,
    positions: ["hundreds", "tens", "ones"],
    targetDraws: [draws[99]!],
  });
  const playbooks = loadBuiltInPick3Playbooks("free_analysis_strict_reasoning");
  const promptPackages = images.map((image) => buildPick3PlaybookPromptPackage(playbooks.find((item) => item.position === image.position)!, image, "free_analysis_strict_reasoning"));
  const exchange = await runPick3PromptExchange({
    artifactDir,
    images,
    promptPackages,
    sender: async (input) => {
      const image = images.find((item) => item.imageId === input.inputRefs[0]?.id)!;
      const forcedLabel = image.position === "tens" ? (image.answerLabel === "front" ? "back" : "front") : image.answerLabel!;
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify({
          imageId: image.imageId,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: toVisibleLabel(forcedLabel),
          confidence: 0.61,
          chartReading: "The L80 chart has enough visible structure to produce a fixture prediction for full-pipeline history reporting.",
          recentBehavior: "The latest visible segment is deliberately described with enough detail for parser acceptance.",
          supportingEvidence: ["fixture evidence for history reporting"],
          counterEvidence: ["fixture counter evidence"],
          decisionLogic: "This fixture intentionally makes one position wrong so the history report can prove phase-level miss and reason surfacing.",
          zoneCount: { lowerCount: 40, upperCount: 40 },
          patternRecurrence: "The fixture pattern recurs three times and two earlier recurrences match the chosen direction.",
          weakestLink: "The fixture weakest link is intentionally synthetic.",
          abstainReason: null,
        }),
      });
    },
  });
  storage.insertAiInteractions(exchange.interactions);
  storage.insertPredictions(exchange.predictions);
  const reveals = revealPick3Predictions({ images, predictions: exchange.predictions });
  storage.insertReveals(reveals);
  const scoring = scorePick3Predictions({ predictions: exchange.predictions, reveals });
  const failureReviews = reviewPick3Failures({ images, predictions: exchange.predictions, reveals });
  storage.insertFailureReviews(failureReviews);
  const now = new Date().toISOString();
  const task: Pick3TaskRecord = {
    taskId: "full-history-task",
    mode: "full_pipeline",
    promptMode: "free_analysis_strict_reasoning",
    status: "success",
    reachedStep: "scoring_completed",
    reason: null,
    createdAt: now,
    updatedAt: now,
    sync: { runId: "full-history-sync", status: "success", officialStartTime: "fixture-start", officialEndTime: "fixture-end", rowsSeen: draws.length, rowsInserted: draws.length, rowsUpdated: 0, newestPhase: draws[99]!.phase, oldestPhase: draws[0]!.phase, reason: null, officialApiResponseHash: "fixture" },
    batch: { batchId, artifactDir, imageCount: images.length, sealedAnswersHash: "fixture-sealed", images },
    scoring,
    stability: null,
  };
  storage.writeTask(task);
  const history = listPick3HumanReviewHistory(dataDir);
  assert.equal(history[0]?.taskId, task.taskId);
  assert.equal(history[0]?.taskMode, "full_pipeline");
  assert.equal(history[0]?.scoring?.total, 3);
  const detail = getPick3HumanReviewTask(dataDir, task.taskId);
  assert.equal(detail?.repeats.length, 3);
  assert.equal(detail?.phaseReports.length, 1);
  assert.equal(detail?.phaseReports[0]?.phase, images[0]?.targetPhase);
  assert.equal(detail?.phaseReports[0]?.status, "miss");
  assert.equal(detail?.phaseReports[0]?.positions.length, 3);
  assert.match(detail?.phaseReports[0]?.errorReason ?? "", /Prediction/);
  assert.equal("finalRecommendation" in (detail ?? {}), false);
} finally {
  storage.close();
}
console.log("pick3-is-blind-eval full-history acceptance passed");
