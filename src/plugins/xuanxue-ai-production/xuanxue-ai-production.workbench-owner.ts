import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { createXuanxueAiProductionOrder } from "./xuanxue-ai-production.flow.js";
import { XuanxueAiProductionCoordinator } from "./xuanxue-ai-production.scheduler.js";
import { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
import { startXuanxueAiProductionCloudWorker } from "./xuanxue-ai-production-cloud-worker.js";
import type { XuanxueAiProductionCloudWorkerHandle } from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";

export const createXuanxueAiProductionWorkbenchOwner = (
  dataDir: string,
  aiInputGateway: AiInputGatewayAbilityGroup,
  mediaProcessing: MediaProcessingAbilityGroup,
  createOrderRoute: (
    rawInput: unknown,
    runtime: XuanxueAiProductionRuntime,
  ) => ReturnType<typeof createXuanxueAiProductionOrder>,
) => {
  let worker: XuanxueAiProductionCloudWorkerHandle | null = null;
  let store: XuanxueAiProductionStore | null = null;
  let coordinator: XuanxueAiProductionCoordinator | null = null;
  return {
    async init() {
      if (!process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim() || worker) return;
      store = new XuanxueAiProductionStore(dataDir);
      const runtime: XuanxueAiProductionRuntime = {
        dataDir,
        aiInputGateway,
        mediaProcessing,
        store,
      };
      coordinator = new XuanxueAiProductionCoordinator(runtime);
      worker = await startXuanxueAiProductionCloudWorker({
        dataDir,
        execution: {
          createOrder: (input) => createOrderRoute(input, runtime),
          executeOrder: (orderId) => coordinator!.execute(orderId),
          listCloudRecoveryOrders: () => store!.listCloudRecoveryOrders(),
          repairCompletedCheckpointProviderProofs: () =>
            store!.repairCompletedCheckpointProviderProofs(
              (input) => aiInputGateway.recoverCheckpointedProviderLease?.(input)
                ?? Promise.resolve(null),
            ),
          quarantineForeignCloudRecoveryOrder: (orderId, reason) =>
            store!.quarantineForeignCloudRecoveryOrder(orderId, reason),
          cancelCloudRecoveryOrder: (orderId, reason) =>
            store!.cancelCloudRecoveryOrder(orderId, reason),
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
    },
  };
};
