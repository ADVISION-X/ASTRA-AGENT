import { createOrchestrationAbilityGroup } from "../../capabilities/orchestration/ability-group.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/contract.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";

export const createWorkbenchOrchestration = (runtime: WorkbenchRuntime) =>
  createOrchestrationAbilityGroup({
    nerveBus: runtime.nerveBusAbilityGroup,
    forensics: runtime.forensicsPersistenceAbilityGroup as ForensicsPersistenceAbilityGroup,
  });