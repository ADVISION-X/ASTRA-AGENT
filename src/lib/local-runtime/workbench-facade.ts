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

import type { AppRunLimitSettings, UserRequirementHistoryEntry, UserRequirementHistoryUpsertInput } from "./settings.js";
import type { WorkbenchHealthReport, WorkbenchMissionReadinessReport, WorkbenchPreflightResult, WorkbenchPreflightInput } from "./workbench-status.js";
import type { WorkbenchCommanderMissionDashboardView } from "./workbench-commander-console.js";

export type WorkbenchFacade = {
  init(): Promise<void>;
  getHealthReport(): Promise<WorkbenchHealthReport>;
  getMissionReadinessReport(): Promise<WorkbenchMissionReadinessReport>;
  getMissionStartPreflight(input: WorkbenchPreflightInput): Promise<WorkbenchPreflightResult>;
  getCommanderConsoleSnapshot(): Promise<WorkbenchCommanderMissionDashboardView>;
  getAppRunLimitSettings(): Promise<AppRunLimitSettings>;
  saveAppRunLimitSettings(input: Pick<AppRunLimitSettings, "defaultMaxRounds" | "defaultMaxMinutes">): Promise<AppRunLimitSettings>;
  getDataDir(): string;
  getUserRequirementHistory(limit?: number): Promise<UserRequirementHistoryEntry[]>;
  upsertUserRequirementHistory(input: UserRequirementHistoryUpsertInput): Promise<UserRequirementHistoryEntry>;
  deleteUserRequirementHistory(id: string): Promise<void>;
  reuseUserRequirementHistory(id: string): Promise<UserRequirementHistoryEntry | null>;
  getModeInfo(): unknown;
};
