import type { XuanyuanTaskRecord } from "./xuanyuan.schema.js";
import {
  listStoredXuanyuanTasks,
  readXuanyuanTask,
} from "./xuanyuan.store.js";

type XuanyuanDataRuntime = { dataDir: string };

export const getXuanyuanTaskStatus = (
  runtime: XuanyuanDataRuntime,
  taskId: string,
): Promise<XuanyuanTaskRecord | null> =>
  readXuanyuanTask(runtime.dataDir, taskId);

export const listXuanyuanHistory = (
  runtime: XuanyuanDataRuntime,
): Promise<XuanyuanTaskRecord[]> =>
  listStoredXuanyuanTasks(runtime.dataDir);

export const getLatestXuanyuanTask = async (
  runtime: XuanyuanDataRuntime,
): Promise<XuanyuanTaskRecord | null> =>
  (await listStoredXuanyuanTasks(runtime.dataDir))[0] ?? null;
