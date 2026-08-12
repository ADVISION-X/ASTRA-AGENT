import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BuiltPick3Batch } from "./pick3-is-blind-eval.flow-types.js";
import {
  Pick3InputSchema,
  type Pick3TaskRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3ResumeInput } from "./pick3-is-blind-eval.resume-schema.js";
import { createPick3FlowLogger } from "./pick3-is-blind-eval.logging.js";
import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";
import {
  runPick3FullPipeline,
  runPick3IsBlindEvalFlow,
  type RunPick3Context,
} from "./pick3-is-blind-eval.flow.js";
import { openPick3Storage } from "./pick3-is-blind-eval.storage.js";
import {
  buildPick3SuccessTaskRecord,
  emptyRunningSyncSummary,
} from "./pick3-is-blind-eval.task-record.js";

export const startPick3IsBlindEvalTask = (
  rawInput: unknown,
  context: RunPick3Context,
): Pick3TaskRecord => {
  const input = Pick3InputSchema.parse(rawInput);
  const taskId = `pick3_task_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const storage = openPick3Storage(context.dataDir);
  const initial: Pick3TaskRecord = {
    taskId,
    mode: input.mode,
    promptMode: input.promptMode,
    status: "running",
    reachedStep: "task_started",
    reason: null,
    progress: null,
    createdAt,
    updatedAt: createdAt,
    sync: emptyRunningSyncSummary(taskId),
    batch: null,
    scoring: null,
    stability: null,
  };
  storage.writeTask(initial);
  storage.close();
  void runPick3IsBlindEvalFlow(rawInput, { ...context, taskId }).catch((error) => {
    const failedStorage = openPick3Storage(context.dataDir);
    try {
      const latest = failedStorage.readTask(taskId) ?? initial;
      failedStorage.writeTask({
        ...latest,
        status: "review_required",
        reachedStep: "background_failed",
        reason: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      failedStorage.close();
    }
  });
  return initial;
};

export const getLatestPick3IsBlindEvalTask = (dataDir: string): Pick3TaskRecord | null => {
  const storage = openPick3Storage(dataDir);
  try {
    return storage.readLatestTask();
  } finally {
    storage.close();
  }
};

const readPromptPackages = (artifactDir: string): Pick3PlaybookPromptPackage[] =>
  JSON.parse(readFileSync(path.join(artifactDir, "ai_prompt_manifest.json"), "utf8")) as Pick3PlaybookPromptPackage[];

const buildBatchFromTask = (task: Pick3TaskRecord): BuiltPick3Batch => {
  if (!task.batch) throw new Error("pick3_resume_batch_missing");
  return {
    batchId: task.batch.batchId,
    artifactDir: task.batch.artifactDir,
    imageCount: task.batch.imageCount,
    sealedAnswersHash: task.batch.sealedAnswersHash,
    images: task.batch.images,
    playbooks: [],
    promptPackages: readPromptPackages(task.batch.artifactDir),
  };
};

export const getPick3IsBlindEvalTaskStatus = (dataDir: string, taskId: string): Pick3TaskRecord | null => {
  const storage = openPick3Storage(dataDir);
  try {
    return storage.readTask(taskId);
  } finally {
    storage.close();
  }
};

export const resumePick3IsBlindEvalTask = async (
  input: Pick3ResumeInput,
  context: RunPick3Context,
): Promise<Pick3TaskRecord> => {
  const storage = openPick3Storage(context.dataDir);
  try {
    const task = storage.readTask(input.taskId);
    if (!task) throw new Error("pick3_resume_task_not_found");
    const batch = buildBatchFromTask(task);
    const flowLog = createPick3FlowLogger({ runtimeLogger: context.runtimeLogger, taskId: task.taskId });
    const resumedInput = Pick3InputSchema.parse({
      mode: task.mode,
      promptMode: task.promptMode,
      providerKind: input.providerKind ?? "gpt-web-chat",
      batchSize: Math.max(1, task.progress?.expectedCount ?? batch.images.length),
      positions: [...new Set(batch.images.map((image) => image.position))],
      dryRun: false,
    });
    const scoring = task.mode === "full_pipeline"
      ? await runPick3FullPipeline({
          batch,
          batchInput: resumedInput,
          context,
          createdAt: task.createdAt,
          flowLog,
          storage,
          summary: task.sync,
          taskId: task.taskId,
        })
      : task.scoring;
    const record = buildPick3SuccessTaskRecord({
      batch,
      createdAt: task.createdAt,
      mode: task.mode,
      promptMode: task.promptMode,
      scoring,
      stability: task.stability,
      summary: task.sync,
      taskId: task.taskId,
    });
    storage.writeTask(record);
    return record;
  } catch (error) {
    const existing = storage.readTask(input.taskId);
    if (!existing) throw error;
    const record = {
      ...existing,
      status: "review_required" as const,
      reachedStep: "resume_failed",
      reason: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    };
    storage.writeTask(record);
    return record;
  } finally {
    storage.close();
  }
};
