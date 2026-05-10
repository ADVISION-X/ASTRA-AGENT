import { Node, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { createFinding, createPhase, toRepoRelativePath, type Finding, type InspectorPhase } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow, getTypeAliasPropertyNames, getZodObjectPropertyNames, hasAnyKeyword, hasConsoleLog } from "./inspection-ast-helpers.js";
import { GOVERNED_SOURCE_PATHS, structuredLoggingInspectionConstants as config } from "./inspection-constants.js";

type PhaseCheck = { findings: Finding[]; passed: boolean };
type StructuredLoggingSources = ReturnType<typeof loadStructuredLoggingSources>;

const collectComments = (sourceFile: SourceFile): string[] => {
  const comments = new Set<string>();
  for (const node of [sourceFile, ...sourceFile.getDescendants()]) {
    for (const range of node.getLeadingCommentRanges()) {
      comments.add(range.getText());
    }
    for (const range of node.getTrailingCommentRanges()) {
      comments.add(range.getText());
    }
  }
  return [...comments];
};

const hasCommentDirective = (sourceFile: SourceFile): boolean => {
  return collectComments(sourceFile).some((commentText) => config.COMMENT_DIRECTIVES.some((directive) => commentText.includes(directive)));
};

const hasImportOrRequireEscape = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword || (Node.isIdentifier(expression) && expression.getText() === "require");
  });
};

const hasStringLiteral = (sourceFile: SourceFile, literalText: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) => node.getLiteralText() === literalText)
    || sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((node) => node.getLiteralText() === literalText);
};

const hasObjectPropertyValue = (node: Node, propertyName: string, predicate: (initializer: Node) => boolean): boolean => {
  return node.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const property = objectLiteral.getProperty(propertyName);
    if (!property || !Node.isPropertyAssignment(property)) {
      return false;
    }

    const initializer = property.getInitializer();
    return Boolean(initializer && predicate(initializer));
  });
};

const hasObjectPropertyStringLiteral = (node: Node, propertyName: string, literalText: string): boolean => {
  return hasObjectPropertyValue(node, propertyName, (initializer) => {
    return (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) && initializer.getLiteralText() === literalText;
  });
};

const hasObjectPropertyNull = (node: Node, propertyName: string): boolean => {
  return hasObjectPropertyValue(node, propertyName, (initializer) => initializer.getKind() === SyntaxKind.NullKeyword);
};

const hasObjectProperty = (node: Node, propertyName: string): boolean => {
  return node.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => Boolean(objectLiteral.getProperty(propertyName)));
};

const isForensicsAbilityMethodCall = (callExpression: CallExpression, methodName: string): boolean => {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== methodName) {
    return false;
  }

  const symbol = expression.getNameNode().getSymbol() ?? expression.getSymbol();
  const declarationPaths = (symbol?.getAliasedSymbol() ?? symbol)?.getDeclarations().map((declaration) => toRepoRelativePath(declaration.getSourceFile().getFilePath())) ?? [];
  if (declarationPaths.includes(config.FORENSICS_CONTRACT_PATH)) {
    return true;
  }

  const receiverText = expression.getExpression().getText();
  return receiverText.endsWith("forensicsPersistenceAbilityGroup") || expression.getExpression().getType().getText(expression).includes("ForensicsPersistenceAbilityGroup");
};

const getForensicsAbilityCalls = (sourceFile: SourceFile, methodName: string): CallExpression[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => isForensicsAbilityMethodCall(callExpression, methodName));
};

const getWriterCallsByMethodName = (sourceFile: SourceFile, methodName: string): CallExpression[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
  });
};

const allCallsCarryOrchestrationOwnership = (callExpressions: CallExpression[]): boolean => {
  return callExpressions.length > 0 && callExpressions.every((callExpression) => {
    return hasObjectPropertyStringLiteral(callExpression, "requestedBy", "orchestration")
      && hasObjectPropertyStringLiteral(callExpression, "sourceAbilityGroupId", "orchestration");
  });
};

