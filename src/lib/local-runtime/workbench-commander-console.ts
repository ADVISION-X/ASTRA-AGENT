import {
  createCommanderConsoleAbilityGroup,
  type CommanderConsoleAbilityGroup,
  type CommanderHumanCommandEnvelope,
  type CommanderMissionDashboardView,
} from "../../capabilities/commander-console/index.js";
import type { CapabilityHealthReadModelPort } from "../../capabilities/commander-console/ports/capability-health-read-model-port.js";
import type { CommandTransportPort } from "../../capabilities/commander-console/ports/command-transport-port.js";
import type { CommanderHumanCommand } from "../../capabilities/commander-console/ports/command-transport-port.js";
import type { ForensicsReadModelPort } from "../../capabilities/commander-console/ports/forensics-read-model-port.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { describeHumanCommandTransportMessage, buildHumanCommandDispatchInput } from "./workbench-human-command.js";
import { getHealthReport, getMissionReadinessReport, getModeInfo, listCapabilityRoster } from "./workbench-status.js";
import { readAuditSummary } from "./workbench-runtime-admin.js";

const createCommandTransport = (
  runtime: WorkbenchRuntime,
): CommandTransportPort => ({
  emitHumanCommand: async (command: CommanderHumanCommand) => {
    const transport = await runtime.nerveBusAbilityGroup.dispatchHumanCommand(buildHumanCommandDispatchInput(command));
    const status: "accepted" | "failed" | "review_required" = transport.resultEnvelope.status === "success"
      ? "accepted"
      : transport.resultEnvelope.status;
    return {
      commandId: command.commandId,
      envelopeRef: transport.commandEnvelope.envelopeId,
      resultEnvelopeRef: transport.resultEnvelope.envelopeId,
      status,
      failureReason: transport.resultEnvelope.failureReason,
      reviewRequiredReason: transport.resultEnvelope.status === "review_required" ? transport.resultEnvelope.failureReason ?? "review required" : null,
      message: describeHumanCommandTransportMessage(transport.resultEnvelope),
      debugLogRef: null,
    };
  },
});

const toCommanderReviewStatus = (
  reviewStatus: "approve" | "reject" | "hold" | "pending" | "archived",
): "approved" | "rejected" | "hold" | "pending" | "archived" => {
  if (reviewStatus === "approve") {
    return "approved";
  }
  if (reviewStatus === "reject") {
    return "rejected";
  }
  return reviewStatus;
};

const createMissionReadModel = (runtime: WorkbenchRuntime) => ({
  readMission: async () => {
    const mission = await runtime.orchestrationAbilityGroup.getMissionState();
    const status = mission.status === "pending" ? "idle" : mission.status;
    return {
      missionId: mission.missionId,
      humanGoal: mission.humanGoal ?? "",
      status,
      missionRunRef: mission.activeTaskRunId,
      currentRoundIndex: mission.currentRoundIndex,
      requestedPlatform: mission.requestedPlatform,
      selectedMapId: mission.mapId,
      lastHumanCommand: mission.lastHumanCommand === "submit-review-decision" ? null : mission.lastHumanCommand,
      reviewRequiredReason: mission.reviewRequiredReason ?? null,
      failureReason: mission.failureReason ?? null,
      startedAt: mission.startedAt ?? null,
      updatedAt: mission.updatedAt ?? null,
      endedAt: mission.endedAt ?? null,
    };
  },
});

