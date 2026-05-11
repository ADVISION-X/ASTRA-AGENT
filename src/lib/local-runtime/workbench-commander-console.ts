import { createCommanderConsoleAbilityGroup } from "../../capabilities/commander-console/ability-group.js";
import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/shared/commander-view-types.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { createAuditReadModel } from "./workbench-commander-audit-read-model.js";
import { createCapabilityHealthReadModel } from "./workbench-commander-health-read-model.js";
import { createCommandTransport } from "./workbench-commander-command-transport.js";
import { createForensicsReadModel } from "./workbench-commander-forensics-read-model.js";
import { createMissionReadModel } from "./workbench-commander-mission-read-model.js";
import { createRuntimeProofReadModel } from "./workbench-commander-runtime-proof-read-model.js";

type CommanderConsoleAbilityGroup = ReturnType<typeof createCommanderConsoleAbilityGroup>;

type CommanderConsoleFallbackContext = {
  failureReason: string;
  now: string;
  browser: ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>;
};

const buildCommanderConsoleFallbackMissionSection = (context: CommanderConsoleFallbackContext) => ({
  missionId: null,
  humanGoal: "",
  status: "review_required" as const,
  missionRunRef: null,
  currentRoundIndex: 0,
  requestedPlatform: null,
  selectedBindingId: null,
  lastHumanCommand: null,
  reviewRequiredReason: context.failureReason,
  failureReason: null,
  startedAt: null,
  updatedAt: context.now,
  endedAt: null,
});

const buildCommanderConsoleFallbackRuntimeSection = (context: CommanderConsoleFallbackContext) => ({
  runtimeStatus: "review_required" as const,
  currentStep: "show-mission-dashboard",
  reviewReason: context.failureReason,
  totalSeenCount: 0,
  evidencePacketCount: 0,
  browseLedgerCount: 0,
  candidateCount: 0,
  lastAiFailureReason: null,
});

const buildCommanderConsoleFallbackBrowserSection = (context: CommanderConsoleFallbackContext) => ({
  dataMode: "real-platform" as const,
  platformId: "agent-shell",
  platformLabel: "Mission-governed multi-platform agent shell",
  realPlatformConnection: "current local Chrome session",
  browserMode: "current-chrome" as const,
  browserExecutable: context.browser.browserExecutable,
  browserProfileRef: context.browser.browserProfileRef,
  browserProfileStatus: context.browser.profileStatus,
  browserProfileDirectory: context.browser.profileDirectory,
  browserProfileProvisioning: "operator-managed" as const,
  browserProfileVerificationStatus: context.browser.profileVerificationStatus,
  browserProfileVerificationReason: context.browser.profileVerificationReason ?? "dashboard fallback is serving current browser session metadata",
  loginState: context.browser.loginState,
  lastLoginCheckAt: context.browser.lastLoginCheckAt,
  loginRequiredReason: context.browser.loginRequiredReason,
  reviewRequiredReason: context.browser.reviewRequiredReason,
  storeScope: "local phase-04 enforcement store",
  executionMode: "dashboard degraded fallback",
  fallbackMode: "read-model timeout fallback",
  geometryGuard: "capability-owned at execution time",
  viewport: "not_available_in_dashboard_fallback",
  calibration: "not_applicable",
  orientation: "capability-owned",
});

const buildCommanderConsoleFallbackHealthSection = (context: CommanderConsoleFallbackContext) => ([{
  id: "commander-dashboard",
  label: "Commander Dashboard",
  tone: "warn" as const,
  detail: "Dashboard read model timed out; serving fallback shell so startup stays alive.",
  ownerResponsible: "Commander Console",
  actionableMessage: "Inspect read-model latency and state size; app shell remains available.",
  failureReason: context.failureReason,
  missionRuntimeAvailable: false,
  checkedAt: context.now,
}]);

const buildCommanderConsoleFallbackRuntimeProofSection = (context: CommanderConsoleFallbackContext) => ([{
  id: "commander-dashboard:fallback",
  createdAt: context.now,
  step: "show-mission-dashboard",
  status: "review_required" as const,
  message: context.failureReason,
}]);

const buildCommanderConsoleFallbackAuditSummarySection = () => ({
  phase: "unknown",
  activeLawDomains: [],
  lastGeneratedAt: null,
  lastRunGeneratedAt: null,
  totals: null,
});

const buildFallbackCommanderConsoleSnapshot = (
  runtime: WorkbenchRuntime,
  failureReason: string,
): CommanderMissionDashboardView => {
  const context = {
    failureReason,
    now: new Date().toISOString(),
    browser: runtime.browserController.getSessionState(),
  };
  return {
    mission: buildCommanderConsoleFallbackMissionSection(context),
    runtime: buildCommanderConsoleFallbackRuntimeSection(context),
    browser: buildCommanderConsoleFallbackBrowserSection(context),
    health: buildCommanderConsoleFallbackHealthSection(context),
    capabilityRoster: [],
    candidates: [],
    reviewQueue: [],
    evidencePackets: [],
    browseLedger: [],
    failedRecords: [],
    runtimeProof: buildCommanderConsoleFallbackRuntimeProofSection(context),
    auditSummary: buildCommanderConsoleFallbackAuditSummarySection(),
  };
};

export const createWorkbenchCommanderConsole = (
  runtime: WorkbenchRuntime,
): CommanderConsoleAbilityGroup => {
  const missionSelectionState = { lastMissionId: null };
  return createCommanderConsoleAbilityGroup({
    defaultOperatorRef: "commander-console:operator",
    commandTransport: createCommandTransport(runtime, missionSelectionState),
    missionReadModel: createMissionReadModel(runtime, missionSelectionState),
    forensicsReadModel: createForensicsReadModel(runtime),
    capabilityHealthReadModel: createCapabilityHealthReadModel(runtime),
    auditReadModel: createAuditReadModel(),
    runtimeProofReadModel: createRuntimeProofReadModel(runtime),
  });
};

export const getCommanderConsoleSnapshot = async (
  runtime: WorkbenchRuntime,
): Promise<CommanderMissionDashboardView> => {
  const result = await runtime.commanderConsole.execute({ childCapabilityId: "show-mission-dashboard", operatorRef: "commander-console:shell", input: {} });
  if (result.status !== "success" || result.output === null) {
    return buildFallbackCommanderConsoleSnapshot(runtime, result.failureReason ?? result.reviewRequiredReason ?? "Failed to read commander dashboard.");
  }
  return result.output as CommanderMissionDashboardView;
};
