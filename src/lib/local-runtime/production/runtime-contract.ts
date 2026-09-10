import type { ProductionOperationsSnapshot } from "./operations-snapshot.js";
import type { ProductionHash } from "./contracts.js";

export interface ProductionRuntimeHealth {
  readonly shellState: "ready";
  readonly cloudState: "ready" | "contract_blocked" | "transient_degraded" | "stopped";
  readonly browserState: "ready" | "blocked";
  readonly executionState: "ready" | "blocked" | "draining";
  readonly claimAdmissionState: "eligible" | "blocked" | "draining";
  readonly logSinkState: "ready" | "failed" | "capacity_blocked";
  readonly browserAuthorityState: "present" | "absent";
  readonly browserTargetState: "claimed" | "absent";
  readonly browserLaneState: "idle" | "busy" | "blocked";
  readonly controlContractVersion: number | null;
  readonly catalogHash: ProductionHash;
  readonly activeCount: number;
  readonly pendingOutboxCount: number;
  readonly lastSuccessfulHeartbeatAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorReason: string | null;
  readonly checkedAt: string;
}

export interface ProductionRuntimeHandle {
  readonly close: () => Promise<void>;
  readonly readHealth: () => ProductionRuntimeHealth;
  readonly readOperationsSnapshot: (jobId?: string) => Promise<ProductionOperationsSnapshot>;
}
