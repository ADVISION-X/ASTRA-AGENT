import { runXuanyuanRoute } from "../../mediator/xuanyuan-route.js";
import {
  createXuanyuanTaskCoordinator,
  getLatestXuanyuanTask,
  getXuanyuanTaskStatus,
  listXuanyuanHistory,
} from "../../plugins/xuanyuan/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

export const buildXuanyuanHandle = (assembly: WorkbenchAssembly) => {
  const coordinator = createXuanyuanTaskCoordinator(assembly);
  const dataRuntime = { dataDir: assembly.dataDir };
  return {
    init: () => coordinator.init(),
    enqueueXuanyuanTask: (rawInput: unknown) => runXuanyuanRoute(rawInput, coordinator),
    getXuanyuanTaskStatus: (taskId: string) => getXuanyuanTaskStatus(dataRuntime, taskId),
    getLatestXuanyuanTask: () => getLatestXuanyuanTask(dataRuntime),
    listXuanyuanHistory: () => listXuanyuanHistory(dataRuntime),
  };
};
