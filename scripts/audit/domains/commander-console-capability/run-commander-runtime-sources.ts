import type { Project, SourceFile } from "ts-morph";

import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";

const { ABILITY_GROUP_PATH, BOUNDARY_POLICY_PATH, CHILD_EXECUTORS_PATH, COMMAND_CHILD_EXECUTOR_PATH, COMMAND_GATE_PATH, COMMAND_OUTCOMES_PATH, COMMAND_PAYLOAD_PATH, DISPATCH_FAILURE_PATH, EXECUTOR_PATH, IDEMPOTENCY_GATE_PATH, PROOF_BUILDER_PATH } = commanderConsoleInspectionConstants;
const { READ_CHILD_EXECUTOR_PATH, READ_GATE_PATH, READ_PROOF_GATE_PATH, RESULT_BUILDER_PATH, RUNTIME_PROOF_SCHEMA_PATH, TASK_START_DISPATCH_RESULT_PATH, TIMEOUT_GATE_PATH, TRANSPORT_SCHEMA_PATH, TRANSPORT_SEMANTIC_GATE_PATH, WORKBENCH_COMMANDER_DEBUG_PATH } = commanderConsoleInspectionConstants;

export const WORKBENCH_HUMAN_COMMAND_PATH = "src/lib/local-runtime/workbench-human-command-start-mission.ts";
const TASK_START_SUPPORT_PATH = "src/lib/local-app-shell/task-start-support.ts";
const COMMANDER_COMMAND_TRANSPORT_PATH = "src/lib/local-runtime/workbench-commander-command-transport.ts";

export type CommanderRuntimeSources = {
  abilityGroupSource: SourceFile;
  commandGateSource: SourceFile;
  commandPayloadSource: SourceFile;
  readGateSource: SourceFile;
  transportSchemaSource: SourceFile;
  commandChildExecutorSource: SourceFile;
  commandOutcomesSource: SourceFile;
  readChildExecutorSource: SourceFile;
  executorSource: SourceFile;
  resultBuilderSource: SourceFile;
  proofBuilderSource: SourceFile;
  runtimeProofSchemaSource: SourceFile;
  dispatchFailureSource: SourceFile;
  boundaryPolicySource: SourceFile;
  childExecutorsSource: SourceFile;
  timeoutGateSource: SourceFile;
  idempotencyGateSource: SourceFile;
  transportSemanticGateSource: SourceFile;
  readProofGateSource: SourceFile;
  workbenchDebugSource: SourceFile;
  taskStartDispatchResultSource: SourceFile;
  taskStartSupportSource: SourceFile;
  acceptedBoundarySource: SourceFile;
  commanderCommandTransportSource: SourceFile;
  humanCommandSource: SourceFile;
};

export const getCommanderRuntimeSources = (project: Project): CommanderRuntimeSources => ({
  abilityGroupSource: getSourceFileOrThrow(project, ABILITY_GROUP_PATH),
  commandGateSource: getSourceFileOrThrow(project, COMMAND_GATE_PATH),
  commandPayloadSource: getSourceFileOrThrow(project, COMMAND_PAYLOAD_PATH),
  readGateSource: getSourceFileOrThrow(project, READ_GATE_PATH),
  transportSchemaSource: getSourceFileOrThrow(project, TRANSPORT_SCHEMA_PATH),
  commandChildExecutorSource: getSourceFileOrThrow(project, COMMAND_CHILD_EXECUTOR_PATH),
  commandOutcomesSource: getSourceFileOrThrow(project, COMMAND_OUTCOMES_PATH),
  readChildExecutorSource: getSourceFileOrThrow(project, READ_CHILD_EXECUTOR_PATH),
  executorSource: getSourceFileOrThrow(project, EXECUTOR_PATH),
  resultBuilderSource: getSourceFileOrThrow(project, RESULT_BUILDER_PATH),
  proofBuilderSource: getSourceFileOrThrow(project, PROOF_BUILDER_PATH),
  runtimeProofSchemaSource: getSourceFileOrThrow(project, RUNTIME_PROOF_SCHEMA_PATH),
  dispatchFailureSource: getSourceFileOrThrow(project, DISPATCH_FAILURE_PATH),
  boundaryPolicySource: getSourceFileOrThrow(project, BOUNDARY_POLICY_PATH),
  childExecutorsSource: getSourceFileOrThrow(project, CHILD_EXECUTORS_PATH),
  timeoutGateSource: getSourceFileOrThrow(project, TIMEOUT_GATE_PATH),
  idempotencyGateSource: getSourceFileOrThrow(project, IDEMPOTENCY_GATE_PATH),
  transportSemanticGateSource: getSourceFileOrThrow(project, TRANSPORT_SEMANTIC_GATE_PATH),
  readProofGateSource: getSourceFileOrThrow(project, READ_PROOF_GATE_PATH),
  workbenchDebugSource: getSourceFileOrThrow(project, WORKBENCH_COMMANDER_DEBUG_PATH),
  taskStartDispatchResultSource: getSourceFileOrThrow(project, TASK_START_DISPATCH_RESULT_PATH),
  taskStartSupportSource: getSourceFileOrThrow(project, TASK_START_SUPPORT_PATH),
  acceptedBoundarySource: getSourceFileOrThrow(project, "src/lib/local-runtime/workbench-human-command-debug-events.ts"),
  commanderCommandTransportSource: getSourceFileOrThrow(project, COMMANDER_COMMAND_TRANSPORT_PATH),
  humanCommandSource: getSourceFileOrThrow(project, WORKBENCH_HUMAN_COMMAND_PATH),
});
