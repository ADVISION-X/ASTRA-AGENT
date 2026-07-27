import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  createXuanyuanTaskCoordinator,
} from "./xuanyuan.queue.js";
import {
  getLatestXuanyuanTask,
  getXuanyuanTaskStatus,
  listXuanyuanHistory,
} from "./xuanyuan.flow.js";

type XuanyuanWorkbenchRuntime = {
  aiInputGateway: AiInputGatewayAbilityGroup;
  dataDir: string;
};

export const createWorkbenchXuanyuanSupport = (
  assembly: XuanyuanWorkbenchRuntime,
) => {
  const dataRuntime = { dataDir: assembly.dataDir };
  const coordinator = createXuanyuanTaskCoordinator({
    ...dataRuntime,
    aiInputGateway: assembly.aiInputGateway,
  });
  return {
    init: () => coordinator.init(),
    enqueueXuanyuanTask: (input: unknown) => coordinator.enqueue(input),
    getXuanyuanTaskStatus: (taskId: string) =>
      getXuanyuanTaskStatus(dataRuntime, taskId),
    getLatestXuanyuanTask: () => getLatestXuanyuanTask(dataRuntime),
    listXuanyuanHistory: () => listXuanyuanHistory(dataRuntime),
  };
};
