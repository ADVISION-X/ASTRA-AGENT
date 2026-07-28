import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  createXuanxueAiProductionOrder,
  startXuanxueAiProductionCloudWorker,
  XuanxueAiProductionCoordinator,
  XuanxueAiProductionStore,
  type XuanxueAiProductionCloudWorkerHandle,
  type XuanxueAiProductionRuntime,
} from "../../plugins/xuanxue-ai-production/index.js";

export const createWorkbenchXuanxueAiProductionSupport = (
  dataDir: string,
  aiInputGateway: AiInputGatewayAbilityGroup,
) => {
  let worker: XuanxueAiProductionCloudWorkerHandle | null = null;
  let store: XuanxueAiProductionStore | null = null;
  let runtime: XuanxueAiProductionRuntime | null = null;
  let coordinator: XuanxueAiProductionCoordinator | null = null;
  return {
    async init() {
      if (
        !process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim()
        || worker
      ) return;
      store = new XuanxueAiProductionStore(dataDir);
      runtime = { dataDir, aiInputGateway, store };
      coordinator = new XuanxueAiProductionCoordinator(runtime);
      coordinator.resumeRecoverableOrders();
      worker = await startXuanxueAiProductionCloudWorker({
        dataDir,
        execution: {
          createOrder: (input) =>
            createXuanxueAiProductionOrder(runtime!, input),
          executeOrder: (orderId) =>
            coordinator!.execute(orderId),
          availableCapacity: () => coordinator!.availableCapacity(),
        },
      });
    },
    async shutdown() {
      await worker?.close();
      worker = null;
      await coordinator?.close();
      coordinator = null;
      store?.close();
      store = null;
      runtime = null;
    },
  };
};
