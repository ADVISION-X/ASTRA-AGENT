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

const buildFallbackCommanderConsoleSnapshot = (
  runtime: WorkbenchRuntime,
  failureReason: string,
): CommanderMissionDashboardView => {
  const browser = runtime.browserController.getSessionState();
  const now = new Date().toISOString();
  return {
    mission: {
      missionId: null,
      humanGoal: "",
      status: "review_required",
      missionRunRef: null,
      currentRoundIndex: 0,
      requestedPlatform: null,
      selectedMapId: null,
      lastHumanCommand: null,
      reviewRequiredReason: failureReason,
      failureReason: null,
      startedAt: null,
      updatedAt: now,
      endedAt: null,
    },
    runtime: {
      runtimeStatus: "review_required",
      currentStep: "show-mission-dashboard",
      reviewReason: failureReason,
      totalSeenCount: 0,
      evidencePacketCount: 0,
      browseLedgerCount: 0,
      candidateCount: 0,
      lastAiFailureReason: null,
    },
    browser: {
      dataMode: "real-platform",
      platformId: "agent-shell",
      platformLabel: "Mission-governed multi-platform agent shell",
      realPlatformConnection: "current local Chrome session",
      browserMode: "current-chrome",
      browserExecutable: browser.browserExecutable,
      browserProfileRef: browser.browserProfileRef,
      browserProfileStatus: browser.profileStatus,
      browserProfileDirectory: browser.profileDirectory,
      browserProfileProvisioning: "operator-managed",
      browserProfileVerificationStatus: browser.profileVerificationStatus,
      browserProfileVerificationReason: browser.profileVerificationReason ?? "dashboard fallback is serving current browser session metadata",
      loginState: browser.loginState,
      lastLoginCheckAt: browser.lastLoginCheckAt,
      loginRequiredReason: browser.loginRequiredReason,
      reviewRequiredReason: browser.reviewRequiredReason,
      storeScope: "local phase-04 enforcement store",
      executionMode: "dashboard degraded fallback",
      fallbackMode: "read-model timeout fallback",
      geometryGuard: "capability-owned at execution time",
      viewport: "not_available_in_dashboard_fallback",
      calibration: "not_applicable",
      orientation: "capability-owned",
    },
    health: [{
      id: "commander-dashboard",
      label: "Commander Dashboard",
      tone: "warn",
      detail: "Dashboard read model timed out; serving fallback shell so startup stays alive.",
      ownerResponsible: "Commander Console",
      actionableMessage: "Inspect read-model latency and state size; app shell remains available.",
      failureReason,
      missionRuntimeAvailable: false,
      checkedAt: now,
    }],
    capabilityRoster: [],
    candidates: [],
    reviewQueue: [],
    evidencePackets: [],
    browseLedger: [],
    failedRecords: [],
    runtimeProof: [{
      id: "commander-dashboard:fallback",
      createdAt: now,
      step: "show-mission-dashboard",
      status: "review_required",
      message: failureReason,
    }],
    auditSummary: {
      phase: "unknown",
      activeLawDomains: [],
      lastGeneratedAt: null,
      lastRunGeneratedAt: null,
      totals: null,
    },
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
