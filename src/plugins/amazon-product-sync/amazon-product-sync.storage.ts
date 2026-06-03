import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AmazonProductSyncTaskRecord } from "./amazon-product-sync.schema.js";

const TASK_DIR = "amazon-product-sync-tasks";

const taskDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", TASK_DIR);

const taskPath = (dataDir: string, taskId: string): string =>
  path.join(taskDir(dataDir), `${taskId}.json`);

export const persistAmazonProductSyncTask = async (
  dataDir: string,
  task: AmazonProductSyncTaskRecord,
): Promise<AmazonProductSyncTaskRecord> => {
  await mkdir(taskDir(dataDir), { recursive: true });
  await writeFile(taskPath(dataDir, task.taskId), JSON.stringify(task, null, 2));
  return task;
};

export const readAmazonProductSyncTask = async (
  dataDir: string,
  taskId: string,
): Promise<AmazonProductSyncTaskRecord | null> => {
  try {
    return JSON.parse(await readFile(taskPath(dataDir, taskId), "utf8")) as AmazonProductSyncTaskRecord;
  } catch {
    return null;
  }
};

export const readLatestAmazonProductSyncTask = async (
  dataDir: string,
): Promise<AmazonProductSyncTaskRecord | null> => {
  try {
    const dir = taskDir(dataDir);
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
    const latest = files.at(-1);
    if (!latest) return null;
    return JSON.parse(await readFile(path.join(dir, latest), "utf8")) as AmazonProductSyncTaskRecord;
  } catch {
    return null;
  }
};

