import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { createXuanxueAiProductionOrder } from "./xuanxue-ai-production.flow.js";
import { XuanxueAiProductionCoordinator } from "./xuanxue-ai-production.scheduler.js";
import { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
import { startXuanxueAiProductionCloudWorker } from "./xuanxue-ai-production-cloud-worker.js";
import type { XuanxueAiProductionCloudWorkerHandle } from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type { XuanxueAiInterventionRequest } from "./xuanxue-ai-production.schema.js";
import { runXuanxueProviderInputPreflight } from "./xuanxue-ai-production-provider-input-preflight.js";

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

type OwnerState = {
  worker: XuanxueAiProductionCloudWorkerHandle | null;
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
  state.worker = await startOwnerCloudWorker({
    dataDir: dependencies.dataDir,
    runtime,
    store: state.store,
    coordinator: state.coordinator,
    aiInputGateway: dependencies.aiInputGateway,
    createOrderRoute: dependencies.createOrderRoute,
  });
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
    store: null,
    coordinator: null,
    interventionRuns: new Set(),
  };
  return {
    init: () => initializeOwner(dependencies, state),
    readOrderStatus(orderId: string) {
      const ownerStore = requireStore(state);
      const order = ownerStore.readOrder(orderId);
      if (!order) return null;
      return {
        order,
        intervention: ownerStore.readIntervention(orderId),
      };
    },
    preflightProviderInputs(rawInput: unknown) {
      return runXuanxueProviderInputPreflight({ rawInput, aiInputGateway });
    },
    requestIntervention(action: XuanxueAiInterventionAction, input: XuanxueAiInterventionRequest) {
      return requestOwnerIntervention(dependencies, state, action, input);
    },
    shutdown: () => shutdownOwner(state),
  };
};
