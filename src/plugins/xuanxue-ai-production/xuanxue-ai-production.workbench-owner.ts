import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { createXuanxueAiProductionOrder } from "./xuanxue-ai-production.flow.js";
import { XuanxueAiProductionCoordinator } from "./xuanxue-ai-production.scheduler.js";
import { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";
import {
  startXuanxueAiProductionCloudWorker,
  type XuanxueAiProductionWorkerHealth,
} from "./xuanxue-ai-production-cloud-worker.js";
import {
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  type XuanxueAiProductionCloudWorkerHandle,
} from "./xuanxue-ai-production-cloud-contract.js";
import type {
  XuanxueAiBrowserAuthorityPort,
  XuanxueAiBrowserHash,
  XuanxueAiProductionRuntime,
} from "./xuanxue-ai-production.runtime.js";
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
  browserAuthority: XuanxueAiBrowserAuthorityPort;
  onStatus: (status: XuanxueAiProductionWorkerHealth) => void;
}) => startXuanxueAiProductionCloudWorker({
  dataDir: input.dataDir,
  onStatus: input.onStatus,
  execution: {
    createOrder: (order) => input.createOrderRoute(order, input.runtime),
    executeOrder: (orderId, observer, deadlineBudget) =>
      input.coordinator.execute(orderId, observer, deadlineBudget),
    listCloudRecoveryOrders: () => input.store.listCloudRecoveryOrders(),
    availableCapacity: () => input.coordinator.availableCapacity(),
    applyControlIntent: (orderId, intent, controlEpoch, reasonCode) => {
      const current = input.store.readIntervention(orderId);
      input.store.applyCloudControlIntent(
        intent === "cancel_requested" ? "cancel" : intent === "handover_requested" ? "takeover" : "pause",
        {
          orderId,
          expectedRevision: current.revision,
          requestId: `cloud-control:${controlEpoch}`,
          reason: reasonCode ?? intent,
        },
        controlEpoch,
      );
    },
  },
  readBrowserRuntimeState: async () => {
    const browser = input.browserAuthority.readProductionRuntimeState?.() ?? {
      browserAuthorityState: "absent" as const,
      browserTargetState: "absent" as const,
    };
    const browserLaneState = await input.aiInputGateway.getBrowserMutationLaneState?.() ?? "blocked";
    return {
      ...browser,
      browserLaneState,
      browserActionInFlight: browserLaneState === "busy" ? 1 as const : 0 as const,
    };
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
  candidateHash: XuanxueAiBrowserHash;
  dataDir: string;
  aiInputGateway: AiInputGatewayAbilityGroup;
  mediaProcessing: MediaProcessingAbilityGroup;
  createOrderRoute: CreateOrderRoute;
  browserAuthority: XuanxueAiBrowserAuthorityPort;
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
    shellState: "ready",
    cloudState: /(?:CONTRACT|MANIFEST|PRODUCT_CONTRACT)/iu.test(reason)
      ? "contract_blocked"
      : "transient_degraded",
    browserState: "blocked",
    executionState: "blocked",
    claimAdmissionState: "blocked",
    browserAuthorityState: "absent",
    browserTargetState: "absent",
    browserLaneState: "blocked",
    contractManifestHash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    activeCount: 0,
    lastSuccessfulHeartbeatAt: null,
    lastErrorCode: reason.split(":").slice(0, 2).join(":"),
    lastErrorReason: reason.slice(0, 1_000),
    checkedAt: new Date().toISOString(),
  };
};

const initializeOwner = async (dependencies: OwnerDependencies, state: OwnerState): Promise<void> => {
  if (!state.store) {
    state.store = new XuanxueAiProductionStore(dependencies.dataDir);
  }
  const runtime: XuanxueAiProductionRuntime = {
    candidateHash: dependencies.candidateHash,
    dataDir: dependencies.dataDir,
    aiInputGateway: dependencies.aiInputGateway,
    mediaProcessing: dependencies.mediaProcessing,
    store: state.store,
    browserAuthority: dependencies.browserAuthority,
  };
  if (!state.coordinator) {
    state.coordinator = new XuanxueAiProductionCoordinator(runtime);
  }
  if (!process.env.XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL?.trim()) return;
  if (state.worker) return;
  try {
    state.worker = await startOwnerCloudWorker({
      dataDir: dependencies.dataDir,
      runtime,
      store: state.store,
      coordinator: requireCoordinator(state),
      aiInputGateway: dependencies.aiInputGateway,
      createOrderRoute: dependencies.createOrderRoute,
      browserAuthority: dependencies.browserAuthority,
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
  browserAuthority: XuanxueAiBrowserAuthorityPort,
  candidateHash: XuanxueAiBrowserHash,
) => {
  const dependencies = {
    candidateHash,
    dataDir,
    aiInputGateway,
    mediaProcessing,
    createOrderRoute,
    browserAuthority,
  };
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
