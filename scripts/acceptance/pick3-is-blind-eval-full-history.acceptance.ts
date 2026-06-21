import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { runPick3PromptExchange } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.failure-review.js";
import { getPick3HumanReviewTask, listPick3HumanReviewHistory, reviewPick3PlaybookLessonManually } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.js";
import { createPick3BlindImages } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.image.js";
import { reviewPick3PlaybookLessons } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook-lessons.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.playbook.js";
import { revealPick3Predictions, scorePick3Predictions } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.scoring.js";
import type { Pick3TaskRecord } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "../../src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.js";
import { buildDraw, buildFixtureAiResult, toVisibleLabel, visiblePromptPackageId } from "./pick3-is-blind-eval.acceptance-support.js";

const buildPlaybookPredictionFixture = (input: {
  confidence: number;
  imageId: string | undefined;
  predictionLabel: "lower" | "upper";
  promptPackageId: string;
}): Record<string, unknown> => ({
  imageId: input.imageId,
  promptPackageId: input.promptPackageId,
  predictionLabel: input.predictionLabel,
  confidence: input.confidence,
  tailShapes: ["sharp_top"],
  zoneWeight: "lower_weighted",
  drivingEvidence: "sharp_top drove the lower conclusion",
  discountedEvidence: null,
  reason: "sharp_top evidence is present for the playbook lesson fixture.",
  abstainReason: null,
});

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
  assert.equal(detail?.playbookLessons.length, 0, "free_analysis_strict_reasoning failures must not enter Playbook lessons");
  assert.equal("finalRecommendation" in (detail ?? {}), false);

  const playbookBatchId = "full-history-playbook-lesson-batch";
  const playbookArtifactDir = resolve(dataDir, "artifacts", playbookBatchId);
  const playbookImages = await createPick3BlindImages({
    artifactDir: playbookArtifactDir,
    batchId: playbookBatchId,
    drawsAscending: draws,
    positions: ["hundreds", "tens", "ones"],
    targetDraws: [draws[98]!],
  });
  const playbooksV1 = loadBuiltInPick3Playbooks("playbook_v1");
  const playbookPromptPackages = playbookImages.map((image) => buildPick3PlaybookPromptPackage(playbooksV1.find((item) => item.position === image.position)!, image, "playbook_v1"));
  const playbookExchange = await runPick3PromptExchange({
    artifactDir: playbookArtifactDir,
    images: playbookImages,
    promptPackages: playbookPromptPackages,
    sender: async (input) => {
      if (input.promptContractId === "pick3-is-blind-eval-playbook-failure-review-v1") {
        return buildFixtureAiResult({
          gatewayInput: input,
          rawText: JSON.stringify({
            rootCause: "The tens shoulder signal was over-weighted against the latest tail bend.",
            candidateLesson: "For tens only, require tail follow-through before trusting a shoulder hold.",
          }),
        });
      }
      const image = playbookImages.find((item) => item.imageId === input.inputRefs[0]?.id)!;
      const forcedLabel = image.position === "tens" ? (image.answerLabel === "front" ? "back" : "front") : image.answerLabel!;
      return buildFixtureAiResult({
        gatewayInput: input,
        rawText: JSON.stringify(buildPlaybookPredictionFixture({
          imageId: input.inputRefs[0]?.id,
          promptPackageId: visiblePromptPackageId(input),
          predictionLabel: toVisibleLabel(forcedLabel),
          confidence: 0.61,
        })),
      });
    },
  });
  storage.insertAiInteractions(playbookExchange.interactions);
  storage.insertPredictions(playbookExchange.predictions);
  const playbookReveals = revealPick3Predictions({ images: playbookImages, predictions: playbookExchange.predictions });
  storage.insertReveals(playbookReveals);
  const playbookScoring = scorePick3Predictions({ predictions: playbookExchange.predictions, reveals: playbookReveals });
  const playbookFailureReviews = reviewPick3Failures({ images: playbookImages, predictions: playbookExchange.predictions, reveals: playbookReveals });
  storage.insertFailureReviews(playbookFailureReviews);
  const autoLessons = await reviewPick3PlaybookLessons({
    failureReviews: playbookFailureReviews,
    images: playbookImages,
    interactions: playbookExchange.interactions,
    predictions: playbookExchange.predictions,
    reveals: playbookReveals,
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        rootCause: "The tens shoulder signal was over-weighted against the latest tail bend.",
        candidateLesson: "For tens only, require tail follow-through before trusting a shoulder hold.",
      }),
    }),
    source: "auto_review",
    taskId: "full-history-playbook-lesson-task",
  });
  storage.insertPlaybookLessons(autoLessons);
  assert.equal(autoLessons.length, 1);
  assert.equal(autoLessons[0]?.position, "tens");
  assert.equal(autoLessons[0]?.aggregateKey.startsWith("tens:"), true);
  assert.equal(autoLessons[0]?.source, "auto_review");
  assert.match(autoLessons[0]?.candidateLesson ?? "", /tens only/);
  const leakedFailedImage = playbookImages.find((image) => image.imageId === playbookFailureReviews[0]?.imageId)!;
  const leakingLessons = await reviewPick3PlaybookLessons({
    failureReviews: playbookFailureReviews,
    images: playbookImages,
    interactions: playbookExchange.interactions,
    predictions: playbookExchange.predictions,
    reveals: playbookReveals,
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        rootCause: `This was wrong because phase ${leakedFailedImage.targetPhase} actually resolved front.`,
        candidateLesson: "Trust the shoulder hold pattern next time.",
      }),
    }),
    source: "auto_review",
    taskId: "full-history-playbook-lesson-leak-task",
  });
  assert.equal(leakingLessons.length, 1, "leak test fixture must still produce exactly one lesson");
  assert.equal(leakingLessons[0]?.status, "rejected", "a lesson that echoes the phase/answer must be force-rejected, never candidate");
  assert.match(leakingLessons[0]?.rootCause ?? "", /^\[REJECTED:/, "a rejected lesson's rootCause must record the leak reason for audit");
  let unparseableReviewAttempts = 0;
  const unparseableLessons = await reviewPick3PlaybookLessons({
    failureReviews: playbookFailureReviews,
    images: playbookImages,
    interactions: playbookExchange.interactions,
    predictions: playbookExchange.predictions,
    reveals: playbookReveals,
    sender: async (input) => {
      unparseableReviewAttempts += 1;
      return buildFixtureAiResult({ gatewayInput: input, rawText: "this is not json at all" });
    },
    source: "auto_review",
    taskId: "full-history-playbook-lesson-unparseable-task",
  });
  assert.equal(unparseableReviewAttempts, 3, "an unparseable post-mortem reply must be retried exactly 3 times total");
  assert.equal(unparseableLessons.length, 0, "after 3 failed retries the failure must be discarded entirely, not stored as a placeholder lesson");
  const playbookNow = new Date().toISOString();
  const playbookTask: Pick3TaskRecord = {
    taskId: "full-history-playbook-lesson-task",
    mode: "full_pipeline",
    promptMode: "playbook_v1",
    status: "success",
    reachedStep: "scoring_completed",
    reason: null,
    createdAt: playbookNow,
    updatedAt: playbookNow,
    sync: { runId: "full-history-playbook-sync", status: "success", officialStartTime: "fixture-start", officialEndTime: "fixture-end", rowsSeen: draws.length, rowsInserted: 0, rowsUpdated: 0, newestPhase: draws[99]!.phase, oldestPhase: draws[0]!.phase, reason: null, officialApiResponseHash: "fixture" },
    batch: { batchId: playbookBatchId, artifactDir: playbookArtifactDir, imageCount: playbookImages.length, sealedAnswersHash: "fixture-sealed-playbook", images: playbookImages },
    scoring: playbookScoring,
    stability: null,
  };
  storage.writeTask(playbookTask);
  const playbookDetail = getPick3HumanReviewTask(dataDir, playbookTask.taskId);
  assert.equal(playbookDetail?.playbookLessons.length, 1);
  assert.equal(playbookDetail?.phaseReports[0]?.positions.find((item) => item.position === "tens")?.lessonStatus, "candidate");
  const manualLesson = await reviewPick3PlaybookLessonManually(dataDir, {
    phase: playbookImages[0]!.targetPhase,
    position: "tens",
    sender: async (input) => buildFixtureAiResult({
      gatewayInput: input,
      rawText: JSON.stringify({
        rootCause: "Manual review confirmed the tens-specific shoulder over-weighting.",
        candidateLesson: "For tens only, discount shoulder hold when the tail has already bent away.",
      }),
    }),
    taskId: playbookTask.taskId,
  });
  assert.equal(manualLesson?.source, "manual_review");
  assert.equal(manualLesson?.position, "tens");
} finally {
  storage.close();
}
console.log("pick3-is-blind-eval full-history acceptance passed");
