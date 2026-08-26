import type {
  WorkerState,
  XuanxueAiProductionWorkerHealth,
} from "./xuanxue-ai-production-cloud-worker-contract.js";
import {
  isWorkerContractFailure,
  safeWorkerReason,
  workerErrorCode,
} from "./xuanxue-ai-production-cloud-worker-support.js";

const browserReady = (state: WorkerState): boolean =>
  state.lastRuntimeState.browserAuthorityState === "present"
  && state.lastRuntimeState.browserLaneState !== "blocked";

const executionHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth["executionState"] => {
  if (state.draining) return "draining";
  return state.healthStatus === "ready" && state.ledgerReconciled && browserReady(state) ? "ready" : "blocked";
};

const claimAdmissionHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth["claimAdmissionState"] => {
  if (state.draining) return "draining";
  return state.healthStatus === "ready" && state.ledgerReconciled && browserReady(state) ? "eligible" : "blocked";
};

const currentHealth = (state: WorkerState): XuanxueAiProductionWorkerHealth => ({
  shellState: state.healthStatus === "stopped" ? "stopped" : "ready",
  cloudState: state.healthStatus,
  browserState: browserReady(state) ? "ready" : "blocked",
  executionState: executionHealth(state),
  claimAdmissionState: claimAdmissionHealth(state),
  browserAuthorityState: state.lastRuntimeState.browserAuthorityState,
  browserTargetState: state.lastRuntimeState.browserTargetState,
  browserLaneState: state.lastRuntimeState.browserLaneState,
  contractManifestHash: state.credential.control_manifest_hash,
  activeCount: state.active.size,
  lastSuccessfulHeartbeatAt: state.lastSuccessfulHeartbeatAt,
  lastErrorCode: state.lastErrorCode,
  lastErrorReason: state.lastErrorReason,
  checkedAt: new Date().toISOString(),
});

export const publishHealth = (state: WorkerState): void => state.onStatus?.(currentHealth(state));

export const markWorkerReady = (state: WorkerState): void => {
  state.healthStatus = "ready";
  state.lastErrorCode = null;
  state.lastErrorReason = null;
  publishHealth(state);
};

export const markWorkerError = (state: WorkerState, error: unknown): void => {
  state.healthStatus = isWorkerContractFailure(error) ? "contract_blocked" : "transient_degraded";
  state.lastErrorCode = workerErrorCode(error);
  state.lastErrorReason = safeWorkerReason(error);
  publishHealth(state);
};
