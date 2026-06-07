import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { routeMediaProcessingArtifactJob } from "../mediator/media-processing-artifact-route.js";

export type MediaProcessingJobInput = Parameters<typeof routeMediaProcessingArtifactJob>[0];

export type MediaProcessingTaskSnapshot = {
  taskId: string;
  status: "running" | "success" | "failed" | "review_required" | "invalid_input";
  startedAt: string;
  updatedAt: string;
  presetId: MediaProcessingJobInput["presetId"];
  sourceFileName: string;
  record: Awaited<ReturnType<typeof routeMediaProcessingArtifactJob>> | null;
  downloadsPath: string | null;
  downloadsPaths: string[];
  failureReason: string | null;
};

const MEDIA_PROCESSING_TASK_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_PROCESSING_TASK_PERSISTENCE_FAILED = "media_processing_task_persistence_failed";

export const mediaProcessingTasks = new Map<string, MediaProcessingTaskSnapshot>();

const taskStoreDir = (workbench: GrassEyeWorkbenchHandle): string =>
  path.join(workbench.getDataDir(), "runtime-data", "media-processing-tasks");

const taskStorePath = (workbench: GrassEyeWorkbenchHandle, taskId: string): string =>
  path.join(taskStoreDir(workbench), `${taskId}.json`);

export const persistenceFailureReason = (error: unknown): string =>
  `${MEDIA_PROCESSING_TASK_PERSISTENCE_FAILED}: ${error instanceof Error ? error.message : String(error)}`;

export const persistMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  task: MediaProcessingTaskSnapshot,
): Promise<void> => {
  await mkdir(taskStoreDir(workbench), { recursive: true });
  const destination = taskStorePath(workbench, task.taskId);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(task, null, 2)}\n`);
  await rename(temporary, destination);
};

export const readPersistedMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<MediaProcessingTaskSnapshot | null> => {
  try {
    const parsed = JSON.parse(await readFile(taskStorePath(workbench, taskId), "utf8")) as MediaProcessingTaskSnapshot;
    if (parsed.taskId !== taskId) return null;
    const task = {
      ...parsed,
      downloadsPaths: Array.isArray(parsed.downloadsPaths) ? parsed.downloadsPaths : [],
    };
    return parsed.status === "running"
      ? {
          ...task,
          status: "failed",
          updatedAt: new Date().toISOString(),
          failureReason: "media_processing_task_interrupted_before_completion",
        }
      : task;
  } catch {
    return null;
  }
};

const pruneMediaProcessingTasks = (): void => {
  const now = Date.now();
  for (const [taskId, task] of mediaProcessingTasks) {
    if (now - Date.parse(task.updatedAt) > MEDIA_PROCESSING_TASK_TTL_MS) {
      mediaProcessingTasks.delete(taskId);
    }
  }
};

export const runningTaskCount = (): number => {
  pruneMediaProcessingTasks();
  return [...mediaProcessingTasks.values()].filter((task) => task.status === "running").length;
};

export const buildInitialMediaProcessingTask = (
  taskId: string,
  input: MediaProcessingJobInput,
): MediaProcessingTaskSnapshot => {
  const now = new Date().toISOString();
  return {
    taskId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    presetId: input.presetId,
    sourceFileName: path.basename(input.inputFilePath),
    record: null,
    downloadsPath: null,
    downloadsPaths: [],
    failureReason: null,
  };
};

export const persistTerminalMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  terminalTask: MediaProcessingTaskSnapshot,
): Promise<void> => {
  try {
    await persistMediaProcessingTask(workbench, terminalTask);
    mediaProcessingTasks.set(taskId, terminalTask);
  } catch (error) {
    const failed: MediaProcessingTaskSnapshot = {
      ...terminalTask,
      status: "failed",
      updatedAt: new Date().toISOString(),
      record: null,
      downloadsPath: null,
      downloadsPaths: [],
      failureReason: persistenceFailureReason(error),
    };
    mediaProcessingTasks.set(taskId, failed);
    try {
      await persistMediaProcessingTask(workbench, failed);
    } catch {
      return;
    }
  }
};
