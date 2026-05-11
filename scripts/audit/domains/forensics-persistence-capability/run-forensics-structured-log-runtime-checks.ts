import { pathFromRepoRoot } from "../../core/paths.js";
import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { flattenPropertyAccess, getSourceFileOrThrow, hasCallExpression, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { collectTerminalRelayFinding } from "./terminal-relay-proof.js";

const {
  ABILITY_GROUP_PATH,
  AI_DEBUG_RECORDER_PATH,
  AI_RUNTIME_ADAPTER_PATH,
  COMMAND_HANDLER_PATH,
  COMMAND_FLOW_RESULT_PATH,
  COMMAND_RUNTIME_EVENTS_PATH,
  COMMANDER_DEBUG_PATH,
  LAW_STRUCTURED_LOGGING_COMMAND_FLOW,
  LAW_STRUCTURED_LOGGING_DISCIPLINE,
  LAW_STRUCTURED_LOGGING_EXIT,
  LAW_STRUCTURED_LOGGING_HEALTH,
  STARTUP_ENTRYPOINT_PATH,
  STARTUP_LOG_HELPERS_PATH,
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
    getSourceFileOrThrow(project, COMMAND_RUNTIME_EVENTS_PATH),
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

const hasStringLiteralAcrossSources = (
  sources: readonly import("ts-morph").SourceFile[],
  literal: string,
): boolean => sources.some((source) => hasStringLiteral(source, literal));

const isLiteralValue = (node: import("ts-morph").Node | undefined, value: string): boolean => {
  return (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    && node.getLiteralText() === value;
};

const hasBoundaryEventCall = (
  sourceFile: import("ts-morph").SourceFile,
  eventType: "FORENSICS_RECORD_WRITE_REQUESTED" | "FORENSICS_RECORD_WRITTEN" | "FORENSICS_RECORD_WRITE_REVIEW_REQUIRED",
  status: "started" | "success" | "review_required",
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

const functionHasLiteralFragments = (
  sourceFile: import("ts-morph").SourceFile,
  functionName: string,
  requiredLiterals: readonly string[],
): boolean => {
  const functionNode = sourceFile.getFunction(functionName);
  if (!functionNode) {
    return false;
  }

  const functionText = functionNode.getText();
  return requiredLiterals.every((literal) => functionText.includes(literal));
};

const hasForensicsWriteProofRefs = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const requestedRefs = [
    "sourceEventId=",
    "sourceEventType=",
    "sourceOwner=",
    "recordKind=",
    "pendingRecordId=",
    "idempotencyKey=",
    "dedupeDecision=pending",
  ];
  const writtenRefs = [
    "sourceEventId=",
    "sourceEventType=",
    "recordId=",
    "recordRef=",
    "idempotencyKey=",
    "dedupeDecision=${dedupeDecision}",
    "durabilityMode=",
    "storageRef=",
  ];

  return functionHasLiteralFragments(sourceFile, "emitForensicsRecordWriteRequested", requestedRefs)
    && (
      functionHasLiteralFragments(sourceFile, "emitForensicsRecordWritten", writtenRefs)
      || functionHasLiteralFragments(sourceFile, "buildForensicsRecordWrittenRefs", writtenRefs)
    );
};

const getFunctionText = (
  sourceFile: import("ts-morph").SourceFile,
  functionName: string,
): string => sourceFile.getFunction(functionName)?.getText() ?? "";

const hasNoFailedWriteSilenceGate = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const sourceText = sourceFile.getFullText();
  const eventTypeResolverText = getFunctionText(sourceFile, "resolveForensicsRecordWrittenEventType");
  const dedupeResolverText = getFunctionText(sourceFile, "resolveForensicsRecordWrittenDedupeDecision");
  return !sourceText.includes('result.status === "failed")')
    && eventTypeResolverText.includes('result.status === "review_required" || result.status === "failed"')
    && dedupeResolverText.includes('result.status === "failed"');
};

const hasReviewRequiredWriteSemantics = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const eventTypeResolverText = getFunctionText(sourceFile, "resolveForensicsRecordWrittenEventType");
  const statusResolverText = getFunctionText(sourceFile, "resolveForensicsRecordWrittenStatus");
  const dedupeResolverText = getFunctionText(sourceFile, "resolveForensicsRecordWrittenDedupeDecision");
  const writtenRefsText = getFunctionText(sourceFile, "buildForensicsRecordWrittenRefs");
  return eventTypeResolverText.includes('result.status === "review_required" || result.status === "failed"')
    && eventTypeResolverText.includes("FORENSICS_RECORD_WRITE_REVIEW_REQUIRED")
    && statusResolverText.includes('result.status === "review_required" || result.status === "failed"')
    && statusResolverText.includes('"review_required"')
    && statusResolverText.includes('"success"')
    && dedupeResolverText.includes('result.status === "failed"')
    && dedupeResolverText.includes('"failed"')
    && writtenRefsText.includes('durabilityMode=${result.storageRef ? "durable" : "memory_only"}');
};

const hasDurableSuccessResultSemantics = (project: import("ts-morph").Project): boolean => {
  const resultBuilderSource = getSourceFileOrThrow(project, "src/capabilities/forensics-persistence/shared/forensics-result-builder.ts");
  const statusSource = getSourceFileOrThrow(project, "src/capabilities/forensics-persistence/shared/forensics-status.ts");
  const legacyResolver = resultBuilderSource.getVariableDeclaration("resolveForensicsResultStatus");
  const currentResolver = statusSource.getFunction("resolveForensicsPersistenceStatus");
  const resultBuilderText = resultBuilderSource.getFullText();
  const hasResolver = (
    !!legacyResolver && legacyResolver.getText().includes("storedRecord?.storageRef")
  ) || (
    !!currentResolver && currentResolver.getText().includes("input.storedRecord?.storageRef")
  );
  return hasResolver
    && resultBuilderText.includes('status === "review_required" ? input.reviewRequiredReason : null');
};

const hasPersistedBoundaryEventEmitter = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const emitterDeclaration = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) => declaration.getName() === "boundaryEventEmitter");
  if (!emitterDeclaration) {
    return false;
  }

  return emitterDeclaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    // After storage rewrite: evidenceStore is removed; structured log events go via structuredLogBus.
    // Accept both the legacy pattern (for backward scan) and the bus pattern.
    const access = flattenPropertyAccess(callExpression.getExpression()).join(".");
    return access === "storage.evidenceStore.saveStructuredRuntimeEvent" || access === "structuredLogBus.emit" || access === "structuredLogBus.publish";
  });
};

