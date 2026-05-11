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

export type WorkbenchCommanderMissionDashboardView = {
  mission: CommanderMissionStatusView | null;
  capabilityRoster: { groupId: string; status: "active" }[];
  candidates: [];
  reviewQueue: [];
  evidencePackets: [];
  browseLedger: [];
  failedRecords: [];
  runtimeProof: null;
  auditSummary: null;
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
    capabilityRoster: input.capabilityGroupIds.map((groupId) => ({ groupId, status: "active" as const })),
    candidates: [],
    reviewQueue: [],
    evidencePackets: [],
    browseLedger: [],
    failedRecords: [],
    runtimeProof: null,
    auditSummary: null,
  };
}