const getStructuredPayloadParseCalls = (sourceFile: SourceFile, schemaName: string): CallExpression[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "parse" && expression.getExpression().getText() === schemaName;
  });
};

const allStructuredPayloadsCarryOwnerShape = (sourceFile: SourceFile, schemaName: string): boolean => {
  const parseCalls = getStructuredPayloadParseCalls(sourceFile, schemaName);
  return parseCalls.length > 0 && parseCalls.every((callExpression) => {
    return hasObjectPropertyStringLiteral(callExpression, "abilityGroupId", "orchestration") && hasObjectPropertyNull(callExpression, "childCapabilityId");
  });
};

const allStructuredPayloadsCarryRequiredFields = (sourceFile: SourceFile, schemaName: string, requiredFields: string[]): boolean => {
  const parseCalls = getStructuredPayloadParseCalls(sourceFile, schemaName);
  return parseCalls.length > 0 && parseCalls.every((callExpression) => {
    return requiredFields.every((fieldName) => hasObjectProperty(callExpression, fieldName));
  });
};

const childImplementationClosesTraceability = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "executeForensicsChild";
  });
};

const callsCarryTraceability = (callExpressions: CallExpression[]): boolean => {
  return callExpressions.length > 0 && callExpressions.every((callExpression) => {
    return hasObjectProperty(callExpression, "sourceRecordRefs")
      && hasObjectProperty(callExpression, "artifactRefs")
      && hasObjectProperty(callExpression, "debugLogRef");
  });
};

const createBooleanPhase = (name: string, passed: boolean, passMessage: string, failMessage: string): InspectorPhase => {
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passMessage : failMessage);
};

const loadStructuredLoggingSources = () => {
  const project = createAuditProject();
  return {
    typesFile: getSourceFileOrThrow(project, config.TYPES_PATH),
    runtimeProofSupport: getSourceFileOrThrow(project, config.RUNTIME_PROOF_SUPPORT_PATH),
    runtimeActionSupport: getSourceFileOrThrow(project, config.RUNTIME_ACTION_SUPPORT_PATH),
    runtimeProofType: getSourceFileOrThrow(project, config.FORENSICS_RUNTIME_PROOF_PATH),
    persistenceResult: getSourceFileOrThrow(project, config.FORENSICS_RESULT_PATH),
    structuredRuntimeChild: getSourceFileOrThrow(project, config.STRUCTURED_RUNTIME_CHILD_PATH),
    structuredActionChild: getSourceFileOrThrow(project, config.STRUCTURED_ACTION_CHILD_PATH),
    structuredActionContract: getSourceFileOrThrow(project, config.STRUCTURED_ACTION_CONTRACT_PATH),
    runtimeSnapshotChild: getSourceFileOrThrow(project, config.RUNTIME_SNAPSHOT_CHILD_PATH),
    executorSource: getSourceFileOrThrow(project, config.EXECUTOR_PATH),
    stepTraceRecorderSource: getSourceFileOrThrow(project, config.ORCHESTRATION_STEP_TRACE_RECORDER_PATH),
    structuredLogPayloadSource: getSourceFileOrThrow(project, config.STRUCTURED_LOG_PAYLOAD_PATH),
    terminalStructuredLogSource: getSourceFileOrThrow(project, config.TERMINAL_STRUCTURED_LOG_PATH),
    governedSourceFiles: GOVERNED_SOURCE_PATHS.map((path) => getSourceFileOrThrow(project, path)),
  };
};