const hasStructuredLogBusBoundaryEmitter = (configuration: import("ts-morph").ObjectLiteralExpression): boolean => {
  const structuredLogBusProperty = configuration.getProperty("structuredLogBus");
  if (!structuredLogBusProperty || !Node.isPropertyAssignment(structuredLogBusProperty)) {
    return false;
  }
  const initializer = structuredLogBusProperty.getInitializer();
  return !!initializer
    && Node.isIdentifier(initializer)
    && initializer.getText() === "boundaryEventEmitter";
};

const isForensicsAbilityGroupFactoryCall = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return Node.isIdentifier(expression) && expression.getText() === "createForensicsPersistenceAbilityGroup";
};

const hasBoundaryEmitterAbilityGroupWiring = (sourceFile: import("ts-morph").SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    if (!isForensicsAbilityGroupFactoryCall(callExpression)) {
      return false;
    }

    const [configuration] = callExpression.getArguments();
    return !!configuration
      && Node.isObjectLiteralExpression(configuration)
      && hasStructuredLogBusBoundaryEmitter(configuration);
  });
};

const collectForensicsWriteBoundaryFinding = (project: import("ts-morph").Project): Finding[] => {
  const boundarySource = getSourceFileOrThrow(project, WRITE_BOUNDARY_EVENTS_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const checks = [
    hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED"),
    hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITTEN"),
    hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITE_REVIEW_REQUIRED"),
    hasBoundaryEventCall(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED", "started"),
    hasCallExpression(abilityGroupSource, "emitForensicsRecordWriteRequested"),
    hasCallExpression(abilityGroupSource, "emitForensicsRecordWritten"),
    hasPersistedBoundaryEventEmitter(workbenchSource),
    hasBoundaryEmitterAbilityGroupWiring(workbenchSource),
    hasNoFailedWriteSilenceGate(boundarySource),
    hasReviewRequiredWriteSemantics(boundarySource),
    hasDurableSuccessResultSemantics(project),
    hasLiteralTextFragment(boundarySource, "recordType="),
    hasForensicsWriteProofRefs(boundarySource),
  ];

  return checks.every(Boolean)
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_DISCIPLINE, file: WRITE_BOUNDARY_EVENTS_PATH, line: 1, severity: "fatal", message: "Forensics structured log writes must emit explicit FORENSICS_RECORD_WRITE_REQUESTED/WRITTEN events through the public ability-group wrapper and structured log bus." })];
};

const hasStartupHealthSignals = (startupSources: readonly import("ts-morph").SourceFile[]): boolean => [
  "APP_SHELL_HEALTH_CHECK_STARTED",
  "APP_SHELL_HEALTH_PASSED",
  "MISSION_READINESS_CHECK_STARTED",
  "MISSION_READINESS_PASSED",
  "MISSION_READINESS_DEGRADED",
].every((eventType) => hasStringLiteralAcrossSources(startupSources, eventType));

const collectHealthFinding = (project: import("ts-morph").Project): Finding[] => {
  const statusSource = getSourceFileOrThrow(project, STATUS_PATH);
  const commandFlowSource = getSourceFileOrThrow(project, COMMAND_HANDLER_PATH);
  const startupSources = [
    getStartupSource(project),
    getScriptSource(project, STARTUP_LOG_HELPERS_PATH),
  ];
  const healthWired = hasStringLiteral(statusSource, "app-shell-health")
    && hasStringLiteral(statusSource, "mission-readiness")
    && hasStartupHealthSignals(startupSources)
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
