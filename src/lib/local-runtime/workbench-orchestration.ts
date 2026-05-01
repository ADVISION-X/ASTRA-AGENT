import { createOrchestrationAbilityGroup } from "../../capabilities/orchestration/ability-group.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";

export const createWorkbenchOrchestration = (runtime: WorkbenchRuntime) =>
  createOrchestrationAbilityGroup({ nerveBus: runtime.nerveBusAbilityGroup });