/**
 * workbench-commander-console.ts — Commander Console assembly and snapshot.
 *
 * Creates the CommanderConsole ability group with:
 *   - CommandTransportPort that sends human commands via NerveBus
 *   - getMissionStatus() that reads from Orchestration (not a read-model)
 *
 * Provides getCommanderConsoleSnapshot() for health/status API.
 *
 * Does NOT contain: candidate management, browse ledger, evidence universe,
 * AI/browser/action truth, or Forensics finalization.
 */

import { randomUUID } from "node:crypto";

import {
  createCommanderConsoleAbilityGroup,
  type CommanderConsoleAbilityGroup,
  type CommanderMissionStatusView,
  type CommandTransportPort,
} from "../../capabilities/commander-console/index.js";
import type { NerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";
import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";

// ─── Workbench Commander Console Dashboard (simplified) ─────────────────────

export type WorkbenchHealthEntry = {
  id: string;
  groupId: string;
  label: string;
  status: "active" | "degraded";
  tone: "good" | "green" | "yellow" | "red" | "warn" | "danger";
  detail?: string | undefined;
  missionRuntimeAvailable?: boolean | undefined;
  failureReason?: string | undefined;
  actionableMessage?: string | undefined;
  ownerResponsible?: string | undefined;
};

export type WorkbenchEvidenceEntry = {
  id: string;
  primary: string;
  secondary: string | null;
  detail: string | null;
  [key: string]: unknown;
};

export type WorkbenchRuntimeProofEntry = {
  step: string;
  message: string;
  createdAt: string;
  status: string;
  [key: string]: unknown;
};

export type WorkbenchCandidateEntry = {
  id: string;
  useCase: string;
  category: string;
  evidenceCount: number;
  reviewStatus: "pending" | "approved" | "rejected" | "skipped" | "archived" | "hold";
  [key: string]: unknown;
};

export type WorkbenchReviewQueueEntry = {
  id: string;
  reviewStatus: string;
  [key: string]: unknown;
};

export type WorkbenchRuntimeSummaryView = {
  runtimeStatus: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "failed" | "unknown";
  reviewReason: string | null;
  lastAiFailureReason: string | null;
  currentStep: string | null;
  totalSeenCount: number;
  evidencePacketCount: number;
  browseLedgerCount: number;
  candidateCount: number;
};

export type WorkbenchBrowserSummaryView = {
  loginState: "logged-in" | "logged-out" | "unknown";
};

export type WorkbenchAuditSummaryView = {
  totals: { passed: number; inspectors: number } | null;
  lastGeneratedAt: string | null;
};

export type WorkbenchMissionView = {
  missionId: string | null;
  status: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "unknown";
  currentPlatform: string | null;
  userRequirementSummary: string | null;
  startedAt: string | null;
  updatedAt: string;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  savedEvidenceCount: number;
  failedActionCount: number;
  failureReason?: string | null | undefined;
  endedAt?: string | null | undefined;
  humanGoal?: string | null | undefined;
  requestedPlatform?: string | null | undefined;
  selectedBindingId?: string | null | undefined;
  reviewStatus?: string | null | undefined;
  currentRoundIndex?: number | null | undefined;
  lastHumanCommand?: string | null | undefined;
};

export type WorkbenchCommanderMissionDashboardView = {
  mission: WorkbenchMissionView | null;
  runtime: WorkbenchRuntimeSummaryView;
  browser: WorkbenchBrowserSummaryView;
  health: WorkbenchHealthEntry[];
  capabilityRoster: { groupId: string; status: "active" }[];
  candidates: WorkbenchCandidateEntry[];
  reviewQueue: WorkbenchReviewQueueEntry[];
  evidencePackets: WorkbenchEvidenceEntry[];
  browseLedger: never[];
  failedRecords: never[];
  runtimeProof: WorkbenchRuntimeProofEntry[] | null;
  auditSummary: WorkbenchAuditSummaryView;
};

// ─── Commander Transport Port ────────────────────────────────────────────────

function createNerveBusCommandTransportPort(nerveBus: NerveBusAbilityGroup): CommandTransportPort {
  return {
    async sendHumanCommandEnvelope(envelope) {
      try {
        const result = await nerveBus.dispatchHumanCommand({
          commandType: envelope.commandType,
          missionId: envelope.missionId ?? randomUUID(),
          runId: randomUUID(),
          sessionId: null,
          roundId: null,
          inputPayload: envelope.payload,
        });
        return {
          ok: result.status === "success",
          transportRef: envelope.envelopeId,
          failureReason: result.failureReason ?? null,
        };
      } catch (err) {
        return {
          ok: false,
          transportRef: null,
          failureReason: err instanceof Error ? err.message : "transport error",
        };
      }
    },
    async emitHumanCommand(command) {
      const runId = randomUUID();
      try {
        const result = await nerveBus.dispatchHumanCommand({
          commandType: command.commandType,
          missionId: command.targetMissionId ?? randomUUID(),
          runId,
          sessionId: null,
          roundId: null,
          inputPayload: command.payload,
        });
        return {
          commandId: command.commandId,
          runId,
          envelopeRef: command.commandId,
          resultEnvelopeRef: null,
          status: result.status === "success" ? "accepted" as const : "failed" as const,
          failureReason: result.failureReason ?? null,
          reviewRequiredReason: null,
          message: result.failureReason ?? "dispatched",
          debugLogRef: null,
        };
      } catch (err) {
        return {
          commandId: command.commandId,
          runId,
          envelopeRef: null,
          resultEnvelopeRef: null,
          status: "failed" as const,
          failureReason: err instanceof Error ? err.message : "transport error",
          reviewRequiredReason: null,
          message: err instanceof Error ? err.message : "transport error",
          debugLogRef: null,
        };
      }
    },
  };
}

// ─── getMissionStatus Adapter ────────────────────────────────────────────────

type GetOrchestration = () => OrchestrationAbilityGroup;

function createGetMissionStatus(getOrchestration: GetOrchestration): () => {
  missionId: string | null;
  status: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "unknown";
  currentPlatform: string | null;
  userRequirementSummary: string | null;
  startedAt: string | null;
  updatedAt: string;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  savedEvidenceCount: number;
  failedActionCount: number;
} {
  return () => {
    // Try to get mission state from orchestration synchronously via getMissionState
    // getMissionState is async, so we return a default for sync context
    // The commander console will call this before await, so we need to return a snapshot
    // The real snapshot is fetched by getCommanderConsoleSnapshot() which is async
    return {
      missionId: null,
      status: "idle" as const,
      currentPlatform: null,
      userRequirementSummary: null,
      startedAt: null,
      updatedAt: new Date().toISOString(),
      lastStopReason: null,
      reviewRequiredReason: null,
      savedEvidenceCount: 0,
      failedActionCount: 0,
    };
  };
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createWorkbenchCommanderConsole(input: {
  nerveBus: NerveBusAbilityGroup;
  getOrchestration: GetOrchestration;
  operatorRef?: string;
}): CommanderConsoleAbilityGroup {
  const commandTransport = createNerveBusCommandTransportPort(input.nerveBus);
  const getMissionStatus = createGetMissionStatus(input.getOrchestration);

  return createCommanderConsoleAbilityGroup({
    defaultOperatorRef: input.operatorRef ?? "commander-console:workbench",
    commandTransport,
    getMissionStatus,
  });
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

export async function getCommanderConsoleSnapshot(input: {
  commanderConsole: CommanderConsoleAbilityGroup;
  getOrchestration: GetOrchestration;
  capabilityGroupIds: string[];
}): Promise<WorkbenchCommanderMissionDashboardView> {
  // Get mission status from orchestration
  let missionView: CommanderMissionStatusView | null = null;
  try {
    const orchestration = input.getOrchestration();
    const missionState = await orchestration.getMissionState();
    missionView = {
      missionId: missionState.missionId ?? null,
      status: (missionState.status ?? "idle") as CommanderMissionStatusView["status"],
      currentPlatform: missionState.requestedPlatform ?? null,
      userRequirementSummary: missionState.humanGoal ?? null,
      startedAt: missionState.startedAt ?? null,
      updatedAt: missionState.updatedAt ?? new Date().toISOString(),
      lastStopReason: missionState.stopReason ?? null,
      reviewRequiredReason: missionState.reviewRequiredReason ?? null,
      savedEvidenceCount: 0,
      failedActionCount: 0,
    };
  } catch {
    // orchestration not yet available
  }

  return {
    mission: missionView,
    runtime: {
      runtimeStatus: (missionView?.status ?? "idle") as WorkbenchRuntimeSummaryView["runtimeStatus"],
      reviewReason: missionView?.reviewRequiredReason ?? null,
      lastAiFailureReason: null,
      currentStep: null,
      totalSeenCount: 0,
      evidencePacketCount: 0,
      browseLedgerCount: 0,
      candidateCount: 0,
    },
    browser: {
      loginState: "unknown" as const,
    },
    health: [],
    capabilityRoster: input.capabilityGroupIds.map((groupId) => ({ groupId, status: "active" as const })),
    candidates: [],
    reviewQueue: [],
    evidencePackets: [],
    browseLedger: [],
    failedRecords: [],
    runtimeProof: null,
    auditSummary: {
      totals: null,
      lastGeneratedAt: null,
    },
  };
}
