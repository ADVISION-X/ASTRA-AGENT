import { existsSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type {
  Pick3AiInteractionRecord,
  Pick3FailureReviewRecord,
  Pick3ImageRecord,
  Pick3PredictionRecord,
  Pick3RevealRecord,
  Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";

type EvidenceCompleteness = {
  actualRepeatResults: number;
  expectedRepeatResults: number;
  hasAllRawAnswers: boolean;
  rawAnswerCount: number;
  status: "complete" | "incomplete";
};

export type Pick3HumanReviewHistorySummary = {
  actualRepeatResults: number;
  batchId: string | null;
  createdAt: string;
  evidenceCompleteness: EvidenceCompleteness;
  expectedRepeatResults: number;
  newestOfficialPhase: string | null;
  providerKind: string | null;
  rawAnswerCount: number;
  repeatCount: number | null;
  scoring: Pick3TaskRecord["scoring"];
  selectedPositions: string[];
  status: Pick3TaskRecord["status"];
  taskMode: Pick3TaskRecord["mode"];
  targetPhase: string | null;
  taskId: string;
  updatedAt: string;
  visibleEndPhase: string | null;
  visibleStartPhase: string | null;
};

export type Pick3HumanReviewAiAnswer = {
  inputRefsJson: string;
  promptContractId: string;
  promptHash: string;
  promptPackageId: string;
  providerProofJson: string;
  rawOutputRef: string;
  rawResponseHash: string;
  rawResponseText: string;
  renderedPromptText: string;
};

export type Pick3HumanReviewRepeat = {
  aiAnswer: Pick3HumanReviewAiAnswer | null;
  confidence: number | null;
  imageId: string;
  interactionId: string;
  parseFailureReason: string | null;
  parseStatus: string | null;
  position: string;
  predictionId: string | null;
  predictionLabel: string | null;
  rawOutputRef: string | null;
  rawResponseHash: string | null;
  repeatIndex: number;
  sameImageForPosition: boolean;
  visiblePredictionLabel: string | null;
};

export type Pick3HumanReviewPhasePosition = {
  answerLabel: string | null;
  confidence: number | null;
  errorReason: string | null;
  hit: boolean | null;
  position: string;
  predictionLabel: string | null;
};

export type Pick3HumanReviewPhaseReport = {
  errorReason: string | null;
  phase: string;
  positions: Pick3HumanReviewPhasePosition[];
  status: "hit" | "miss" | "abstain" | "incomplete";
};

export type Pick3HumanReviewTaskDetail = {
  evidenceCompleteness: EvidenceCompleteness;
  images: Pick3ImageRecord[];
  observedDistribution: Record<string, Record<string, number>>;
  phaseReports: Pick3HumanReviewPhaseReport[];
  repeats: Pick3HumanReviewRepeat[];
  summary: Pick3HumanReviewHistorySummary;
  task: Pick3TaskRecord;
};

export type Pick3HumanReviewDeleteResult = {
  artifactDirDeleted: boolean;
  batchId: string | null;
  deleted: boolean;
  rawOutputRefsDeleted: number;
  taskDirDeleted: boolean;
  taskId: string;
};

const readTaskRecord = (taskJsonPath: string): Pick3TaskRecord | null => {
  try {
    return JSON.parse(readFileSync(taskJsonPath, "utf8")) as Pick3TaskRecord;
  } catch {
    return null;
  }
};

const listTaskRecords = (dataRoot: string): Pick3TaskRecord[] => {
  const tasksRoot = path.join(dataRoot, "tasks");
  if (!existsSync(tasksRoot)) return [];
  return readdirSync(tasksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readTaskRecord(path.join(tasksRoot, entry.name, "task.json")))
    .filter((record): record is Pick3TaskRecord => record !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const isInsidePath = (candidatePath: string, parentPath: string): boolean => {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedParent = path.resolve(parentPath);
  return resolvedCandidate === resolvedParent || resolvedCandidate.startsWith(`${resolvedParent}${path.sep}`);
};

const removeInsideRuntimeData = (candidatePath: string | null, runtimeDataRoot: string): boolean => {
  if (!candidatePath || !isInsidePath(candidatePath, runtimeDataRoot) || !existsSync(candidatePath)) return false;
  rmSync(candidatePath, { force: true, recursive: true });
  return true;
};

const getTargetPhase = (task: Pick3TaskRecord): string | null =>
  task.batch?.images[0]?.targetPhase ?? (task.sync.newestPhase ? `next_after_${task.sync.newestPhase}` : null);

const getSelectedPositions = (images: readonly Pick3ImageRecord[]): string[] =>
  [...new Set(images.map((image) => image.position))];

const buildCompleteness = (
  task: Pick3TaskRecord,
  interactions: readonly Pick3AiInteractionRecord[],
): EvidenceCompleteness => {
  const imageCount = task.batch?.images.length ?? 0;
  const repeatCount = task.stability?.repeatCount ?? 0;
  const expectedRepeatResults = task.mode === "next_prediction_stability" ? imageCount * repeatCount : imageCount;
  const actualRepeatResults = task.mode === "next_prediction_stability" ? task.stability?.results.length ?? 0 : interactions.length;
  const rawAnswerCount = interactions.filter((interaction) => interaction.rawResponseText.trim().length > 0).length;
  const hasAllRawAnswers = expectedRepeatResults > 0 && rawAnswerCount >= expectedRepeatResults;
  return {
    actualRepeatResults,
    expectedRepeatResults,
    hasAllRawAnswers,
    rawAnswerCount,
    status: actualRepeatResults >= expectedRepeatResults && hasAllRawAnswers ? "complete" : "incomplete",
  };
};

const buildSummary = (
  task: Pick3TaskRecord,
  interactions: readonly Pick3AiInteractionRecord[],
): Pick3HumanReviewHistorySummary => {
  const images = task.batch?.images ?? [];
  const completeness = buildCompleteness(task, interactions);
  return {
    actualRepeatResults: completeness.actualRepeatResults,
    batchId: task.batch?.batchId ?? null,
    createdAt: task.createdAt,
    evidenceCompleteness: completeness,
    expectedRepeatResults: completeness.expectedRepeatResults,
    newestOfficialPhase: task.sync.newestPhase,
    providerKind: interactions[0]?.providerKind ?? null,
    rawAnswerCount: completeness.rawAnswerCount,
    repeatCount: task.stability?.repeatCount ?? null,
    scoring: task.scoring,
    selectedPositions: getSelectedPositions(images),
    status: task.status,
    taskMode: task.mode,
    targetPhase: getTargetPhase(task),
    taskId: task.taskId,
    updatedAt: task.updatedAt,
    visibleEndPhase: images[0]?.visibleEndPhase ?? null,
    visibleStartPhase: images[0]?.visibleStartPhase ?? null,
  };
};

const visiblePredictionLabel = (label: string | null): "lower" | "upper" | "abstain" | null => {
  if (label === "front") return "lower";
  if (label === "back") return "upper";
  if (label === "abstain") return "abstain";
  return null;
};

const buildAiAnswer = (interaction: Pick3AiInteractionRecord): Pick3HumanReviewAiAnswer => ({
  inputRefsJson: interaction.inputRefsJson,
  promptContractId: interaction.promptContractId,
  promptHash: interaction.promptHash,
  promptPackageId: interaction.promptPackageId,
  providerProofJson: interaction.providerProofJson,
  rawOutputRef: interaction.rawOutputRef,
  rawResponseHash: interaction.rawResponseHash,
  rawResponseText: interaction.rawResponseText,
  renderedPromptText: interaction.renderedPromptText,
});

const buildImageSetByPosition = (images: readonly Pick3ImageRecord[]): Map<string, Set<string>> => {
  const byPosition = new Map<string, Set<string>>();
  for (const image of images) {
    const bucket = byPosition.get(image.position) ?? new Set<string>();
    bucket.add(image.imageId);
    byPosition.set(image.position, bucket);
  }
  return byPosition;
};

const buildRepeats = (
  task: Pick3TaskRecord,
  interactions: readonly Pick3AiInteractionRecord[],
  predictions: readonly Pick3PredictionRecord[],
): Pick3HumanReviewRepeat[] => {
  if (task.mode !== "next_prediction_stability") return buildFullPipelineAnswers(task, interactions, predictions);
  const interactionsById = new Map(interactions.map((interaction) => [interaction.interactionId, interaction]));
  const predictionsById = new Map(predictions.map((prediction) => [prediction.predictionId, prediction]));
  const imageSetByPosition = buildImageSetByPosition(task.batch?.images ?? []);
  return (task.stability?.results ?? []).map((result) => {
    const interaction = interactionsById.get(result.interactionId);
    const prediction = result.predictionId ? predictionsById.get(result.predictionId) : null;
    return {
      aiAnswer: interaction ? buildAiAnswer(interaction) : null,
      confidence: result.confidence,
      imageId: result.imageId,
      interactionId: result.interactionId,
      parseFailureReason: result.parseFailureReason,
      parseStatus: result.parseStatus,
      position: result.position,
      predictionId: result.predictionId,
      predictionLabel: prediction?.predictionLabel ?? result.predictionLabel,
      rawOutputRef: interaction?.rawOutputRef ?? result.rawOutputRef,
      rawResponseHash: interaction?.rawResponseHash ?? prediction?.rawResponseHash ?? null,
      repeatIndex: result.repeatIndex,
      sameImageForPosition: (imageSetByPosition.get(result.position)?.size ?? 0) === 1,
      visiblePredictionLabel: result.visiblePredictionLabel,
    };
  });
};

const buildFullPipelineAnswers = (
  task: Pick3TaskRecord,
  interactions: readonly Pick3AiInteractionRecord[],
  predictions: readonly Pick3PredictionRecord[],
): Pick3HumanReviewRepeat[] => {
  const predictionByInteraction = new Map(predictions.map((prediction) => [prediction.interactionId, prediction]));
  const imageSetByPosition = buildImageSetByPosition(task.batch?.images ?? []);
  return interactions.map((interaction, index) => {
    const prediction = predictionByInteraction.get(interaction.interactionId);
    return {
      aiAnswer: buildAiAnswer(interaction),
      confidence: prediction?.confidence ?? null,
      imageId: interaction.imageId,
      interactionId: interaction.interactionId,
      parseFailureReason: interaction.parseFailureReason,
      parseStatus: interaction.parseStatus,
      position: interaction.position,
      predictionId: prediction?.predictionId ?? null,
      predictionLabel: prediction?.predictionLabel ?? null,
      rawOutputRef: interaction.rawOutputRef,
      rawResponseHash: interaction.rawResponseHash,
      repeatIndex: index + 1,
      sameImageForPosition: (imageSetByPosition.get(interaction.position)?.size ?? 0) === 1,
      visiblePredictionLabel: visiblePredictionLabel(prediction?.predictionLabel ?? null),
    };
  });
};

const buildObservedDistribution = (repeats: readonly Pick3HumanReviewRepeat[]): Record<string, Record<string, number>> => {
  const distribution: Record<string, Record<string, number>> = {};
  for (const repeat of repeats) {
    const label = repeat.visiblePredictionLabel ?? "unknown";
    const byPosition = distribution[repeat.position] ?? {};
    byPosition[label] = (byPosition[label] ?? 0) + 1;
    distribution[repeat.position] = byPosition;
  }
  return distribution;
};

const positionErrorReason = (input: {
  failureReview: Pick3FailureReviewRecord | undefined;
  interaction: Pick3AiInteractionRecord | undefined;
  prediction: Pick3PredictionRecord | undefined;
  reveal: Pick3RevealRecord | undefined;
}): string | null => {
  if (input.interaction?.parseStatus === "parse_failed_raw_available") return input.interaction.parseFailureReason ?? "parse_failed_raw_available";
  if (!input.prediction) return "prediction_missing";
  if (input.prediction.predictionLabel === "abstain") return input.prediction.abstainReason ?? "ai_abstained";
  if (input.reveal?.hit === false) return input.failureReview?.promptProblem ?? `predicted ${input.prediction.predictionLabel}, answer ${input.reveal.answerLabel}`;
  return null;
};

const buildPhaseReports = (
  task: Pick3TaskRecord,
  interactions: readonly Pick3AiInteractionRecord[],
  predictions: readonly Pick3PredictionRecord[],
  reveals: readonly Pick3RevealRecord[],
  failureReviews: readonly Pick3FailureReviewRecord[],
): Pick3HumanReviewPhaseReport[] => {
  if (task.mode !== "full_pipeline") return [];
  const interactionByImage = new Map(interactions.map((interaction) => [interaction.imageId, interaction]));
  const predictionByImage = new Map(predictions.map((prediction) => [prediction.imageId, prediction]));
  const revealByPrediction = new Map(reveals.map((reveal) => [reveal.predictionId, reveal]));
  const failureByPrediction = new Map(failureReviews.map((review) => [review.predictionId, review]));
  const imagesByPhase = new Map<string, Pick3ImageRecord[]>();
  for (const image of task.batch?.images ?? []) imagesByPhase.set(image.targetPhase, [...(imagesByPhase.get(image.targetPhase) ?? []), image]);
  return [...imagesByPhase.entries()].map(([phase, images]) => {
    const positions = images.map((image) => {
      const interaction = interactionByImage.get(image.imageId);
      const prediction = predictionByImage.get(image.imageId);
      const reveal = prediction ? revealByPrediction.get(prediction.predictionId) : undefined;
      const failureReview = prediction ? failureByPrediction.get(prediction.predictionId) : undefined;
      return {
        answerLabel: image.answerLabel,
        confidence: prediction?.confidence ?? null,
        errorReason: positionErrorReason({ failureReview, interaction, prediction, reveal }),
        hit: reveal?.hit ?? null,
        position: image.position,
        predictionLabel: prediction?.predictionLabel ?? null,
      };
    });
    const missing = positions.some((item) => item.hit === null);
    const abstain = positions.some((item) => item.predictionLabel === "abstain");
    const miss = positions.some((item) => item.hit === false);
    const status = missing ? "incomplete" : miss ? "miss" : abstain ? "abstain" : "hit";
    return {
      errorReason: positions.map((item) => item.errorReason).filter((reason): reason is string => Boolean(reason)).join(" | ") || null,
      phase,
      positions,
      status,
    };
  });
};

export const listPick3HumanReviewHistory = (
  dataDir: string,
  input: { limit?: number } = {},
): Pick3HumanReviewHistorySummary[] => {
  const storage = openPick3Storage(dataDir);
  try {
    const limit = input.limit ?? 50;
    return listTaskRecords(storage.dataRoot)
      .filter((task) => task.mode === "next_prediction_stability" || task.mode === "full_pipeline")
      .slice(0, limit)
      .map((task) => buildSummary(task, task.batch ? storage.listAiInteractions(task.batch.batchId) : []));
  } finally {
    storage.close();
  }
};

export const getPick3HumanReviewTask = (dataDir: string, taskId: string): Pick3HumanReviewTaskDetail | null => {
  const storage = openPick3Storage(dataDir);
  try {
    const task = readTaskRecord(path.join(storage.dataRoot, "tasks", taskId, "task.json"));
    if (!task || (task.mode !== "next_prediction_stability" && task.mode !== "full_pipeline")) return null;
    const batchId = task.batch?.batchId;
    const interactions = batchId ? storage.listAiInteractions(batchId) : [];
    const predictions = batchId ? storage.listPredictions(batchId) : [];
    const reveals = batchId ? storage.listReveals(batchId) : [];
    const failureReviews = batchId ? storage.listFailureReviews(batchId) : [];
    const repeats = buildRepeats(task, interactions, predictions);
    return {
      evidenceCompleteness: buildCompleteness(task, interactions),
      images: task.batch?.images ?? [],
      observedDistribution: buildObservedDistribution(repeats),
      phaseReports: buildPhaseReports(task, interactions, predictions, reveals, failureReviews),
      repeats,
      summary: buildSummary(task, interactions),
      task,
    };
  } finally {
    storage.close();
  }
};

export const getPick3HumanReviewInteraction = (
  dataDir: string,
  input: { interactionId: string; taskId: string },
): Pick3HumanReviewAiAnswer | null => {
  const detail = getPick3HumanReviewTask(dataDir, input.taskId);
  const repeat = detail?.repeats.find((item) => item.interactionId === input.interactionId);
  return repeat?.aiAnswer ?? null;
};

const deleteBatchRows = (dbPath: string, batchId: string): void => {
  const db = new Database(dbPath);
  try {
    db.transaction(() => {
      db.prepare(`
DELETE FROM ai_reveals
WHERE prediction_id IN (SELECT prediction_id FROM ai_predictions WHERE batch_id = ?)
`).run(batchId);
      db.prepare("DELETE FROM failure_reviews WHERE batch_id = ?").run(batchId);
      db.prepare("DELETE FROM ai_predictions WHERE batch_id = ?").run(batchId);
      db.prepare("DELETE FROM pick3_ai_interactions WHERE batch_id = ?").run(batchId);
      db.prepare("DELETE FROM is_blind_images WHERE batch_id = ?").run(batchId);
      db.prepare("DELETE FROM is_blind_batches WHERE batch_id = ?").run(batchId);
    })();
  } finally {
    db.close();
  }
};

const rewriteLatestAfterDelete = (dataRoot: string, taskId: string): void => {
  const latestPath = path.join(dataRoot, "latest-task.json");
  const latest = readTaskRecord(latestPath);
  if (latest?.taskId !== taskId) return;
  const replacement = listTaskRecords(dataRoot).find((task) => task.taskId !== taskId);
  if (replacement) {
    writeFileSync(latestPath, `${JSON.stringify(replacement, null, 2)}\n`);
    return;
  }
  if (existsSync(latestPath)) unlinkSync(latestPath);
};

export const deletePick3HumanReviewTask = (
  dataDir: string,
  taskId: string,
): Pick3HumanReviewDeleteResult | null => {
  const storage = openPick3Storage(dataDir);
  const task = readTaskRecord(path.join(storage.dataRoot, "tasks", taskId, "task.json"));
  if (!task || (task.mode !== "next_prediction_stability" && task.mode !== "full_pipeline")) {
    storage.close();
    return null;
  }
  const batchId = task.batch?.batchId ?? null;
  const interactions = batchId ? storage.listAiInteractions(batchId) : [];
  const dataRoot = storage.dataRoot;
  const dbPath = storage.dbPath;
  storage.close();
  const runtimeDataRoot = path.join(dataDir, "runtime-data");
  let rawOutputRefsDeleted = 0;
  for (const interaction of interactions) {
    if (removeInsideRuntimeData(interaction.rawOutputRef, runtimeDataRoot)) rawOutputRefsDeleted += 1;
  }
  if (batchId) deleteBatchRows(dbPath, batchId);
  const artifactDirDeleted = removeInsideRuntimeData(task.batch?.artifactDir ?? null, runtimeDataRoot);
  const taskDirDeleted = removeInsideRuntimeData(path.join(dataRoot, "tasks", taskId), runtimeDataRoot);
  rewriteLatestAfterDelete(dataRoot, taskId);
  return { artifactDirDeleted, batchId, deleted: true, rawOutputRefsDeleted, taskDirDeleted, taskId };
};
