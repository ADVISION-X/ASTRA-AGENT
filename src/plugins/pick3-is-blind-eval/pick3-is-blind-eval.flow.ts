import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  buildPick3CursorHistoryPayload,
  buildPick3LatestHistoryPayload,
  fetchPick3HistoryPage,
  fetchPick3PrizeBounds,
} from "./pick3-is-blind-eval.official-api.js";
import { createPick3BlindImages } from "./pick3-is-blind-eval.image.js";
import {
  PICK3_JOB_ID,
  PICK3_WINDOW_SIZE,
  Pick3InputSchema,
  type Pick3BatchSummary,
  type Pick3Draw,
  type Pick3ImageRecord,
  type Pick3Input,
  type Pick3ScoringSummary,
  type Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
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
import { writeCandidatePick3Playbooks } from "./pick3-is-blind-eval.prompt-versioning.js";
import { revealPick3Predictions, scorePick3Predictions } from "./pick3-is-blind-eval.scoring.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";

export type RunPick3Context = {
  dataDir: string;
  browser?: BrowserController | undefined;
  pick3GatewaySender?: Pick3GatewaySender | undefined;
  runtimeLogger?: RuntimeLogger | undefined;
};

type BuiltPick3Batch = Pick3BatchSummary & {
  playbooks: Pick3PlaybookVersion[];
  promptPackages: Pick3PlaybookPromptPackage[];
};

const hashJson = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const dateKey = (draw: Pick3Draw): string => draw.expectedPrizeTime.slice(0, 10);

const dateDay = (date: string): number => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`pick3_invalid_official_date_${date}`);
  }
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const verifyPick3FullHistoryCoverage = (input: {
  bounds: { startTime: string; endTime: string };
  drawsAscending: readonly Pick3Draw[];
}): void => {
  const first = input.drawsAscending[0];
  const last = input.drawsAscending[input.drawsAscending.length - 1];
  if (!first || !last) {
    throw new Error("pick3_full_history_empty");
  }
  if (dateKey(first) > input.bounds.startTime) {
    throw new Error(`pick3_full_history_missing_earliest_${input.bounds.startTime}_got_${dateKey(first)}`);
  }
  if (dateKey(last) < input.bounds.endTime) {
    throw new Error(`pick3_full_history_missing_latest_${input.bounds.endTime}_got_${dateKey(last)}`);
  }
  const coveredDates = new Set(input.drawsAscending.map(dateKey));
  for (let day = dateDay(input.bounds.startTime); day <= dateDay(input.bounds.endTime); day += 1) {
    const expectedDate = new Date(day * 86_400_000).toISOString().slice(0, 10);
    if (!coveredDates.has(expectedDate)) {
      throw new Error(`pick3_full_history_date_gap_${expectedDate}`);
    }
  }
};

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

const syncOfficialDraws = async (dataDir: string) => {
  const storage = openPick3Storage(dataDir);
  try {
    const runId = `pick3_sync_${randomUUID()}`;
    const bounds = await fetchPick3PrizeBounds();
    let rowsSeen = 0;
    let rowsInserted = 0;
    let rowsUpdated = 0;
    let latestHash: string | null = null;
    let payload: unknown = buildPick3LatestHistoryPayload();
    const seenPhases = new Set<string>();

    for (let page = 0; page < 200; page += 1) {
      const { draws, officialApiResponseHash } = await fetchPick3HistoryPage(payload);
      latestHash = officialApiResponseHash;
      const freshDraws = draws.filter((draw) => !seenPhases.has(draw.phase));
      for (const draw of freshDraws) seenPhases.add(draw.phase);
      rowsSeen += freshDraws.length;
      const upsert = storage.upsertDraws(freshDraws);
      rowsInserted += upsert.inserted;
      rowsUpdated += upsert.updated;
      const oldest = freshDraws[freshDraws.length - 1];
      if (!oldest || freshDraws.length === 0) break;
      payload = buildPick3CursorHistoryPayload(oldest.phase);
      if (dateKey(oldest) <= bounds.startTime) {
        break;
      }
    }

    const allDraws = storage.listDrawsAscending();
    verifyPick3FullHistoryCoverage({ bounds, drawsAscending: allDraws });
    return {
      storage,
      summary: {
        runId,
        status: "success" as const,
        officialStartTime: bounds.startTime,
        officialEndTime: bounds.endTime,
        rowsSeen,
        rowsInserted,
        rowsUpdated,
        newestPhase: allDraws[allDraws.length - 1]?.phase ?? null,
        oldestPhase: allDraws[0]?.phase ?? null,
        reason: null,
        officialApiResponseHash: latestHash,
      },
    };
  } catch (error) {
    storage.close();
    throw error;
  }
};

