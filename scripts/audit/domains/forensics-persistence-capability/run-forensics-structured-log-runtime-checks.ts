import { pathFromRepoRoot } from "../../core/paths.js";
import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { flattenPropertyAccess, getSourceFileOrThrow, hasCallExpression, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  ABILITY_GROUP_PATH,
  AI_DEBUG_RECORDER_PATH,
  AI_RUNTIME_ADAPTER_PATH,
  COMMAND_HANDLER_PATH,
  COMMAND_FLOW_RESULT_PATH,
  COMMANDER_DEBUG_PATH,
  LAW_STRUCTURED_LOGGING_COMMAND_FLOW,
  LAW_STRUCTURED_LOGGING_DISCIPLINE,
  LAW_STRUCTURED_LOGGING_EXIT,
  LAW_STRUCTURED_LOGGING_HEALTH,
  STARTUP_ENTRYPOINT_PATH,
  TERMINAL_STRUCTURED_LOG_PATH,
  STRUCTURED_LOG_PAYLOAD_PATH,
  STATUS_PATH,
  WORKBENCH_PATH,
} = forensicsPersistenceInspectionConstants;
const WRITE_BOUNDARY_EVENTS_PATH = "src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts";

const getStartupSource = (project: import("ts-morph").Project) => {
  const startupPath = pathFromRepoRoot(STARTUP_ENTRYPOINT_PATH);
  return project.addSourceFileAtPathIfExists(startupPath) ?? project.addSourceFileAtPath(startupPath);
};

const getScriptSource = (project: import("ts-morph").Project, repoRelativePath: string) => {
  const scriptPath = pathFromRepoRoot(repoRelativePath);
  return project.addSourceFileAtPathIfExists(scriptPath) ?? project.addSourceFileAtPath(scriptPath);
};

const collectAiRuntimeWiringFindings = (project: import("ts-morph").Project): Finding[] => {
  const aiDebugRecorderSource = getSourceFileOrThrow(project, AI_DEBUG_RECORDER_PATH);
  const aiRuntimeDebugSource = getSourceFileOrThrow(project, AI_RUNTIME_ADAPTER_PATH);
  const commanderDebugSource = getSourceFileOrThrow(project, COMMANDER_DEBUG_PATH);
  const findings: Finding[] = [];

  if (!hasStringLiteral(aiRuntimeDebugSource, "AI_REQUEST_DEBUG") || !hasStringLiteral(aiRuntimeDebugSource, "AI_RESPONSE_DEBUG") || !hasStringLiteral(aiRuntimeDebugSource, "AI_ERROR_DEBUG")) {
    findings.push(createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: AI_RUNTIME_ADAPTER_PATH, line: 1, severity: "fatal", message: "Structured logging discipline is not wired through the AI runtime and Forensics write path." }));
  }
  if (!hasPropertyAccessPath(aiDebugRecorderSource, ["runtime", "forensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent"])) {
    findings.push(createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: AI_DEBUG_RECORDER_PATH, line: 1, severity: "fatal", message: "AI debug event persistence must flow through Forensics Persistence structured runtime events." }));
  }
  if (!hasPropertyAccessPath(commanderDebugSource, ["runtime", "forensicsPersistenceAbilityGroup", "writeStructuredRuntimeEvent"])) {
    findings.push(createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: COMMANDER_DEBUG_PATH, line: 1, severity: "fatal", message: "Workbench debug event relays must persist structured runtime events through Forensics Persistence." }));
  }

  return findings;
};

