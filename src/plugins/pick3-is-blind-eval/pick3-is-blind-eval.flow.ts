import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
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
  type Pick3Input,
  type Pick3ScoringSummary,
  type Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import {
  buildPick3PlaybookPromptPackage,
  loadBuiltInPick3Playbooks,
} from "./pick3-is-blind-eval.playbook.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";

export type RunPick3Context = {
  dataDir: string;
  browser?: BrowserController | undefined;
};

const hashJson = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

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
      if (oldest.expectedPrizeTime.slice(0, 10) <= bounds.startTime) {
        break;
      }
    }

    const allDraws = storage.listDrawsAscending();
    return {
      storage,
      summary: {
        runId,
        status: "success" as const,
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

const buildBatch = async (
  input: Pick3Input,
  context: RunPick3Context,
  storage: ReturnType<typeof openPick3Storage>,
): Promise<Pick3BatchSummary> => {
  const drawsAscending = storage.listDrawsAscending();
  const targetDraws = storage.listTargetDraws({
    ...(input.explicitTargetPhases ? { phases: input.explicitTargetPhases } : {}),
    batchSize: input.batchSize,
  });
  if (targetDraws.length === 0) {
    throw new Error("pick3_not_enough_history_for_l80_batch");
  }
  const batchId = `pick3_batch_${randomUUID()}`;
  const artifactDir = input.artifactRoot
    ? path.join(input.artifactRoot, batchId)
    : path.join(context.dataDir, "runtime-data", PICK3_JOB_ID, "artifacts", batchId);
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
  const playbookByPosition = new Map(playbooks.map((playbook) => [playbook.position, playbook]));
  const promptPackages = images.map((image) => {
    const playbook = playbookByPosition.get(image.position);
    if (!playbook) {
      throw new Error(`pick3_playbook_missing_${image.position}`);
    }
    return buildPick3PlaybookPromptPackage(playbook, image);
  });
  const sealedAnswers = images.map((image) => ({
    imageId: image.imageId,
    position: image.position,
    targetPhase: image.targetPhase,
    answerDigit: image.answerDigit,
    answerLabel: image.answerLabel,
  }));
  const sealedAnswersHash = hashJson(sealedAnswers);
  const playbookManifest = playbooks.map((playbook) => ({
    playbookVersionId: playbook.playbookVersionId,
    position: playbook.position,
    version: playbook.version,
    status: playbook.status,
    sourceKind: playbook.sourceKind,
    contentHash: playbook.contentHash,
    systemPromptHash: playbook.systemPromptHash,
    visualGrammarHash: playbook.visualGrammarHash,
  }));
  writeFileSync(path.join(artifactDir, "sealed_answers.json"), `${JSON.stringify(sealedAnswers, null, 2)}\n`);
  writeFileSync(path.join(artifactDir, "playbook_manifest.json"), `${JSON.stringify(playbookManifest, null, 2)}\n`);
  writeFileSync(path.join(artifactDir, "ai_prompt_manifest.json"), `${JSON.stringify(promptPackages, null, 2)}\n`);
  writeFileSync(path.join(artifactDir, "ai_image_manifest.json"), `${JSON.stringify(images.map((image) => ({
    imageId: image.imageId,
    position: image.position,
    imagePath: image.imagePath,
    imageSha256: image.imageSha256,
  })), null, 2)}\n`);
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
  };
};

export const runPick3IsBlindEvalFlow = async (
  rawInput: unknown,
  context: RunPick3Context,
): Promise<Pick3TaskRecord> => {
  const input = Pick3InputSchema.parse(rawInput);
  const taskId = `pick3_task_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const { storage, summary } = await syncOfficialDraws(context.dataDir);
  try {
    const batch = input.mode === "sync_only" ? null : await buildBatch(input, context, storage);
    const record: Pick3TaskRecord = {
      taskId,
      mode: input.mode,
      status: summary.status,
      reachedStep: batch ? "images_generated" : "official_sync_completed",
      reason: null,
      createdAt,
      updatedAt: new Date().toISOString(),
      sync: summary,
      batch,
      scoring: batch ? emptyScoring() : null,
    };
    storage.writeTask(record);
    return record;
  } catch (error) {
    const record: Pick3TaskRecord = {
      taskId,
      mode: input.mode,
      status: "review_required",
      reachedStep: "batch_generation",
      reason: error instanceof Error ? error.message : String(error),
      createdAt,
      updatedAt: new Date().toISOString(),
      sync: summary,
      batch: null,
      scoring: null,
    };
    storage.writeTask(record);
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