const inspectRequiredShape = (sources: StructuredLoggingSources): PhaseCheck => {
  const runtimeEventFields = getZodObjectPropertyNames(sources.typesFile, "StructuredRuntimeEventSchema");
  const actionLogFields = getZodObjectPropertyNames(sources.typesFile, "StructuredActionLogSchema");
  const typesPassed = [
    runtimeEventFields.has("abilityGroupId"), runtimeEventFields.has("childCapabilityId"), runtimeEventFields.has("sessionId"), runtimeEventFields.has("runId"), runtimeEventFields.has("roundId"), runtimeEventFields.has("videoVisitId"), runtimeEventFields.has("status"), runtimeEventFields.has("reason"), runtimeEventFields.has("inputRefs"), runtimeEventFields.has("outputRefs"), runtimeEventFields.has("evidenceRefs"), runtimeEventFields.has("actionLogRefs"), runtimeEventFields.has("createdAt"),
    actionLogFields.has("abilityGroupId"), actionLogFields.has("childCapabilityId"), actionLogFields.has("sessionId"), actionLogFields.has("roundId"), actionLogFields.has("videoVisitId"), actionLogFields.has("actionPurpose"), actionLogFields.has("triggerSource"), actionLogFields.has("failureReason"), actionLogFields.has("reviewRequiredReason"), actionLogFields.has("inputRefs"), actionLogFields.has("outputRefs"), actionLogFields.has("evidenceRefs"), actionLogFields.has("createdAt"),
  ].every(Boolean);
  const runtimePayloadShapePassed = [sources.runtimeProofSupport, sources.stepTraceRecorderSource].every((sourceFile) => {
    return allStructuredPayloadsCarryRequiredFields(sourceFile, "StructuredRuntimeEventSchema", ["abilityGroupId", "sessionId", "createdAt", "status"]);
  });
  const actionPayloadShapePassed = allStructuredPayloadsCarryRequiredFields(sources.runtimeActionSupport, "StructuredActionLogSchema", ["abilityGroupId", "sessionId", "actionPurpose", "createdAt"]);
  const passed = typesPassed && runtimePayloadShapePassed && actionPayloadShapePassed && !hasAnyKeyword(sources.typesFile);

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: config.TYPES_PATH, line: 1, severity: "error", message: "Structured logging schema or payload builders are missing governed owner identity, required fields, or type-safe payload construction." })],
    passed,
  };
};

const hasRelayField = (sourceFile: SourceFile, fieldName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === fieldName);
};

const hasIdentifierText = (sourceFile: SourceFile, identifierName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
};

const inspectTerminalCommandRejectionPayload = (sources: StructuredLoggingSources): PhaseCheck => {
  const payloadFields = ["runId", "ownerResponsible", "actionableMessage"].every((fieldName) => hasRelayField(sources.structuredLogPayloadSource, fieldName));
  const terminalRelayUsesPayloadBuilders = ["buildEventPayload", "buildActionPayload", "resolveTerminalPrefix"].every((identifierName) => hasIdentifierText(sources.terminalStructuredLogSource, identifierName));
  const passed = payloadFields && terminalRelayUsesPayloadBuilders;

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: config.TERMINAL_STRUCTURED_LOG_PATH, line: 1, severity: "fatal", message: "Terminal structured runtime relay must preserve runId, ownerResponsible, actionableMessage, and traceId for blocking command events." })],
    passed,
  };
};

const inspectPersistenceBoundary = (sources: StructuredLoggingSources): PhaseCheck => {
  const runtimeEventCalls = [
    ...getWriterCallsByMethodName(sources.stepTraceRecorderSource, "writeStructuredRuntimeEvent"),
  ];
  const actionLogCalls = [
    ...getWriterCallsByMethodName(sources.stepTraceRecorderSource, "writeStructuredActionLog"),
  ];
  const passed = allCallsCarryOrchestrationOwnership(runtimeEventCalls)
    && allCallsCarryOrchestrationOwnership(actionLogCalls)
    && !hasStringLiteral(sources.stepTraceRecorderSource, "agent-runtime");

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: config.ORCHESTRATION_STEP_TRACE_RECORDER_PATH, line: 1, severity: "fatal", message: "Structured logging writes must route through Forensics Persistence from active ability-group ownership, not the retired agent-runtime owner." })],
    passed,
  };
};

