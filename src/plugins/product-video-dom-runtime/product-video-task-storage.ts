import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  type ProductVideoDomMissionInput,
  type ProductVideoDomTaskRecord,
} from "./product-video-dom.schema.js";

const safeSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "product-video";

export const createProductVideoDomTaskId = (): string =>
  `product-video-dom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const taskDir = (dataDir: string, taskId: string): string =>
  path.join(dataDir, "plugin-tasks", "product-video-dom-runtime", safeSegment(taskId));

export const buildReceivedProductVideoTaskRecord = (input: {
  taskId: string;
  mission: ProductVideoDomMissionInput;
}): ProductVideoDomTaskRecord => {
  const now = new Date().toISOString();
  return {
    taskId: input.taskId,
    mission: input.mission,
    status: "received",
    ok: false,
    reason: "Product video DOM mining task received.",
    reachedStep: "received",
    evidenceRefs: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const saveProductVideoTaskRecord = (dataDir: string, record: ProductVideoDomTaskRecord): void => {
  const directory = taskDir(dataDir, record.taskId);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "task.json"), JSON.stringify(record, null, 2));
};

export const loadProductVideoTaskRecord = (dataDir: string, taskId: string): ProductVideoDomTaskRecord | null => {
  const recordPath = path.join(taskDir(dataDir, taskId), "task.json");
  if (!existsSync(recordPath)) return null;
  return JSON.parse(readFileSync(recordPath, "utf8")) as ProductVideoDomTaskRecord;
};

export const updateProductVideoTaskRecord = (
  record: ProductVideoDomTaskRecord,
  patch: Pick<ProductVideoDomTaskRecord, "status" | "ok" | "reason" | "reachedStep"> & Partial<Pick<ProductVideoDomTaskRecord, "evidencePacketPath" | "evidenceRefs">>,
): ProductVideoDomTaskRecord => ({
  ...record,
  ...patch,
  updatedAt: new Date().toISOString(),
});
