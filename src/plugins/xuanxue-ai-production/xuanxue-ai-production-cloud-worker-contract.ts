import type Database from "better-sqlite3";

import type { XuanxueAiOrderRecord } from "./xuanxue-ai-production.schema.js";
import type { XuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-contract.js";
import type { XuanxueAiProductionCloudOutbox } from "./xuanxue-ai-production-cloud-outbox.js";
import type { XuanxueAiProductionExecutionObserver } from "./xuanxue-ai-production.flow.js";
import type { XuanxueAiExecutionDeadlineBudget } from "./xuanxue-ai-production.runtime.js";
import type {
  XuanxueAiProductionRuntimeStateV6,
  XuanxueAiProductionWorkerSessionV6,
} from "./xuanxue-ai-production-worker-session.js";

export interface XuanxueAiProductionExecutionPort {
  createOrder(input: unknown): XuanxueAiOrderRecord;
  executeOrder(
    orderId: string,
    observer?: XuanxueAiProductionExecutionObserver,
    deadlineBudget?: XuanxueAiExecutionDeadlineBudget,
  ): Promise<XuanxueAiOrderRecord>;
  listCloudRecoveryOrders(): XuanxueAiOrderRecord[];
  markAcceptedFailure(
    orderId: string,
    status: "recovery_pending" | "review_required" | "failed",
    reason: string,
  ): XuanxueAiOrderRecord;
  availableCapacity(): number;
  applyControlIntent(
    orderId: string,
    intent: "none" | "pause_requested" | "cancel_requested" | "handover_requested",
    controlEpoch: number,
    reasonCode: string | null,
  ): void;
}

export interface XuanxueAiProductionWorkerHealth {
  readonly shellState: "ready" | "stopped";
  readonly cloudState: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly browserAuthorityState: "present" | "absent";
  readonly browserTargetState: "claimed" | "absent";
  readonly browserLaneState: "idle" | "busy" | "blocked";
  readonly contractManifestHash: `sha256:${string}`;
  readonly activeCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
}

export type CloudWorkerInput = Readonly<{
  dataDir: string;
  execution: XuanxueAiProductionExecutionPort;
  readBrowserRuntimeState: () => Promise<Pick<
    XuanxueAiProductionRuntimeStateV6,
    "browserActionInFlight" | "browserAuthorityState" | "browserTargetState" | "browserLaneState"
  >>;
  onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
}>;

export interface WorkerState {
  readonly abort: AbortController;
  readonly active: Map<string, Promise<void>>;
  readonly activeAbort: Map<string, AbortController>;
  readonly credential: XuanxueAiProductionCloudCredential;
  readonly dataDir: string;
  readonly execution: XuanxueAiProductionExecutionPort;
  readonly reconciledLocalVersions: Map<string, string>;
  readonly session: XuanxueAiProductionWorkerSessionV6;
  readonly outbox: XuanxueAiProductionCloudOutbox;
  readonly database: Database.Database;
  readonly onStatus?: (status: XuanxueAiProductionWorkerHealth) => void;
  lastSuccessfulHeartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorReason: string | null;
  healthStatus: XuanxueAiProductionWorkerHealth["cloudState"];
  lastRuntimeState: XuanxueAiProductionRuntimeStateV6;
  ledgerReconciled: boolean;
  draining: boolean;
  nextPollDelayMs: number;
}