const createForensicsReadModel = (
  runtime: WorkbenchRuntime,
): ForensicsReadModelPort => ({
  listCandidates: async () => (await runtime.evidenceStore.getOperatorSnapshot()).candidates.map((candidate) => ({ id: candidate.id, category: candidate.category, useCase: candidate.useCase, score: candidate.score, purchaseIntent: candidate.purchaseIntent, reviewStatus: toCommanderReviewStatus(candidate.reviewStatus), evidenceCount: candidate.evidenceRefs.length, notes: candidate.notes, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt })),
  listReviewQueue: async () => (await runtime.evidenceStore.getOperatorSnapshot()).candidates.filter((candidate) => candidate.reviewStatus === "pending" || candidate.reviewStatus === "hold").map((candidate) => ({ id: candidate.id, primary: candidate.category, secondary: candidate.useCase, detail: candidate.reviewStatus })),
  listEvidencePackets: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).evidencePackets.slice(-limit).reverse().map((packet) => ({ id: packet.packetId, primary: packet.roundId, secondary: packet.roundOutcome, detail: packet.candidate.candidateId ?? "no_candidate" })),
  listBrowseLedger: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).browseLedgerEntries.slice(-limit).reverse().map((entry) => ({ id: entry.roundId, primary: entry.videoVisitId, secondary: entry.browseOutcome, detail: entry.productPresenceDecision })),
  listFailedRecords: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).structuredRuntimeEvents.filter((event) => event.status === "failed" || event.status === "review_required").slice(-limit).reverse().map((event) => ({ id: event.eventId, primary: event.eventType, secondary: event.step, detail: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? "runtime failure" })),
  inspectRecordDetail: async (recordId: string) => {
    const state = await runtime.evidenceStore.getOperatorSnapshot();
    const candidate = state.candidates.find((item) => item.id === recordId);
    if (candidate) return { recordType: "candidate" as const, recordId: candidate.id, title: `${candidate.category} / ${candidate.useCase}`, summary: candidate.reviewStatus, details: candidate.notes, status: candidate.reviewStatus, createdAt: candidate.createdAt };
    const packet = state.evidencePackets.find((item) => item.packetId === recordId);
    if (packet) return { recordType: "evidence-packet" as const, recordId: packet.packetId, title: packet.roundId, summary: packet.roundOutcome, details: [packet.candidate.candidateId ?? "no_candidate"], status: packet.roundOutcome, createdAt: packet.capturedAt };
    const ledger = state.browseLedgerEntries.find((item) => item.roundId === recordId);
    if (ledger) return { recordType: "browse-ledger" as const, recordId: ledger.roundId, title: ledger.videoVisitId, summary: ledger.browseOutcome, details: [ledger.productPresenceDecision], status: ledger.browseOutcome, createdAt: ledger.observedAt };
    const runtimeEvent = state.structuredRuntimeEvents.find((item) => item.eventId === recordId);
    if (runtimeEvent) return { recordType: "runtime-event" as const, recordId: runtimeEvent.eventId, title: runtimeEvent.eventType, summary: runtimeEvent.step, details: [runtimeEvent.failureReason ?? runtimeEvent.reviewRequiredReason ?? runtimeEvent.reason ?? runtimeEvent.status], status: runtimeEvent.status, createdAt: runtimeEvent.createdAt };
    return { recordType: "not-found" as const, recordId, title: "Record not found", summary: `No governed record matches ${recordId}`, details: [], status: null, createdAt: null };
  },
});

const createCapabilityHealthReadModel = (
  runtime: WorkbenchRuntime,
): CapabilityHealthReadModelPort => ({
  readRuntimeSummary: async () => {
    const [mission, state] = await Promise.all([runtime.orchestrationAbilityGroup.getMissionState(), runtime.evidenceStore.getOperatorSnapshot()]);
    const runtimeStatus: "idle" | "running" | "paused" | "review_required" | "failed" | "completed" | "stopped" = mission.status === "pending" ? "idle" : mission.status;
    return { runtimeStatus, currentStep: mission.currentStepId ?? null, reviewReason: mission.reviewRequiredReason ?? null, totalSeenCount: state.roundStructuralLogs.length, evidencePacketCount: state.evidencePackets.length, browseLedgerCount: state.browseLedgerEntries.length, candidateCount: state.candidates.length, lastAiFailureReason: mission.failureReason ?? null };
  },
  readBrowserSummary: async () => getModeInfo(runtime),
  listHealthSummaries: async () => {
    const [health, readiness] = await Promise.all([getHealthReport(runtime), getMissionReadinessReport(runtime)]);
    return [{ id: "app-shell", label: "app-shell", tone: health.status === "ready" ? "good" : "danger", detail: health.actionableMessage }, ...readiness.components.map((component) => {
      const tone: "good" | "warn" | "danger" = component.ok ? "good" : component.severity === "warning" ? "warn" : "danger";
      return { id: component.name, label: component.name, tone, detail: component.detail, ownerResponsible: component.ownerResponsible ?? null, actionableMessage: component.actionableMessage ?? null };
    })];
  },
  listCapabilityRoster,
});

const createRuntimeProofReadModel = (runtime: WorkbenchRuntime) => ({
  listRuntimeProofEntries: async (limit = 50) => (await runtime.evidenceStore.getOperatorSnapshot()).structuredRuntimeEvents.slice(-limit).reverse().map((event) => ({ id: event.eventId, createdAt: event.createdAt, step: event.step, status: event.status, message: event.failureReason ?? event.reviewRequiredReason ?? event.reason ?? event.eventType })),
});

export const createWorkbenchCommanderConsole = (
  runtime: WorkbenchRuntime,
): CommanderConsoleAbilityGroup =>
  createCommanderConsoleAbilityGroup({
    defaultOperatorRef: "commander-console:operator",
    commandTransport: createCommandTransport(runtime),
    missionReadModel: createMissionReadModel(runtime),
    forensicsReadModel: createForensicsReadModel(runtime),
    capabilityHealthReadModel: createCapabilityHealthReadModel(runtime),
    auditReadModel: { readAuditSummary },
    runtimeProofReadModel: createRuntimeProofReadModel(runtime),
  });

export const getCommanderConsoleSnapshot = async (
  runtime: WorkbenchRuntime,
): Promise<CommanderMissionDashboardView> => {
  const result = await runtime.commanderConsole.execute({ childCapabilityId: "show-mission-dashboard", operatorRef: "commander-console:shell", input: {} });
  if (result.status !== "success" || result.output === null) {
    throw new Error(result.failureReason ?? result.reviewRequiredReason ?? "Failed to read commander dashboard.");
  }
  return result.output as CommanderMissionDashboardView;
};