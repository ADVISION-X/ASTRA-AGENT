import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Pick3TaskRecord } from "./pick3-is-blind-eval.schema.js";

export const writeTaskRecord = (dataRoot: string, record: Pick3TaskRecord): void => {
  const taskDir = path.join(dataRoot, "tasks", record.taskId);
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, "task.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(path.join(dataRoot, "latest-task.json"), `${JSON.stringify(record, null, 2)}\n`);
};

export const readLatestTaskRecord = (dataRoot: string): Pick3TaskRecord | null => {
  try {
    return JSON.parse(readFileSync(path.join(dataRoot, "latest-task.json"), "utf8")) as Pick3TaskRecord;
  } catch {
    return null;
  }
};

export const readTaskRecordById = (dataRoot: string, taskId: string): Pick3TaskRecord | null => {
  try {
    const parsed = JSON.parse(readFileSync(path.join(dataRoot, "tasks", taskId, "task.json"), "utf8")) as Pick3TaskRecord;
    return parsed.taskId === taskId ? parsed : null;
  } catch {
    return null;
  }
};