const collectCommandFlowFinding = (project: import("ts-morph").Project): Finding[] => {
  const commandFlowSources = [
    getSourceFileOrThrow(project, COMMAND_HANDLER_PATH),
    getSourceFileOrThrow(project, COMMAND_FLOW_RESULT_PATH),
  ];
  const missingCommandFlowEvents = [
    "HUMAN_COMMAND_DRAFTED",
    "HUMAN_COMMAND_RECEIVED",
    "HUMAN_COMMAND_VALIDATED",
    "MISSION_PREFLIGHT_STARTED",
    "MISSION_PREFLIGHT_PASSED",
    "MISSION_PREFLIGHT_FAILED",
    "COMMAND_ACCEPTED",
    "COMMAND_REJECTED",
  ].filter((eventType) => !commandFlowSources.some((source) => hasStringLiteral(source, eventType)));

  return missingCommandFlowEvents.length > 0
    ? [createFinding({ lawId: LAW_STRUCTURED_LOGGING_COMMAND_FLOW, file: COMMAND_HANDLER_PATH, line: 1, severity: "error", message: "Commander command flow is missing required structured debug events.", detail: missingCommandFlowEvents.join(", ") })]
    : [];
};

const hasObjectProperty = (sourceFile: import("ts-morph").SourceFile, propertyName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName);
};

const isLiteralValue = (node: import("ts-morph").Node | undefined, value: string): boolean => {
  return (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    && node.getLiteralText() === value;
};

const matchesStatusComparison = (expression: import("ts-morph").BinaryExpression, operatorKind: SyntaxKind, literal: string): boolean => {
  if (expression.getOperatorToken().getKind() !== operatorKind) {
    return false;
  }

  const leftPath = flattenPropertyAccess(expression.getLeft()).join(".");
  const rightPath = flattenPropertyAccess(expression.getRight()).join(".");

  return (leftPath === "result.status" && isLiteralValue(expression.getRight(), literal))
    || (rightPath === "result.status" && isLiteralValue(expression.getLeft(), literal));
};

const hasBoundaryEventCall = (
  sourceFile: import("ts-morph").SourceFile,
  eventType: "FORENSICS_RECORD_WRITE_REQUESTED" | "FORENSICS_RECORD_WRITTEN",
  status: "started" | "success",
): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "buildBoundaryEvent") {
      return false;
    }

    const [, eventArgument, statusArgument] = callExpression.getArguments();
    return isLiteralValue(eventArgument, eventType) && isLiteralValue(statusArgument, status);
  });
};

const hasWrittenBoundaryFailureOnlyGate = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const emitWritten = sourceFile.getFunction("emitForensicsRecordWritten");
  if (!emitWritten) {
    return false;
  }

  const comparisons = emitWritten.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const hasFailedGate = comparisons.some((expression) => matchesStatusComparison(expression, SyntaxKind.EqualsEqualsEqualsToken, "failed"));
  const hasSuccessOnlyGate = comparisons.some((expression) => {
    return matchesStatusComparison(expression, SyntaxKind.ExclamationEqualsEqualsToken, "success")
      || matchesStatusComparison(expression, SyntaxKind.EqualsEqualsEqualsToken, "success");
  });

  return hasFailedGate && !hasSuccessOnlyGate;
};

const hasPersistedBoundaryEventEmitter = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const emitterDeclaration = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) => declaration.getName() === "boundaryEventEmitter");
  if (!emitterDeclaration) {
    return false;
  }

  return emitterDeclaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    return flattenPropertyAccess(callExpression.getExpression()).join(".") === "storage.evidenceStore.saveStructuredRuntimeEvent";
  });
};

const hasBoundaryEmitterAbilityGroupWiring = (sourceFile: import("ts-morph").SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "createForensicsPersistenceAbilityGroup") {
      return false;
    }

    const [configuration] = callExpression.getArguments();
    if (!configuration || !Node.isObjectLiteralExpression(configuration)) {
      return false;
    }

    const structuredLogBusProperty = configuration.getProperty("structuredLogBus");
    if (!structuredLogBusProperty || !Node.isPropertyAssignment(structuredLogBusProperty)) {
      return false;
    }
    const initializer = structuredLogBusProperty.getInitializer();
    return !!initializer
      && Node.isIdentifier(initializer)
      && initializer.getText() === "boundaryEventEmitter";
  });
};