const inspectActionLogProducerCoverage = (sources: StructuredLoggingSources): PhaseCheck => {
  const actionLogCalls = getWriterCallsByMethodName(sources.stepTraceRecorderSource, "writeStructuredActionLog");
  const passed = allCallsCarryOrchestrationOwnership(actionLogCalls);

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: config.ORCHESTRATION_STEP_TRACE_RECORDER_PATH, line: 1, severity: "fatal", message: "Structured logging governance must reject an empty production writeStructuredActionLog producer set for the active Orchestration mission loop." })],
    passed,
  };
};

const inspectActionLogPersistenceGuard = (sources: StructuredLoggingSources): PhaseCheck => {
  const contractDoesNotRequireParentRefs = hasObjectPropertyValue(sources.structuredActionContract, "requireParentRefs", (initializer) => initializer.getKind() === SyntaxKind.FalseKeyword);
  const recorderRejectsFailedWrites = sources.stepTraceRecorderSource.getFullText().includes('result.status === "failed"');
  const runtimeEventCarriesActionChainRefs = allStructuredPayloadsCarryRequiredFields(sources.stepTraceRecorderSource, "StructuredRuntimeEventSchema", ["actionRef", "postActionVerificationRef"]);
  const passed = contractDoesNotRequireParentRefs && recorderRejectsFailedWrites && runtimeEventCarriesActionChainRefs;

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: config.STRUCTURED_ACTION_CONTRACT_PATH, line: 1, severity: "fatal", message: "Structured action log governance must keep parentRefs optional for the orchestration producer, reject failed forensics writes, and preserve actionRef/postActionVerificationRef in runtime events." })],
    passed,
  };
};

const hasTraceabilityTypeFields = (runtimeProofType: SourceFile): boolean => {
  const runtimeProofFields = getZodObjectPropertyNames(runtimeProofType, "ForensicsRuntimeProofSchema");
  return [runtimeProofFields.has("proofId"), runtimeProofFields.has("outputRecordRefs"), runtimeProofFields.has("artifactRefs"), runtimeProofFields.has("storageRef")].every(Boolean);
};

const hasTraceabilityBuilders = (persistenceResult: SourceFile): boolean => {
  return ["buildForensicsOutput", "buildForensicsRecordRef", "buildForensicsProof", "ForensicsResultSchema"].every((identifierName) => {
    return hasIdentifierText(persistenceResult, identifierName);
  });
};

const inspectTraceability = (sources: StructuredLoggingSources): PhaseCheck => {
  const traceabilityTypePassed = ["proofId", "outputRecordRefs", "artifactRefs", "storageRef"].every((fieldName) => hasRelayField(sources.runtimeProofType, fieldName));
  const traceabilityBuildersPassed = ["buildForensicsOutput", "buildForensicsRecordRef", "buildForensicsProof", "ForensicsResultSchema"].every((identifierName) => hasIdentifierText(sources.persistenceResult, identifierName));
  const childTraceabilityPassed = [sources.structuredRuntimeChild, sources.structuredActionChild, sources.runtimeSnapshotChild].every((sourceFile) => hasIdentifierText(sourceFile, "executeForensicsChild"));
  const passed = traceabilityTypePassed && traceabilityBuildersPassed && childTraceabilityPassed;

  return {
    findings: passed ? [] : [createFinding({ lawId: config.LAW_TRACEABILITY, file: config.FORENSICS_RESULT_PATH, line: 1, severity: "fatal", message: "Structured logging runtime proof must close through proof ids, record refs, artifact refs, debug log refs, and Forensics child result builders." })],
    passed,
  };
};

