import type { WorkbenchRuntime } from "./workbench-contract.js";
import { createAuditReadModel } from "./workbench-commander-audit-read-model.js";
import { createCapabilityHealthReadModel } from "./workbench-commander-health-read-model.js";
import { createForensicsReadModel } from "./workbench-commander-forensics-read-model.js";
import { createMissionReadModel, type WorkbenchCommanderMissionSelectionState } from "./workbench-commander-mission-read-model.js";
import { createRuntimeProofReadModel } from "./workbench-commander-runtime-proof-read-model.js";

export const createWorkbenchCommanderDependencies = (
  runtime: WorkbenchRuntime,
  missionSelectionState: WorkbenchCommanderMissionSelectionState,
) => ({
  missionReadModel: createMissionReadModel(runtime, missionSelectionState),
  forensicsReadModel: createForensicsReadModel(runtime),
  capabilityHealthReadModel: createCapabilityHealthReadModel(runtime),
  auditReadModel: createAuditReadModel(),
  runtimeProofReadModel: createRuntimeProofReadModel(runtime),
});