const collectTerminalRelayFinding = (project: import("ts-morph").Project): Finding[] => {
  const terminalSource = getScriptSource(project, TERMINAL_STRUCTURED_LOG_PATH);
  const payloadSource = getSourceFileOrThrow(project, STRUCTURED_LOG_PAYLOAD_PATH);
  const payloadFields = ["runId", "ownerResponsible", "actionableMessage"].every((fieldName) => hasObjectProperty(payloadSource, fieldName));
  const terminalFields = ["runId", "ownerResponsible", "actionableMessage", "traceId", "selectedMapId", "activationSnapshotRef"].every((fieldName) => hasObjectProperty(terminalSource, fieldName));
  return payloadFields && terminalFields
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_COMMAND_FLOW, file: TERMINAL_STRUCTURED_LOG_PATH, line: 1, severity: "fatal", message: "Terminal structured runtime relay must preserve runId, ownerResponsible, actionableMessage, traceId, selectedMapId, and activationSnapshotRef for blocking command events." })];
};

const collectForensicsWriteBoundaryFinding = (project: import("ts-morph").Project): Finding[] => {
  const boundarySource = getSourceFileOrThrow(project, WRITE_BOUNDARY_EVENTS_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const hasBoundaryEvents = hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED")
    && hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITTEN");
  const hasBoundaryEmitCalls = hasBoundaryEventCall(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED", "started")
    && hasBoundaryEventCall(boundarySource, "FORENSICS_RECORD_WRITTEN", "success");
  const hasAbilityGroupBoundaryWiring = hasCallExpression(abilityGroupSource, "emitForensicsRecordWriteRequested")
    && hasCallExpression(abilityGroupSource, "emitForensicsRecordWritten");
  const hasWorkbenchBoundaryWiring = hasPersistedBoundaryEventEmitter(workbenchSource)
    && hasBoundaryEmitterAbilityGroupWiring(workbenchSource);
  const hasReviewRequiredWriteCompletion = hasWrittenBoundaryFailureOnlyGate(boundarySource);

  return hasBoundaryEvents
    && hasBoundaryEmitCalls
    && hasAbilityGroupBoundaryWiring
    && hasWorkbenchBoundaryWiring
    && hasReviewRequiredWriteCompletion
    && hasLiteralTextFragment(boundarySource, "recordType=")
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: WRITE_BOUNDARY_EVENTS_PATH, line: 1, severity: "fatal", message: "Forensics structured log writes must emit explicit FORENSICS_RECORD_WRITE_REQUESTED/WRITTEN events through the public ability-group wrapper and structured log bus." })];
};

const hasStartupHealthSignals = (startupSource: import("ts-morph").SourceFile): boolean => {
  return hasStringLiteral(startupSource, "APP_SHELL_HEALTH_CHECK_STARTED")
    && hasStringLiteral(startupSource, "APP_SHELL_HEALTH_PASSED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_CHECK_STARTED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_PASSED")
    && hasStringLiteral(startupSource, "MISSION_READINESS_DEGRADED");
};

const collectHealthFinding = (project: import("ts-morph").Project): Finding[] => {
  const statusSource = getSourceFileOrThrow(project, STATUS_PATH);
  const commandFlowSource = getSourceFileOrThrow(project, COMMAND_HANDLER_PATH);
  const startupSource = getStartupSource(project);
  const healthWired = hasStringLiteral(statusSource, "app-shell-health")
    && hasStringLiteral(statusSource, "mission-readiness")
    && hasStartupHealthSignals(startupSource)
    && hasStringLiteral(commandFlowSource, "LOCAL_AI_READINESS_DEGRADED");

  return healthWired
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_HEALTH, file: STARTUP_ENTRYPOINT_PATH, line: 1, severity: "error", message: "AppShellHealth and MissionReadiness structured logging is not fully wired across startup and mission preflight surfaces." })];
};

const collectExitFinding = (project: import("ts-morph").Project): Finding[] => {
  const startupSource = getStartupSource(project);
  const exitWired = hasStringLiteral(startupSource, "SERVICE_STOP_REQUESTED")
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
    ...collectTerminalRelayFinding(project),
    ...collectForensicsWriteBoundaryFinding(project),
    ...collectHealthFinding(project),
    ...collectExitFinding(project),
  ];
}
