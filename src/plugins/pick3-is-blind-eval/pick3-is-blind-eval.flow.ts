import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { createPick3BlindImages, createPick3NextPredictionImages } from "./pick3-is-blind-eval.image.js";
import type { BuiltPick3Batch } from "./pick3-is-blind-eval.flow-types.js";
import {
  PICK3_JOB_ID,
  PICK3_WINDOW_SIZE,
  Pick3InputSchema,
  type Pick3Draw,
  type Pick3ImageRecord,
  type Pick3Input,
  type Pick3Position,
  type Pick3ScoringSummary,
  type Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";
import { runPick3PromptExchange, type Pick3GatewaySender } from "./pick3-is-blind-eval.ai.js";
import { reviewPick3Failures } from "./pick3-is-blind-eval.failure-review.js";
import {
  completePick3Stage,
  createPick3FlowLogger,
  reviewRequiredPick3Stage,
  runPick3LoggedStage,
  startPick3Stage,
  type Pick3FlowLog,
} from "./pick3-is-blind-eval.logging.js";
import {
  buildPick3PlaybookPromptPackage,
  loadBuiltInPick3Playbooks,
  type Pick3PlaybookPromptPackage,
  type Pick3PlaybookVersion,
} from "./pick3-is-blind-eval.playbook.js";
import { reviewPick3PlaybookLessons } from "./pick3-is-blind-eval.playbook-lessons.js";
import { revealPick3Predictions, scorePick3Predictions } from "./pick3-is-blind-eval.scoring.js";
import { runPick3NextPredictionStability, type Pick3StabilitySummary } from "./pick3-is-blind-eval.stability.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";
import { syncOfficialDraws } from "./pick3-is-blind-eval.sync.js";

export { verifyPick3FullHistoryCoverage } from "./pick3-is-blind-eval.sync.js";

export type RunPick3Context = {
  dataDir: string;
  browser?: BrowserController | undefined;
  pick3GatewaySender?: Pick3GatewaySender | undefined;
  runtimeLogger?: RuntimeLogger | undefined;
};

const hashJson = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");


const emptyScoring = (): Pick3ScoringSummary => ({
  total: 0,
  hits: 0,
  misses: 0,
  abstains: 0,
  coverageRate: 0,
  byPosition: {
    hundreds: { total: 0, hits: 0, misses: 0, abstains: 0 },
    tens: { total: 0, hits: 0, misses: 0, abstains: 0 },
    ones: { total: 0, hits: 0, misses: 0, abstains: 0 },
  },
  randomBaseline: {
    onePositionFrontBack: 0.5,
    threePositionCombination: 0.125,
    threePositionWatchThreshold: 0.25,
    approximatePerPositionStabilityThreshold: 0.63,
  },
  calibration: [
    {
      bucket: "dry-run-no-ai",
      total: 0,
      hits: 0,
      realizedHitRate: null,
      confidenceIsProbability: false,
    },
  ],
});

const selectBatchTargets = (
  input: Pick3Input,
  storage: ReturnType<typeof openPick3Storage>,
): { drawsAscending: Pick3Draw[]; targetDraws: Pick3Draw[] } => {
  const drawsAscending = storage.listDrawsAscending();
  const targetDraws = storage.listTargetDraws({
    ...(input.explicitTargetPhases ? { phases: input.explicitTargetPhases } : {}),
    ...(!input.explicitTargetPhases && input.lastTargetPhase ? { lastPhase: input.lastTargetPhase } : {}),
    batchSize: input.batchSize,
  });
  if (targetDraws.length === 0) {
    throw new Error("pick3_not_enough_history_for_l80_batch");
  }
  return { drawsAscending, targetDraws };
};

const resolveArtifactDir = (input: Pick3Input, context: RunPick3Context, batchId: string): string =>
  input.artifactRoot
    ? path.join(input.artifactRoot, batchId)
    : path.join(context.dataDir, "runtime-data", PICK3_JOB_ID, "artifacts", batchId);

const buildPromptPackages = (
  images: readonly Pick3ImageRecord[],
  playbooks: readonly Pick3PlaybookVersion[],
  promptMode: Pick3Input["promptMode"],
  storage: ReturnType<typeof openPick3Storage>,
): Pick3PlaybookPromptPackage[] => {
  const playbookByPosition = new Map(playbooks.map((playbook) => [playbook.position, playbook]));
  const experienceLessonsByPosition = new Map<Pick3Position, Pick3PlaybookLessonRecord[]>(
    (["hundreds", "tens", "ones"] as const).map((position) => [position, storage.listPlaybookLessonsByPosition(position)]),
  );
  return images.map((image) => {
    const playbook = playbookByPosition.get(image.position);
    if (!playbook) {
      throw new Error(`pick3_playbook_missing_${image.position}`);
    }
    return buildPick3PlaybookPromptPackage(playbook, image, promptMode, experienceLessonsByPosition.get(image.position) ?? []);
  });
};

const writeBatchArtifacts = (input: {
  artifactDir: string;
  images: readonly Pick3ImageRecord[];
  playbooks: readonly Pick3PlaybookVersion[];
  promptPackages: unknown;
  sealedAnswers: unknown;
}): void => {
  const playbookManifest = input.playbooks.map((playbook) => ({
    playbookVersionId: playbook.playbookVersionId,
    position: playbook.position,
    version: playbook.version,
    status: playbook.status,
    sourceKind: playbook.sourceKind,
    contentHash: playbook.contentHash,
    systemPromptHash: playbook.systemPromptHash,
    visualGrammarHash: playbook.visualGrammarHash,
  }));
  writeFileSync(path.join(input.artifactDir, "sealed_answers.json"), `${JSON.stringify(input.sealedAnswers, null, 2)}\n`);
  writeFileSync(path.join(input.artifactDir, "playbook_manifest.json"), `${JSON.stringify(playbookManifest, null, 2)}\n`);
  writeFileSync(path.join(input.artifactDir, "ai_prompt_manifest.json"), `${JSON.stringify(input.promptPackages, null, 2)}\n`);
  writeFileSync(path.join(input.artifactDir, "ai_image_manifest.json"), `${JSON.stringify(input.images.map((image) => ({
    imageId: image.imageId,
    position: image.position,
    imagePath: image.imagePath,
    imageSha256: image.imageSha256,
  })), null, 2)}\n`);
};

const buildBatch = async (
  input: Pick3Input,
  context: RunPick3Context,
  storage: ReturnType<typeof openPick3Storage>,
): Promise<BuiltPick3Batch> => {
  const drawsAscending = storage.listDrawsAscending();
  const targetDraws = input.mode === "next_prediction_stability" ? [] : selectBatchTargets(input, storage).targetDraws;
  const batchId = `pick3_batch_${randomUUID()}`;
  const artifactDir = resolveArtifactDir(input, context, batchId);
  mkdirSync(artifactDir, { recursive: true });
  const images = input.mode === "next_prediction_stability"
    ? await createPick3NextPredictionImages({
        artifactDir,
        batchId,
        drawsAscending,
        positions: input.positions,
      })
    : await createPick3BlindImages({
        artifactDir,
        batchId,
        drawsAscending,
        positions: input.positions,
        targetDraws,
      });
  const playbooks = loadBuiltInPick3Playbooks(input.promptMode);
  storage.upsertPlaybooks(playbooks);
  const promptPackages = buildPromptPackages(images, playbooks, input.promptMode, storage);
  const sealedAnswers = images.map((image) => ({
    imageId: image.imageId,
    position: image.position,
    targetPhase: image.targetPhase,
    answerDigit: image.answerDigit,
    answerLabel: image.answerLabel,
  }));
  const sealedAnswersHash = hashJson(sealedAnswers);
  writeBatchArtifacts({ artifactDir, images, playbooks, promptPackages, sealedAnswers });
  storage.insertBatch({
    batchId,
    artifactDir,
    targetPhase: input.mode === "next_prediction_stability" ? null : targetDraws[0]?.phase ?? null,
    sealedAnswersHash,
  });
  if (input.mode !== "next_prediction_stability") {
    storage.insertImages(images);
  }
  return {
    batchId,
    artifactDir,
    imageCount: images.length,
    sealedAnswersHash,
    images,
    playbooks,
    promptPackages,
  };
};

const writePipelineArtifacts = (input: {
  batch: BuiltPick3Batch;
  gatewayInputs: unknown;
  interactions: unknown;
  predictions: unknown;
  reveals: unknown;
  failureReviews: unknown;
  playbookLessons: unknown;
}): void => {
  writeFileSync(path.join(input.batch.artifactDir, "ai_gateway_inputs.json"), `${JSON.stringify(input.gatewayInputs, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_interactions.json"), `${JSON.stringify(input.interactions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_predictions.json"), `${JSON.stringify(input.predictions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "public_results.json"), `${JSON.stringify(input.reveals, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "failure_reviews.json"), `${JSON.stringify(input.failureReviews, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "playbook_lessons.json"), `${JSON.stringify(input.playbookLessons, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "experience_assembly_note.json"), `${JSON.stringify({
    note: "There is no saved candidate/promoted Playbook file. The historical-experience section sent to the AI for this batch was assembled live from pick3_playbook_lessons at prompt-build time and is recorded verbatim in ai_prompt_manifest.json businessPrompt for each image.",
  }, null, 2)}\n`);
};

const writePromptExchangeFailureArtifacts = (input: {
  batch: BuiltPick3Batch;
  gatewayInputs: unknown;
  interactions: unknown;
  predictions: unknown;
}): void => {
  writeFileSync(path.join(input.batch.artifactDir, "ai_gateway_inputs.json"), `${JSON.stringify(input.gatewayInputs, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_interactions.json"), `${JSON.stringify(input.interactions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_predictions.json"), `${JSON.stringify(input.predictions, null, 2)}\n`);
};

const revealScoreAndReviewPick3Batch = async (input: {
  batch: BuiltPick3Batch;
  batchInput: Pick3Input;
  exchange: Awaited<ReturnType<typeof runPick3PromptExchange>>;
  sender: Pick3GatewaySender;
  storage: ReturnType<typeof openPick3Storage>;
  taskId: string;
}): Promise<{
  failureReviews: ReturnType<typeof reviewPick3Failures>;
  playbookLessons: Awaited<ReturnType<typeof reviewPick3PlaybookLessons>>;
  reveals: ReturnType<typeof revealPick3Predictions>;
  scoring: Pick3ScoringSummary;
}> => {
  const reveals = revealPick3Predictions({ images: input.batch.images, predictions: input.exchange.predictions });
  input.storage.insertReveals(reveals);
  const failureReviews = reviewPick3Failures({ images: input.batch.images, predictions: input.exchange.predictions, reveals });
  input.storage.insertFailureReviews(failureReviews);
  const playbookLessons = input.batchInput.promptMode === "playbook_v1"
    ? await reviewPick3PlaybookLessons({
        failureReviews,
        images: input.batch.images,
        interactions: input.exchange.interactions,
        predictions: input.exchange.predictions,
        reveals,
        sender: input.sender,
        source: "auto_review",
        taskId: input.taskId,
      })
    : [];
  input.storage.insertPlaybookLessons(playbookLessons);
  const scoring = scorePick3Predictions({ predictions: input.exchange.predictions, reveals });
  return { failureReviews, playbookLessons, reveals, scoring };
};

const runFullPipeline = async (input: {
  batch: BuiltPick3Batch;
  batchInput: Pick3Input;
  context: RunPick3Context;
  flowLog: Pick3FlowLog | null;
  storage: ReturnType<typeof openPick3Storage>;
  taskId: string;
}): Promise<Pick3ScoringSummary> => {
  const sender = input.context.pick3GatewaySender;
  if (!sender) {
    throw new Error("pick3_prompt_exchange_sender_missing");
  }
  const exchange = await runPick3LoggedStage({
    flowLog: input.flowLog, stageName: "PICK3_PROMPT_EXCHANGE",
    refs: { batchId: input.batch.batchId, artifactDir: input.batch.artifactDir },
    metrics: { imageCount: input.batch.images.length, promptPackageCount: input.batch.promptPackages.length },
    run: () => runPick3PromptExchange({
      artifactDir: input.batch.artifactDir,
      images: input.batch.images,
      promptPackages: input.batch.promptPackages,
      providerKind: input.batchInput.providerKind,
      sender,
    }),
    complete: (value) => ({ refs: { batchId: input.batch.batchId }, metrics: { interactionCount: value.interactions.length, predictionCount: value.predictions.length, imageCount: input.batch.images.length, deferredRetryCount: value.completion.deferredRetryCount, unresolvedCount: value.completion.unresolvedCount } }),
  });
  input.storage.insertAiInteractions(exchange.interactions);
  input.storage.insertPredictions(exchange.predictions);
  const unresolvedFailures = exchange.interactions.filter((interaction) => interaction.parseStatus !== "parsed");
  if (exchange.completion.unresolvedCount > 0) {
    writePromptExchangeFailureArtifacts({
      batch: input.batch,
      gatewayInputs: exchange.gatewayInputs,
      interactions: exchange.interactions,
      predictions: exchange.predictions,
    });
    const firstFailure = unresolvedFailures[0];
    throw new Error(`pick3_prompt_exchange_parse_failed_${exchange.completion.unresolvedCount}_of_${input.batch.images.length}_${firstFailure?.parseFailureReason ?? "prediction_count_mismatch"}`);
  }
  const scoringStage = startPick3Stage({ flowLog: input.flowLog, stageName: "PICK3_REVEAL_AND_SCORING", refs: { batchId: input.batch.batchId }, metrics: { predictionCount: exchange.predictions.length } });
  const reviewed = await revealScoreAndReviewPick3Batch({ ...input, exchange, sender });
  writePipelineArtifacts({
    batch: input.batch,
    gatewayInputs: exchange.gatewayInputs,
    interactions: exchange.interactions,
    predictions: exchange.predictions,
    reveals: reviewed.reveals,
    failureReviews: reviewed.failureReviews,
    playbookLessons: reviewed.playbookLessons,
  });
  completePick3Stage({ stage: scoringStage, refs: { batchId: input.batch.batchId }, metrics: { revealCount: reviewed.reveals.length, failureReviewCount: reviewed.failureReviews.length, playbookLessonCount: reviewed.playbookLessons.length, hitCount: reviewed.scoring.hits, abstainCount: reviewed.scoring.abstains, coverageRate: reviewed.scoring.coverageRate } });
  return reviewed.scoring;
};

const syncOfficialDrawsWithLog = async (input: {
  context: RunPick3Context;
  flowLog: Pick3FlowLog | null;
  taskId: string;
  taskStage: ReturnType<typeof startPick3Stage>;
}) => {
  try {
    return await runPick3LoggedStage({
      flowLog: input.flowLog, stageName: "PICK3_OFFICIAL_SYNC", refs: { taskId: input.taskId }, run: () => syncOfficialDraws(input.context.dataDir),
      complete: (value) => ({
        refs: { taskId: input.taskId, newestPhase: value.summary.newestPhase ?? "none", oldestPhase: value.summary.oldestPhase ?? "none" },
        metrics: { rowsSeen: value.summary.rowsSeen, rowsInserted: value.summary.rowsInserted, rowsUpdated: value.summary.rowsUpdated },
      }),
    });
  } catch (error) {
    reviewRequiredPick3Stage({ stage: input.taskStage, reason: error instanceof Error ? error.message : String(error), refs: { taskId: input.taskId } });
    throw error;
  }
};

const buildBatchWithLog = async (input: {
  batchInput: Pick3Input;
  context: RunPick3Context;
  flowLog: Pick3FlowLog | null;
  storage: ReturnType<typeof openPick3Storage>;
  taskId: string;
}): Promise<BuiltPick3Batch | null> => input.batchInput.mode === "sync_only" ? null : runPick3LoggedStage({
  flowLog: input.flowLog, stageName: "PICK3_BUILD_BLIND_BATCH", refs: { taskId: input.taskId },
  metrics: { batchSize: input.batchInput.batchSize, positionCount: input.batchInput.positions.length },
  run: () => buildBatch(input.batchInput, input.context, input.storage),
  complete: (value) => ({ refs: { taskId: input.taskId, batchId: value.batchId, artifactDir: value.artifactDir }, metrics: { imageCount: value.imageCount, promptPackageCount: value.promptPackages.length } }),
});

const buildPick3SuccessTaskRecord = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  promptMode: Pick3Input["promptMode"];
  scoring: Pick3ScoringSummary | null;
  stability: Pick3StabilitySummary | null;
  summary: Awaited<ReturnType<typeof syncOfficialDraws>>["summary"];
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  promptMode: input.promptMode,
  status: input.summary.status,
  reachedStep: input.mode === "next_prediction_stability" && input.batch ? "stability_completed" : input.mode === "full_pipeline" && input.batch ? "scoring_completed" : input.batch ? "images_generated" : "official_sync_completed",
  reason: null,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: input.scoring,
  stability: input.stability,
});

