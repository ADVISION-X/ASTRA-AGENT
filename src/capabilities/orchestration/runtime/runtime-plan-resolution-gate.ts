import type { MissionCommand, RuntimePlan } from "../contract.js";
import type { ActiveRuntimePlanRecord, OrchestrationRuntimePlanStorePort } from "../ports/orchestration-runtime-plan-store-port.js";

export type RuntimePlanSource =
  | "preferred_runtime_plan"
  | "rejected_missing";

export type RuntimePlanResolutionResult =
  | { selected: true; map: RuntimePlan; record: ActiveRuntimePlanRecord; runtimePlanSource: Exclude<RuntimePlanSource, "rejected_missing"> }
  | { selected: false; runtimePlanSource: "rejected_missing"; failureReason: string };

export async function resolveRuntimePlan(input: {
  command: MissionCommand;
  mapStore: OrchestrationRuntimePlanStorePort;
}): Promise<RuntimePlanResolutionResult> {
  void input.command;
  void input.mapStore;

  return {
    selected: false,
    runtimePlanSource: "rejected_missing",
    failureReason: "Retired pre-visual-mission resolution is blocked. Mission start must be prepared from userRequirementText, selectedPlatforms, and governed visual mission contracts before runtime execution.",
  };
}