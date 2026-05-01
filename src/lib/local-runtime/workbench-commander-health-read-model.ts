import type { CapabilityHealthReadModelPort } from "../../capabilities/commander-console/ports/capability-health-read-model-port.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { getHealthReport, getMissionReadinessReport, getModeInfo, listCapabilityRoster } from "./workbench-status.js";

export const createCapabilityHealthReadModel = (
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