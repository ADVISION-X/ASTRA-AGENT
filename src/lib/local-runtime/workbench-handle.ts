import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type { AppRunLimitSettings } from "./settings-types.js";
import type {
  WorkbenchHealthReport,
  WorkbenchMissionReadinessReport,
  WorkbenchPreflightInput,
  WorkbenchPreflightResult,
} from "./workbench-status-types.js";
import type {
  XuanxueAiProductionQuarantinedOrder,
  XuanxueAiInterventionRecord,
  XuanxueAiOrderRecord,
} from "../../plugins/xuanxue-ai-production/index.js";

export type GrassEyeWorkbenchHandle = {
  init: () => Promise<void>;
  shutdown: () => Promise<void>;
  recordWorkbenchApiBoundaryEvent: (input: {
    authenticated: boolean;
    decision: "allowed" | "blocked";
    jobOwner?: string | undefined;
    method: string | undefined;
    originCategory: "local-ui" | "external-website" | "unknown";
    path: string;
    reason: string;
    requestId?: string | undefined;
    routePurpose?: string | undefined;
    sourceSystem?: string | undefined;
  }) => void;
  getDataDir: () => string;
  acceptBrowserAuthoritySocket: (input: Readonly<{ send(payload: string): void; close(code?: number): void }>) => Readonly<{ receive(payload: string): void; disconnect(reasonCode?: string, refs?: Readonly<Record<string, string>>): void }>;
  readBrowserAuthorityPairingState: () => Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }>;
  getHealthReport: () => Promise<WorkbenchHealthReport>;
  getMissionReadinessReport: () => Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight: (
    input: WorkbenchPreflightInput,
  ) => Promise<WorkbenchPreflightResult>;
  getModeInfo: () => unknown;
  readXuanxueAiProductionQuarantine: (
    orderId: string,
  ) => XuanxueAiProductionQuarantinedOrder | null;
  readXuanxueAiProductionStatus: (orderId: string) => {
    order: XuanxueAiOrderRecord;
    intervention: XuanxueAiInterventionRecord;
  } | null;
  pauseXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  cancelXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  takeoverXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  resumeXuanxueAiProduction: (
    input: unknown,
  ) => XuanxueAiInterventionRecord;
  getAppRunLimitSettings: () => Promise<AppRunLimitSettings>;
  saveAppRunLimitSettings: (
    input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">,
  ) => Promise<AppRunLimitSettings>;
  getOnlineAiProviderSettings: () => Promise<OnlineAiProviderPublicStatus>;
  saveOnlineAiProviderSettings: (input: {
    displayName?: string | null;
    apiKey: string;
    modelName?: string | null;
  }) => Promise<OnlineAiProviderPublicStatus>;
};
