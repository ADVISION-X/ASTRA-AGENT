import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasMethodNamed, hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { getSourceFileOrThrow, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  AI_RUNTIME_ADAPTER_PATH,
  COMMAND_HANDLER_PATH,
  LAW_STRUCTURED_LOGGING_COMMAND_FLOW,
  LAW_STRUCTURED_LOGGING_DISCIPLINE,
  LAW_STRUCTURED_LOGGING_EXIT,
  LAW_STRUCTURED_LOGGING_HEALTH,
  STARTUP_ENTRYPOINT_PATH,
  WORKBENCH_PATH,
} = forensicsPersistenceInspectionConstants;

const getStartupSource = (project: import("ts-morph").Project) => {
  const startupPath = pathFromRepoRoot(STARTUP_ENTRYPOINT_PATH);
  return project.addSourceFileAtPathIfExists(startupPath) ?? project.addSourceFileAtPath(startupPath);
};

const collectAiRuntimeWiringFindings = (project: import("ts-morph").Project): Finding[] => {
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const aiRuntimeAdapterSource = getSourceFileOrThrow(project, AI_RUNTIME_ADAPTER_PATH);
  const findings: Finding[] = [];

  if (!hasStringLiteral(aiRuntimeAdapterSource, "AI_REQUEST_DEBUG") || !hasStringLiteral(aiRuntimeAdapterSource, "AI_RESPONSE_DEBUG") || !hasStringLiteral(aiRuntimeAdapterSource, "AI_ERROR_DEBUG") || !hasMethodNamed(workbenchSource, "recordAiDebugEvent")) {
    findings.push(createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: AI_RUNTIME_ADAPTER_PATH, line: 1, severity: "fatal", message: "Structured logging discipline is not wired through the AI runtime and Forensics write path." }));
  }
  if (!hasPropertyAccessPath(workbenchSource, ["this", "forensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent"])) {
    findings.push(createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: WORKBENCH_PATH, line: 1, severity: "fatal", message: "Workbench debug event relays must persist structured runtime events through Forensics Persistence." }));
  }

  return findings;
};

const collectCommandFlowFinding = (project: import("ts-morph").Project): Finding[] => {
  const commandHandlerSource = getSourceFileOrThrow(project, COMMAND_HANDLER_PATH);
  const missingCommandFlowEvents = [
    "HUMAN_COMMAND_DRAFTED",
    "HUMAN_COMMAND_RECEIVED",
    "HUMAN_COMMAND_VALIDATED",
    "MISSION_PREFLIGHT_STARTED",
    "MISSION_PREFLIGHT_PASSED",
    "MISSION_PREFLIGHT_FAILED",
    "COMMAND_ACCEPTED",
    "COMMAND_REJECTED",
  ].filter((eventType) => !hasStringLiteral(commandHandlerSource, eventType));

  return missingCommandFlowEvents.length > 0
    ? [createFinding({ lawId: LAW_STRUCTURED_LOGGING_COMMAND_FLOW, file: COMMAND_HANDLER_PATH, line: 1, severity: "error", message: "Commander command flow is missing required structured debug events.", detail: missingCommandFlowEvents.join(", ") })]
    : [];
};

const hasStartupHealthSignals = (startupSource: import("ts-morph").SourceFile): boolean => {
  return hasStringLiteral(startupSource, "APP_SHELL_HEALTH_CHECK_STARTED")
    && hasStringLiteral(startupSource, "APP_SHELL_HEALTH_PASSED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_CHECK_STARTED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_PASSED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_DEGRADED");
};

const collectHealthFinding = (project: import("ts-morph").Project): Finding[] => {
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const commandHandlerSource = getSourceFileOrThrow(project, COMMAND_HANDLER_PATH);
  const startupSource = getStartupSource(project);
  const healthWired = hasStringLiteral(workbenchSource, "app-shell-health")
    && hasStringLiteral(workbenchSource, "mission-readiness")
    && hasStartupHealthSignals(startupSource)
    && hasStringLiteral(commandHandlerSource, "LOCAL_AI_READINESS_DEGRADED");

  return healthWired
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_HEALTH, file: STARTUP_ENTRYPOINT_PATH, line: 1, severity: "error", message: "AppShellHealth and MissionReadiness structured logging is not fully wired across startup and mission preflight surfaces." })];
};

const collectExitFinding = (project: import("ts-morph").Project): Finding[] => {
  const startupSource = getStartupSource(project);
  const exitWired = hasStringLiteral(startupSource, "SERVICE_SHUTDOWN_REQUESTED")
    && hasStringLiteral(startupSource, "SERVICE_SHUTDOWN_COMPLETED")
    && hasStringLiteral(startupSource, "SERVICE_UNEXPECTED_EXIT")
    && hasStringLiteral(startupSource, "SERVICE_EXIT_CLASSIFICATION");

  return exitWired
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_EXIT, file: STARTUP_ENTRYPOINT_PATH, line: 1, severity: "error", message: "Service shutdown and unexpected-exit structured logging is missing required event classifications or persisted fields." })];
};

export function runForensicsStructuredLogRuntimeChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...collectAiRuntimeWiringFindings(project),
    ...collectCommandFlowFinding(project),
    ...collectHealthFinding(project),
    ...collectExitFinding(project),
  ];
}