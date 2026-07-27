import {
  startXuanyuanCloudWorker,
  type XuanyuanCloudWorkerHandle,
  type XuanyuanTaskRecord,
} from "../../plugins/xuanyuan/index.js";

interface XuanyuanCloudExecution {
  enqueueXuanyuanTask(input: unknown): Promise<XuanyuanTaskRecord>;
  getXuanyuanTaskStatus(taskId: string): Promise<XuanyuanTaskRecord | null>;
}

export function createWorkbenchXuanyuanCloudSupport(
  dataDir: string,
  execution: XuanyuanCloudExecution,
) {
  let worker: XuanyuanCloudWorkerHandle | null = null;
  return {
    async init() {
      if (!process.env.XUANYUAN_CLOUD_BASE_URL?.trim() || worker) return;
      worker = await startXuanyuanCloudWorker({
        dataDir,
        execution: {
          enqueueTask: execution.enqueueXuanyuanTask,
          getTaskStatus: execution.getXuanyuanTaskStatus,
        },
      });
    },
    async shutdown() {
      await worker?.close();
      worker = null;
    },
  };
}
