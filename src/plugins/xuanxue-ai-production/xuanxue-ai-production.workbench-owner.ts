import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { createXuanxueAiProductionOrder } from "./xuanxue-ai-production.flow.js";
import { XuanxueAiProductionCoordinator } from "./xuanxue-ai-production.scheduler.js";
import { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
import { startXuanxueAiProductionCloudWorker } from "./xuanxue-ai-production-cloud-worker.js";
import type { XuanxueAiProductionCloudWorkerHandle } from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type { XuanxueAiInterventionRequest } from "./xuanxue-ai-production.schema.js";

type XuanxueAiInterventionAction = "pause" | "cancel" | "takeover" | "resume";
type CreateOrderRoute = (
  rawInput: unknown,
  runtime: XuanxueAiProductionRuntime,
) => ReturnType<typeof createXuanxueAiProductionOrder>;

const startOwnerCloudWorker = (input: {
  dataDir: string;
  runtime: XuanxueAiProductionRuntime;
  store: XuanxueAiProductionStore;
  coordinator: XuanxueAiProductionCoordinator;
  aiInputGateway: AiInputGatewayAbilityGroup;
  createOrderRoute: CreateOrderRoute;
}) => startXuanxueAiProductionCloudWorker({
  dataDir: input.dataDir,
  execution: {
    createOrder: (order) => input.createOrderRoute(order, input.runtime),
    executeOrder: (orderId) => input.coordinator.execute(orderId),
    listCloudRecoveryOrders: () => input.store.listCloudRecoveryOrders(),
    repairCompletedCheckpointProviderProofs: () => input.store.repairCompletedCheckpointProviderProofs(
      (proof) => input.aiInputGateway.recoverCheckpointedProviderLease?.(proof) ?? Promise.resolve(null),
    ),
    quarantineForeignCloudRecoveryOrder: (orderId, reason) => input.store.quarantineForeignCloudRecoveryOrder(orderId, reason),
    cancelCloudRecoveryOrder: (orderId, reason) => input.store.cancelCloudRecoveryOrder(orderId, reason),
    availableCapacity: () => input.coordinator.availableCapacity(),
  },
});

export const createXuanxueAiProductionWorkbenchOwner = (
  dataDir: string,
  aiInputGateway: AiInputGatewayAbilityGroup,
  mediaProcessing: MediaProcessingAbilityGroup,
  createOrderRoute: CreateOrderRoute,
) => {
  let worker: XuanxueAiProductionCloudWorkerHandle | null = null;
  let store: XuanxueAiProductionStore | null = null;
  let coordinator: XuanxueAiProductionCoordinator | null = null;
  const interventionRuns = new Set<Promise<unknown>>();
  const requireStore = (): XuanxueAiProductionStore => {
    if (!store) throw new Error("XUANXUE_AI_PRODUCTION_NOT_INITIALIZED");
    return store;
  };
  const requireCoordinator = (): XuanxueAiProductionCoordinator => {
    if (!coordinator) throw new Error("XUANXUE_AI_PRODUCTION_NOT_INITIALIZED");
    return coordinator;
  };
  const scheduleInterventionRun = (orderId: string): void => {
    const run = requireCoordinator().execute(orderId);
    interventionRuns.add(run);
    run.finally(() => interventionRuns.delete(run)).catch(() => undefined);
  };
  return {
    async init() {
      if (store) return;
      store = new XuanxueAiProductionStore(dataDir);
      const runtime: XuanxueAiProductionRuntime = {
        dataDir,
        aiInputGateway,
        mediaProcessing,
        store,
      };
      coordinator = new XuanxueAiProductionCoordinator(runtime);
      if (!process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim()) return;
      worker = await startOwnerCloudWorker({
        dataDir, runtime, store, coordinator, aiInputGateway, createOrderRoute,
      });
    },
    readOrderStatus(orderId: string) {
      const ownerStore = requireStore();
      const order = ownerStore.readOrder(orderId);
      if (!order) return null;
      return {
        order,
        intervention: ownerStore.readIntervention(orderId),
      };
    },
    requestIntervention(action: XuanxueAiInterventionAction, input: XuanxueAiInterventionRequest) {
      const requested = action === "resume"
        ? requireStore().resumeIntervention(input)
        : requireStore().requestIntervention(action, input);
      if (action === "resume") {
        aiInputGateway.resumeProviderTargetAfterOperator?.(`xuanxue-ai-production:${input.orderId}`);
      }
      scheduleInterventionRun(input.orderId);
      return requested;
    },
    async shutdown() {
      await Promise.allSettled([...interventionRuns]);
      await worker?.close();
      worker = null;
      await coordinator?.close();
      coordinator = null;
      store?.close();
      store = null;
    },
  };
};
