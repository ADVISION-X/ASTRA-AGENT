import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { XUANYUAN_JOB_ID, type XuanyuanTaskRecord } from "./xuanyuan.schema.js";
import {
  buildXuanyuanTaskName,
  resolveXuanyuanTaskLabelKey,
} from "./xuanyuan-task-identity.js";

const tasksDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", XUANYUAN_JOB_ID, "tasks");

const taskPath = (dataDir: string, taskId: string): string =>
  path.join(tasksDir(dataDir), `${taskId}.json`);

const isLegacyRecoverable = (stored: XuanyuanTaskRecord): boolean =>
  stored.status === "running"
  || (
    (stored.status === "failed" || stored.status === "review_required")
    && Boolean(stored.progress?.attachmentUploadProof)
  );

const hydrateStoredXuanyuanTask = (
  stored: XuanyuanTaskRecord,
): XuanyuanTaskRecord => {
  const taskLabelKey =
    stored.taskLabelKey ?? resolveXuanyuanTaskLabelKey(stored.scenario);
  const recoverable = isLegacyRecoverable(stored);
  const progress = stored.progress ?? {
    executionId: stored.taskId,
    phase: stored.status === "running" ? "recovery_pending" : "terminal",
    lastTransitionAt: stored.updatedAt,
    attachmentUploadProof: null,
  };
  return {
    ...stored,
    taskLabelKey,
    taskName:
      stored.taskName ?? buildXuanyuanTaskName(taskLabelKey, stored.taskId),
    progress: {
      ...progress,
      lastTransitionAt: progress.lastTransitionAt ?? stored.updatedAt,
    },
    recovery: stored.recovery ?? {
      attemptCount: stored.status === "queued" ? 0 : 1,
      recoverable,
      lastAttemptStartedAt: stored.status === "queued" ? null : stored.updatedAt,
      lastFailureAt:
        stored.status === "failed" || stored.status === "review_required"
          ? stored.updatedAt
          : null,
      lastFailureReason:
        stored.failureReason ?? stored.reviewRequiredReason ?? null,
      recoveryDirective: recoverable
        ? "resume_exact_provider_conversation"
        : "none",
    },
  };
};

export const writeXuanyuanTask = async (
  dataDir: string,
  record: XuanyuanTaskRecord,
): Promise<XuanyuanTaskRecord> => {
  await mkdir(tasksDir(dataDir), { recursive: true });
  const destination = taskPath(dataDir, record.taskId);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
  return record;
};

export const readXuanyuanTask = async (
  dataDir: string,
  taskId: string,
): Promise<XuanyuanTaskRecord | null> => {
  try {
    const stored = JSON.parse(
      await readFile(taskPath(dataDir, taskId), "utf8"),
    ) as XuanyuanTaskRecord;
    return hydrateStoredXuanyuanTask(stored);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const listStoredXuanyuanTasks = async (
  dataDir: string,
): Promise<XuanyuanTaskRecord[]> => {
  try {
    const names = await readdir(tasksDir(dataDir));
    const records = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map((name) => readXuanyuanTask(dataDir, name.slice(0, -5))),
    );
    return records
      .filter((record): record is XuanyuanTaskRecord => Boolean(record))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};
