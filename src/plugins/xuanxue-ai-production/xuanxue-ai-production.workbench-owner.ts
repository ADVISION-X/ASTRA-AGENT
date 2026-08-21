import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { createXuanxueAiProductionOrder } from "./xuanxue-ai-production.flow.js";
import { XuanxueAiProductionCoordinator } from "./xuanxue-ai-production.scheduler.js";
import { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
import {
  startXuanxueAiProductionCloudWorker,
  type XuanxueAiProductionWorkerHealth,
} from "./xuanxue-ai-production-cloud-worker.js";
import type { XuanxueAiProductionCloudWorkerHandle } from "./xuanxue-ai-production-cloud-contract.js";
import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
} from "./xuanxue-ai-production-localization-contract.js";
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
  onStatus: (status: XuanxueAiProductionWorkerHealth) => void;
}) => startXuanxueAiProductionCloudWorker({
  dataDir: input.dataDir,
  onStatus: input.onStatus,
  execution: {
    createOrder: (order) => input.createOrderRoute(order, input.runtime),
    executeOrder: (orderId, observer) =>
      input.coordinator.execute(orderId, observer),
    listCloudRecoveryOrders: () => input.store.listCloudRecoveryOrders(),
    repairCompletedCheckpointProviderProofs: () => input.store.repairCompletedCheckpointProviderProofs(
      (proof) => input.aiInputGateway.recoverCheckpointedProviderLease?.(proof) ?? Promise.resolve(null),
    ),
    quarantineForeignCloudRecoveryOrder: (orderId, reason) => input.store.quarantineForeignCloudRecoveryOrder(orderId, reason),
    cancelCloudRecoveryOrder: (orderId, reason) => input.store.cancelCloudRecoveryOrder(orderId, reason),
    availableCapacity: () => input.coordinator.availableCapacity(),
  },
});

type OwnerState = {
  worker: XuanxueAiProductionCloudWorkerHandle | null;
  workerHealth: XuanxueAiProductionWorkerHealth | null;
  store: XuanxueAiProductionStore | null;
  coordinator: XuanxueAiProductionCoordinator | null;
  interventionRuns: Set<Promise<unknown>>;
};

type OwnerDependencies = {
  dataDir: string;
  aiInputGateway: AiInputGatewayAbilityGroup;
  mediaProcessing: MediaProcessingAbilityGroup;
  createOrderRoute: CreateOrderRoute;
};

const requireStore = (state: OwnerState): XuanxueAiProductionStore => {
  if (!state.store) throw new Error("XUANXUE_AI_PRODUCTION_NOT_INITIALIZED");
  return state.store;
};

const requireCoordinator = (state: OwnerState): XuanxueAiProductionCoordinator => {
  if (!state.coordinator) throw new Error("XUANXUE_AI_PRODUCTION_NOT_INITIALIZED");
  return state.coordinator;
};

const scheduleInterventionRun = (state: OwnerState, orderId: string): void => {
  const run = requireCoordinator(state).execute(orderId);
  state.interventionRuns.add(run);
  run.finally(() => state.interventionRuns.delete(run)).catch(() => undefined);
};

const startupFailureHealth = (error: unknown): XuanxueAiProductionWorkerHealth => {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    status: /(?:CONTRACT|MANIFEST|PRODUCT_CONTRACT)/iu.test(reason)
      ? "contract_blocked"
      : "transient_degraded",
    contractManifestHash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
    activeCount: 0,
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: reason.split(":").slice(0, 2).join(":"),
    lastErrorReason: reason.slice(0, 1_000),
    checkedAt: new Date().toISOString(),
  };
};

const initializeOwner = async (dependencies: OwnerDependencies, state: OwnerState): Promise<void> => {
  if (state.store) return;
  state.store = new XuanxueAiProductionStore(dependencies.dataDir);
  const runtime: XuanxueAiProductionRuntime = {
    dataDir: dependencies.dataDir,
    aiInputGateway: dependencies.aiInputGateway,
    mediaProcessing: dependencies.mediaProcessing,
    store: state.store,
  };
  state.coordinator = new XuanxueAiProductionCoordinator(runtime);
  if (!process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim()) return;
  try {
    state.worker = await startOwnerCloudWorker({
      dataDir: dependencies.dataDir,
      runtime,
      store: state.store,
      coordinator: state.coordinator,
      aiInputGateway: dependencies.aiInputGateway,
      createOrderRoute: dependencies.createOrderRoute,
      onStatus: (status) => {
        state.workerHealth = status;
      },
    });
  } catch (error) {
    state.workerHealth = startupFailureHealth(error);
    throw error;
  }
};

const requestOwnerIntervention = (
  dependencies: OwnerDependencies,
  state: OwnerState,
  action: XuanxueAiInterventionAction,
  input: XuanxueAiInterventionRequest,
) => {
  const requested = action === "resume"
    ? requireStore(state).resumeIntervention(input)
    : requireStore(state).requestIntervention(action, input);
  if (action === "resume") {
    dependencies.aiInputGateway.resumeProviderTargetAfterOperator?.(
      `xuanxue-ai-production:${input.orderId}`,
    );
  }
  scheduleInterventionRun(state, input.orderId);
  return requested;
};

const shutdownOwner = async (state: OwnerState): Promise<void> => {
  await Promise.allSettled([...state.interventionRuns]);
  await state.worker?.close();
  state.worker = null;
  await state.coordinator?.close();
  state.coordinator = null;
  state.store?.close();
  state.store = null;
};

export const createXuanxueAiProductionWorkbenchOwner = (
  dataDir: string,
  aiInputGateway: AiInputGatewayAbilityGroup,
  mediaProcessing: MediaProcessingAbilityGroup,
  createOrderRoute: CreateOrderRoute,
) => {
  const dependencies = { dataDir, aiInputGateway, mediaProcessing, createOrderRoute };
  const state: OwnerState = {
    worker: null,
    workerHealth: null,
    store: null,
    coordinator: null,
    interventionRuns: new Set(),
  };
  return {
    init: () => initializeOwner(dependencies, state),
    readProductionHealth: () => state.workerHealth,
    readQuarantinedOrderStatus: (orderId: string) =>
      requireStore(state).readQuarantinedOrder(orderId),
    readOrderStatus(orderId: string) {
      const ownerStore = requireStore(state);
      const order = ownerStore.readOrder(orderId);
      if (!order) return null;
      return {
        order,
        intervention: ownerStore.readIntervention(orderId),
      };
    },
    requestIntervention(action: XuanxueAiInterventionAction, input: XuanxueAiInterventionRequest) {
      return requestOwnerIntervention(dependencies, state, action, input);
    },
    shutdown: () => shutdownOwner(state),
  };
};