const buildPick3ReviewRequiredTaskRecord = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  promptMode: Pick3Input["promptMode"];
  reason: string;
  summary: Awaited<ReturnType<typeof syncOfficialDraws>>["summary"];
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  promptMode: input.promptMode,
  status: "review_required",
  reachedStep: input.reason.startsWith("pick3_prompt_exchange_parse_failed")
    || input.reason.startsWith("pick3_next_stability_exchange_incomplete")
    ? "ai_prompt_exchange_failed"
    : input.batch ? "full_pipeline_failed" : "batch_generation",
  reason: input.reason,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: null,
  stability: null,
});

export const runPick3IsBlindEvalFlow = async (
  rawInput: unknown,
  context: RunPick3Context,
): Promise<Pick3TaskRecord> => {
  const input = Pick3InputSchema.parse(rawInput);
  const taskId = `pick3_task_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const flowLog = createPick3FlowLogger({ runtimeLogger: context.runtimeLogger, taskId });
  const taskStage = startPick3Stage({ flowLog, stageName: "PICK3_TASK", refs: { taskId }, preview: { mode: input.mode }, metrics: { batchSize: input.batchSize, positionCount: input.positions.length } });
  const synced = await syncOfficialDrawsWithLog({ context, flowLog, taskId, taskStage });
  const { storage, summary } = synced;
  let batch: BuiltPick3Batch | null = null;
  try {
    const builtBatch = await buildBatchWithLog({ batchInput: input, context, flowLog, storage, taskId });
    batch = builtBatch;
    if (!builtBatch) {
      const record = buildPick3SuccessTaskRecord({ batch: null, createdAt, mode: input.mode, promptMode: input.promptMode, scoring: null, stability: null, summary, taskId });
      storage.writeTask(record);
      completePick3Stage({ stage: taskStage, refs: { taskId, reachedStep: record.reachedStep }, metrics: { imageCount: 0, hitCount: 0, abstainCount: 0 } });
      return record;
    }
    const stability = input.mode === "next_prediction_stability"
      ? await runPick3LoggedStage({
          flowLog, stageName: "PICK3_PROMPT_EXCHANGE",
          refs: { batchId: builtBatch.batchId, artifactDir: builtBatch.artifactDir },
          metrics: { imageCount: builtBatch.images.length, repeatCount: input.batchSize, promptPackageCount: builtBatch.promptPackages.length },
          run: () => {
            const sender = context.pick3GatewaySender;
            if (!sender) throw new Error("pick3_prompt_exchange_sender_missing");
            return runPick3NextPredictionStability({ batch: builtBatch, batchInput: input, sender, storage });
          },
          complete: (value) => ({ refs: { batchId: builtBatch.batchId }, metrics: { resultCount: value.results.length, repeatCount: value.repeatCount, deferredRetryCount: value.deferredRetryCount, unresolvedCount: value.unresolvedCount } }),
        })
      : null;
    const scoring = input.mode === "full_pipeline"
      ? await runFullPipeline({ batch: builtBatch, batchInput: input, context, flowLog, storage, taskId })
      : input.mode !== "next_prediction_stability" ? emptyScoring() : null;
    const record = buildPick3SuccessTaskRecord({ batch: builtBatch, createdAt, mode: input.mode, promptMode: input.promptMode, scoring, stability, summary, taskId });
    storage.writeTask(record);
    completePick3Stage({ stage: taskStage, refs: { taskId, reachedStep: record.reachedStep }, metrics: { imageCount: batch?.imageCount ?? 0, hitCount: scoring?.hits ?? 0, abstainCount: scoring?.abstains ?? 0 } });
    return record;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const record = buildPick3ReviewRequiredTaskRecord({ batch, createdAt, mode: input.mode, promptMode: input.promptMode, reason, summary, taskId });
    storage.writeTask(record);
    reviewRequiredPick3Stage({ stage: taskStage, reason, refs: { taskId, reachedStep: record.reachedStep } });
    return record;
  } finally {
    storage.close();
  }
};

export const getLatestPick3IsBlindEvalTask = (dataDir: string): Pick3TaskRecord | null => {
  const storage = openPick3Storage(dataDir);
  try {
    return storage.readLatestTask();
  } finally {
    storage.close();
  }
};
