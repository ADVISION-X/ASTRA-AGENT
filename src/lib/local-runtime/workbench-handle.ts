import type { AppRunLimitSettings } from "./settings-types.js";
import type {
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightInput,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";
import type { StoredProductionTask } from "./production/store.js";
import type { RuntimeDiagnosis } from "../runtime-logs/index.js";

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  shutdown: () => Promise<void>;
  recordWorkbenchApiBoundaryEvent: (input: {
    authenticated: boolean;
    decision: "allowed" | "blocked";
    jobOwner?: string | undefined;
    method: string | undefined;
    originCategory: "local-ui" | "local-extension" | "external-website" | "unknown";
    path: string;
    reason: string;
    requestId?: string | undefined;
    routePurpose?: string | undefined;
    sourceSystem?: string | undefined;
  }) => void;
  getDataDir: () => string;
  acceptBrowserAuthoritySocket: (input: Readonly<{ send(payload: string): void; close(code?: number): void }>) => Readonly<{ receive(payload: string): void; disconnect(reasonCode?: string, refs?: Readonly<Record<string, string>>): void }>;
  readBrowserAuthorityPairingState: () => Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }>;
  readBrowserExtensionBootstrapState: () => Readonly<{
    authority: "present" | "absent";
    pairingSecret: string | null;
    releaseBuildId: string | null;
  }>;
  getHealthReport: () => Promise<WorkbenchHealthReport>;
  getMissionReadinessReport: () => Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight: (
    input: WorkbenchPreflightInput,
  ) => Promise<WorkbenchPreflightResult>;
  getModeInfo: () => unknown;
  readProductionTaskStatus: (jobId: string) => StoredProductionTask | null;
  diagnoseProductionRuntime: (jobId: string) => RuntimeDiagnosis;
  getAppRunLimitSettings: () => Promise<AppRunLimitSettings>;
  saveAppRunLimitSettings: (
    input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
  ) => Promise<AppRunLimitSettings>;
};
