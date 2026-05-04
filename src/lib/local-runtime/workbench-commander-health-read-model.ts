import type { WorkbenchRuntime } from "./workbench-contract.js";
import { getHealthReport, getMissionReadinessReport, getModeInfo, listCapabilityRoster } from "./workbench-status.js";

const createStartupReadinessEntry = (runtime: WorkbenchRuntime) => {
  const startupReadiness = runtime.options.startupReadiness;
  if (!startupReadiness) {
    return {
      id: "startup-readiness",
      label: "startup-readiness",
      tone: "warn" as const,
      detail: `startup readiness context missing; platformTarget=${runtime.options.platformTarget}`,
      ownerResponsible: "Startup Entrypoint / Commander Console",
      actionableMessage: "Launch the workbench through grasseye:start with an explicit platform target.",
      failureReason: null,
      missionRuntimeAvailable: false,
      checkedAt: null,
    };
  }

  return {
    id: "startup-readiness",
    label: "startup-readiness",
    tone: startupReadiness.missionRuntimeAvailable ? "good" as const : "danger" as const,
    detail: `status=${startupReadiness.status}; platformTarget=${startupReadiness.platformTarget}; ${startupReadiness.detail}`,
    ownerResponsible: "Startup Entrypoint / AI Capability / Commander Console",
    actionableMessage: startupReadiness.missionRuntimeAvailable
      ? "Startup gate passed before Commander Console opened mission runtime."
      : "Repair startup readiness and relaunch through grasseye:start.",
    failureReason: startupReadiness.failureReason,
    missionRuntimeAvailable: startupReadiness.missionRuntimeAvailable,
    checkedAt: startupReadiness.checkedAt,
  };
};

export const createCapabilityHealthReadModel = (
  runtime: WorkbenchRuntime,
 ) => ({
  readRuntimeSummary: async () => {
    const [mission, state] = await Promise.all([runtime.orchestrationAbilityGroup.getMissionState(), runtime.evidenceStore.getOperatorSnapshot()]);
    const runtimeStatus: "idle" | "running" | "paused" | "review_required" | "failed" | "completed" | "stopped" = mission.status === "pending" ? "idle" : mission.status;
    return { runtimeStatus, currentStep: mission.currentStepId ?? null, reviewReason: mission.reviewRequiredReason ?? null, totalSeenCount: state.roundStructuralLogs.length, evidencePacketCount: state.evidencePackets.length, browseLedgerCount: state.browseLedgerEntries.length, candidateCount: state.candidates.length, lastAiFailureReason: mission.failureReason ?? null };
  },
  readBrowserSummary: async () => getModeInfo(runtime),
  listHealthSummaries: async () => {
    const [health, readiness] = await Promise.all([getHealthReport(runtime), getMissionReadinessReport(runtime)]);
    const appShellTone: "good" | "danger" = health.status === "ready" ? "good" : "danger";
    return [
      { id: "app-shell", label: "app-shell", tone: appShellTone, detail: health.actionableMessage, ownerResponsible: null, actionableMessage: health.actionableMessage, failureReason: null, missionRuntimeAvailable: undefined, checkedAt: health.generatedAt },
      createStartupReadinessEntry(runtime),
      ...readiness.components.map((component) => {
      const tone: "good" | "warn" | "danger" = component.ok ? "good" : component.severity === "warning" ? "warn" : "danger";
      return {
        id: component.name,
        label: component.name,
        tone,
        detail: component.detail,
        ownerResponsible: component.ownerResponsible ?? null,
        actionableMessage: component.actionableMessage ?? null,
        failureReason: component.ok ? null : component.detail,
        missionRuntimeAvailable: component.name === "localAi" ? readiness.status === "ready" : undefined,
        checkedAt: readiness.generatedAt,
      };
    })];
  },
  listCapabilityRoster,
});