/**
 * workbench-facade.ts — Public API facade for the local workbench.
 *
 * Exposes only allowed methods. Removed:
 *   - getLocalAiRoleControls()
 *   - setLocalAiRoleStartupState()
 *   - deleteCandidate()
 *   - exportCandidateSummaries()
 *   - listRuntimeDebugEvents()
 *   - listRuntimeDebugActions()
 *   - recordCommanderDebugEvent()
 */

import type { OnlineAiProviderPublicStatus } from "../online-ai/index.js";
import type {
  AmazonInvoiceUploadAdminOpenInput,
  AmazonInvoiceUploadAdminOpenResult,
  AmazonInvoiceUploadMissionInput,
  AmazonInvoiceUploadMissionStartResult,
  AmazonInvoiceUploadTaskRecord,
  AmazonInvoiceUploadTaskResumeInput,
  AmazonInvoiceUploadTaskStartInput,
} from "../../plugins/amazon-invoice-upload/index.js";
import type { AppRunLimitSettings, UserRequirementHistoryEntry, UserRequirementHistoryUpsertInput } from "./settings-types.js";
import type { WorkbenchHealthReport, WorkbenchMissionReadinessReport, WorkbenchPreflightResult, WorkbenchPreflightInput } from "./workbench-status-types.js";
import type { WorkbenchCommanderMissionDashboardView } from "./workbench-commander-console.js";

export type WorkbenchFacade = {
  init(): Promise<void>;
  getHealthReport(): Promise<WorkbenchHealthReport>;
  getMissionReadinessReport(): Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight(input: WorkbenchPreflightInput): Promise<WorkbenchPreflightResult>;
  getCommanderConsoleSnapshot(): Promise<WorkbenchCommanderMissionDashboardView>;
  getAppRunLimitSettings(): Promise<AppRunLimitSettings>;
  saveAppRunLimitSettings(input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">): Promise<AppRunLimitSettings>;
  getOnlineAiProviderSettings(): Promise<OnlineAiProviderPublicStatus>;
  saveOnlineAiProviderSettings(input: { displayName?: string | null; apiKey: string; modelName?: string | null }): Promise<OnlineAiProviderPublicStatus>;
  getDataDir(): string;
  getUserRequirementHistory(limit?: number): Promise<UserRequirementHistoryEntry[]>;
  upsertUserRequirementHistory(input: UserRequirementHistoryUpsertInput): Promise<UserRequirementHistoryEntry>;
  deleteUserRequirementHistory(id: string): Promise<void>;
  reuseUserRequirementHistory(id: string): Promise<UserRequirementHistoryEntry | null>;
  openAdminInvoicePage(input: AmazonInvoiceUploadAdminOpenInput): Promise<AmazonInvoiceUploadAdminOpenResult>;
  startAmazonInvoiceUploadMission(input: AmazonInvoiceUploadMissionInput): Promise<AmazonInvoiceUploadMissionStartResult>;
  startAmazonInvoiceUploadTask(input: AmazonInvoiceUploadTaskStartInput): Promise<AmazonInvoiceUploadTaskRecord>;
  resumeAmazonInvoiceUploadTask(input: AmazonInvoiceUploadTaskResumeInput): Promise<AmazonInvoiceUploadTaskRecord>;
  getAmazonInvoiceUploadTaskStatus(taskId: string): Promise<AmazonInvoiceUploadTaskRecord>;
  getModeInfo(): unknown;
};