const inspectAntiEscape = (sources: StructuredLoggingSources): PhaseCheck => {
  const antiEscapeViolations = sources.governedSourceFiles.filter((sourceFile) => {
    return hasAnyKeyword(sourceFile) || hasCommentDirective(sourceFile) || hasImportOrRequireEscape(sourceFile) || hasConsoleLog(sourceFile);
  }).map((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()));

  return {
    findings: antiEscapeViolations.length === 0 ? [] : [createFinding({ lawId: config.LAW_DISCIPLINE, file: antiEscapeViolations[0] ?? config.TYPES_PATH, line: 1, severity: "fatal", message: "Structured logging governance files contain console-truth, require/import escapes, comment directives, or any-based loopholes." })],
    passed: antiEscapeViolations.length === 0,
  };
};

const buildStructuredLoggingPhases = (input: {
  requiredShape: PhaseCheck;
  persistenceBoundary: PhaseCheck;
  traceability: PhaseCheck;
  actionLogProducerCoverage: PhaseCheck;
  actionLogPersistenceGuard: PhaseCheck;
  antiEscape: PhaseCheck;
  terminalRelay: PhaseCheck;
}): InspectorPhase[] => {
  return [
    createBooleanPhase("structured-logging-required-shape", input.requiredShape.passed, "Structured logging schemas and payload builders carry governed owner ids, refs, reasons, and timestamps.", "Structured logging schemas or payload builders are missing governed owner ids or required record fields."),
    createBooleanPhase("structured-logging-boundary-attack", input.persistenceBoundary.passed, "Structured runtime and action log writes flow through Forensics Persistence from active ability-group ownership.", "Structured runtime or action log writes still rely on a retired owner or bypass the governed Forensics ability boundary."),
    createBooleanPhase("structured-logging-runtime-proof-traceability", input.traceability.passed, "Runtime proof stays traceable through proof ids, record refs, artifact refs, debug log refs, and child write results.", "Runtime proof traceability is incomplete across the Forensics proof type, result builders, or structured logging child implementations."),
    createBooleanPhase("structured-logging-action-log-producer-coverage", input.actionLogProducerCoverage.passed, "Structured logging enforcement proves there is an active production action-log producer in the governed Orchestration loop.", "Structured logging enforcement still allows an empty production action-log producer set for the governed Orchestration loop."),
    createBooleanPhase("structured-logging-action-log-persistence-guard", input.actionLogPersistenceGuard.passed, "Structured action log persistence stays aligned with the orchestration producer, failed forensics writes are rejected, and runtime events preserve action/proof refs.", "Structured action log persistence can still drift out of contract with the orchestration producer or silently drop failed-write truth."),
    createBooleanPhase("structured-logging-terminal-command-rejection", input.terminalRelay.passed, "Terminal structured relay preserves owner/actionable/run refs for command rejection events.", "Terminal structured relay can still drop owner/actionable/run refs for command rejection events."),
    createBooleanPhase("structured-logging-anti-escape", input.antiEscape.passed, "Structured logging enforcement files are free of console truth, require/import escape hatches, comment directives, and any-based loopholes.", "Structured logging enforcement files still contain console truth, require/import escape hatches, comment directives, or any-based loopholes."),
  ];
};

export const runStructuredLoggingChecks = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const sources = loadStructuredLoggingSources();
  const requiredShape = inspectRequiredShape(sources);
  const persistenceBoundary = inspectPersistenceBoundary(sources);
  const traceability = inspectTraceability(sources);
  const actionLogProducerCoverage = inspectActionLogProducerCoverage(sources);
  const actionLogPersistenceGuard = inspectActionLogPersistenceGuard(sources);
  const terminalRelay = inspectTerminalCommandRejectionPayload(sources);
  const antiEscape = inspectAntiEscape(sources);

  return {

    findings: [...requiredShape.findings, ...persistenceBoundary.findings, ...traceability.findings, ...actionLogProducerCoverage.findings, ...actionLogPersistenceGuard.findings, ...terminalRelay.findings, ...antiEscape.findings],
    phases: buildStructuredLoggingPhases({ requiredShape, persistenceBoundary, traceability, actionLogProducerCoverage, actionLogPersistenceGuard, terminalRelay, antiEscape }),
  };
};