const selectBatchTargets = (
  input: Pick3Input,
  storage: ReturnType<typeof openPick3Storage>,
): { drawsAscending: Pick3Draw[]; targetDraws: Pick3Draw[] } => {
  const drawsAscending = storage.listDrawsAscending();
  const targetDraws = storage.listTargetDraws({
    ...(input.explicitTargetPhases ? { phases: input.explicitTargetPhases } : {}),
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
): Pick3PlaybookPromptPackage[] => {
  const playbookByPosition = new Map(playbooks.map((playbook) => [playbook.position, playbook]));
  return images.map((image) => {
    const playbook = playbookByPosition.get(image.position);
    if (!playbook) {
      throw new Error(`pick3_playbook_missing_${image.position}`);
    }
    return buildPick3PlaybookPromptPackage(playbook, image);
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
  const { drawsAscending, targetDraws } = selectBatchTargets(input, storage);
  const batchId = `pick3_batch_${randomUUID()}`;
  const artifactDir = resolveArtifactDir(input, context, batchId);
  mkdirSync(artifactDir, { recursive: true });
  const images = await createPick3BlindImages({
    artifactDir,
    batchId,
    drawsAscending,
    positions: input.positions,
    targetDraws,
  });
  const playbooks = loadBuiltInPick3Playbooks();
  storage.upsertPlaybooks(playbooks);
  const promptPackages = buildPromptPackages(images, playbooks);
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
    targetPhase: targetDraws[0]?.phase ?? null,
    sealedAnswersHash,
  });
  storage.insertImages(images);
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
  candidatePlaybooks: unknown;
}): void => {
  writeFileSync(path.join(input.batch.artifactDir, "ai_gateway_inputs.json"), `${JSON.stringify(input.gatewayInputs, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_interactions.json"), `${JSON.stringify(input.interactions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_predictions.json"), `${JSON.stringify(input.predictions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "public_results.json"), `${JSON.stringify(input.reveals, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "failure_reviews.json"), `${JSON.stringify(input.failureReviews, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "candidate_playbooks.json"), `${JSON.stringify(input.candidatePlaybooks, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "next_blind_validation_plan.json"), `${JSON.stringify({
    required: true,
    status: "pending_new_sealed_batch",
    reason: "Candidate Playbook repair is diagnostic until the next sealed blind batch is predicted and scored.",
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

const runFullPipeline = async (input: {
  batch: BuiltPick3Batch;
  context: RunPick3Context;
  flowLog: Pick3FlowLog | null;
  storage: ReturnType<typeof openPick3Storage>;
}): Promise<Pick3ScoringSummary> => {
  const sender = input.context.pick3GatewaySender;
  if (!sender) {
    throw new Error("pick3_prompt_exchange_sender_missing");
  }
  const exchange = await runPick3LoggedStage({
    flowLog: input.flowLog, stageName: "PICK3_PROMPT_EXCHANGE",
    refs: { batchId: input.batch.batchId, artifactDir: input.batch.artifactDir },
    metrics: { imageCount: input.batch.images.length, promptPackageCount: input.batch.promptPackages.length },
    run: () => runPick3PromptExchange({ artifactDir: input.batch.artifactDir, images: input.batch.images, promptPackages: input.batch.promptPackages, sender }),
    complete: (value) => ({ refs: { batchId: input.batch.batchId }, metrics: { interactionCount: value.interactions.length, predictionCount: value.predictions.length, imageCount: input.batch.images.length } }),
  });
  input.storage.insertAiInteractions(exchange.interactions);
  input.storage.insertPredictions(exchange.predictions);
  const parseFailures = exchange.interactions.filter((interaction) => interaction.parseStatus !== "parsed");
  if (parseFailures.length > 0 || exchange.predictions.length !== input.batch.images.length) {
    writePromptExchangeFailureArtifacts({
      batch: input.batch,
      gatewayInputs: exchange.gatewayInputs,
      interactions: exchange.interactions,
      predictions: exchange.predictions,
    });
    const firstFailure = parseFailures[0];
    throw new Error(`pick3_prompt_exchange_parse_failed_${parseFailures.length}_of_${input.batch.images.length}_${firstFailure?.parseFailureReason ?? "prediction_count_mismatch"}`);
  }
  const scoringStage = startPick3Stage({ flowLog: input.flowLog, stageName: "PICK3_REVEAL_AND_SCORING", refs: { batchId: input.batch.batchId }, metrics: { predictionCount: exchange.predictions.length } });
  const reveals = revealPick3Predictions({
    images: input.batch.images,
    predictions: exchange.predictions,
  });
  input.storage.insertReveals(reveals);
  const failureReviews = reviewPick3Failures({
    images: input.batch.images,
    predictions: exchange.predictions,
    reveals,
  });
  input.storage.insertFailureReviews(failureReviews);
  const candidatePlaybooks = writeCandidatePick3Playbooks({
    artifactDir: input.batch.artifactDir,
    activePlaybooks: input.batch.playbooks,
    failureReviews,
  });
  input.storage.upsertPlaybooks(candidatePlaybooks);
  writePipelineArtifacts({
    batch: input.batch,
    gatewayInputs: exchange.gatewayInputs,
    interactions: exchange.interactions,
    predictions: exchange.predictions,
    reveals,
    failureReviews,
    candidatePlaybooks,
  });
  const scoring = scorePick3Predictions({ predictions: exchange.predictions, reveals });
  completePick3Stage({ stage: scoringStage, refs: { batchId: input.batch.batchId }, metrics: { revealCount: reveals.length, failureReviewCount: failureReviews.length, hitCount: scoring.hits, abstainCount: scoring.abstains, coverageRate: scoring.coverageRate } });
  return scoring;
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
  scoring: Pick3ScoringSummary | null;
  summary: Awaited<ReturnType<typeof syncOfficialDraws>>["summary"];
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  status: input.summary.status,
  reachedStep: input.mode === "full_pipeline" && input.batch ? "scoring_completed" : input.batch ? "images_generated" : "official_sync_completed",
  reason: null,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: input.scoring,
});

const buildPick3ReviewRequiredTaskRecord = (input: {
  batch: BuiltPick3Batch | null;
  createdAt: string;
  mode: Pick3Input["mode"];
  reason: string;
  summary: Awaited<ReturnType<typeof syncOfficialDraws>>["summary"];
  taskId: string;
}): Pick3TaskRecord => ({
  taskId: input.taskId,
  mode: input.mode,
  status: "review_required",
  reachedStep: input.reason.startsWith("pick3_prompt_exchange_parse_failed")
    ? "ai_prompt_exchange_failed"
    : input.batch ? "full_pipeline_failed" : "batch_generation",
  reason: input.reason,
  createdAt: input.createdAt,
  updatedAt: new Date().toISOString(),
  sync: input.summary,
  batch: input.batch,
  scoring: null,
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
    batch = await buildBatchWithLog({ batchInput: input, context, flowLog, storage, taskId });
    const scoring = batch && input.mode === "full_pipeline"
      ? await runFullPipeline({ batch, context, flowLog, storage })
      : batch ? emptyScoring() : null;
    const record = buildPick3SuccessTaskRecord({ batch, createdAt, mode: input.mode, scoring, summary, taskId });
    storage.writeTask(record);
    completePick3Stage({ stage: taskStage, refs: { taskId, reachedStep: record.reachedStep }, metrics: { imageCount: batch?.imageCount ?? 0, hitCount: scoring?.hits ?? 0, abstainCount: scoring?.abstains ?? 0 } });
    return record;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const record = buildPick3ReviewRequiredTaskRecord({ batch, createdAt, mode: input.mode, reason, summary, taskId });
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
