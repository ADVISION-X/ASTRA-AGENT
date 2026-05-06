import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { commanderConsoleInspectionConstants } from "./inspection-constants.js";

const {
  COMMAND_OUTCOMES_PATH,
  RUNTIME_PROOF_SCHEMA_PATH,
  TASK_START_DISPATCH_RESULT_PATH,
  TRANSPORT_SCHEMA_PATH,
  TRANSPORT_SEMANTIC_GATE_PATH,
  WORKBENCH_COMMANDER_DEBUG_PATH,
} = commanderConsoleInspectionConstants;
const WORKBENCH_HUMAN_COMMAND_DEBUG_EVENTS_PATH = "src/lib/local-runtime/workbench-human-command-debug-events.ts";
const TASK_START_SUPPORT_PATH = "src/lib/local-app-shell/task-start-support.ts";

const createFatalFinding = (lawId: string, file: string, message: string): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message });

const getObjectLiteralPropertyNamesFromVariable = (sourceFile: import("ts-morph").SourceFile, variableName: string): Set<string> => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
  const objectCall = initializer && Node.isCallExpression(initializer) && initializer.getExpression().getText().endsWith(".object")
    ? initializer
    : initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText().endsWith(".object"));
  const objectLiteral = objectCall?.getArguments()[0] ?? null;
  if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) {
    return new Set();
  }
  return new Set(objectLiteral.getProperties().flatMap((property) => Node.isPropertyAssignment(property) ? [property.getName()] : []));
};

const getVariableFunctionBody = (sourceFile: import("ts-morph").SourceFile, variableName: string) => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) ? initializer.getBody() : null;
};

const getFunctionLikeBody = (sourceFile: import("ts-morph").SourceFile, functionName: string) =>
  sourceFile.getFunction(functionName)?.getBody() ?? getVariableFunctionBody(sourceFile, functionName);

const hasRunIdPropertyFromTransport = (sourceFile: import("ts-morph").SourceFile, functionName: string): boolean => {
  const body = getFunctionLikeBody(sourceFile, functionName);
  return Boolean(body?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    const initializer = property.getInitializer();
    return property.getName() === "runId"
      && Boolean(initializer?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "input.transport.runId"));
  }));
};

const hasRunIdNullInsideFunction = (sourceFile: import("ts-morph").SourceFile, functionName: string): boolean => {
  const body = getFunctionLikeBody(sourceFile, functionName);
  return Boolean(body?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "runId" && property.getInitializer()?.getKind() === SyntaxKind.NullKeyword));
};

const hasRunIdPropertyFromInput = (sourceFile: import("ts-morph").SourceFile, functionName: string): boolean => {
  const body = getFunctionLikeBody(sourceFile, functionName);
  return Boolean(body?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "runId" && property.getInitializer()?.getText() === "input.runId"));
};

const hasCommandProofRunIdGuard = (sourceFile: import("ts-morph").SourceFile): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
  const expression = statement.getExpression().getText();
  return expression.includes('value.childKind === "command"') && expression.includes("!value.runId");
});

const hasDebugRefsPassthrough = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const required = new Map([
    ["refs", "input.refs ?? []"],
    ["inputRefs", "input.inputRefs ?? []"],
    ["outputRefs", "input.outputRefs ?? []"],
    ["proofRefs", "input.proofRefs ?? []"],
    ["artifactRefs", "input.artifactRefs ?? []"],
  ]);
  return [...required].every(([propertyName, initializerText]) =>
    sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName && property.getInitializer()?.getText() === initializerText),
  );
};

const hasTaskStartDispatchRefs = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const functionNames = new Set([
    ...sourceFile.getFunctions().map((declaration) => declaration.getName()).filter((name): name is string => Boolean(name)),
    ...sourceFile.getVariableDeclarations().map((declaration) => declaration.getName()),
  ]);
  const rejectedDispatchBody = getVariableFunctionBody(sourceFile, "recordRejectedDispatch");
  const callsCarryRefs = rejectedDispatchBody?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) =>
    ["refs", "proofRefs", "runId"].every((propertyName) =>
      callExpression.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName)
      || callExpression.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment).some((property) => property.getName() === propertyName),
    ),
  ) ?? false;
  return functionNames.has("collectDispatchResultRefs") && functionNames.has("collectDispatchProofRefs") && callsCarryRefs;
};

const hasEarlyAcceptedBoundaryRefs = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const body = getVariableFunctionBody(sourceFile, "recordCommandAccepted");
  const bodyText = body?.getText() ?? "";
  return bodyText.includes("COMMAND_ACCEPTED")
    && bodyText.includes("resultEnvelopeRef=")
    && bodyText.includes("activationSnapshotRef=");
};

const hasLateCommandResponseEvent = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const body = getVariableFunctionBody(sourceFile, "recordAcceptedDispatch");
  const bodyText = body?.getText() ?? "";
  return bodyText.includes("COMMAND_RESPONSE_SENT")
    && !bodyText.includes('eventType: "COMMAND_ACCEPTED"')
    && bodyText.includes("const runId = input.result.runtimeProof?.runId ?? input.approval.traceId")
    && bodyText.includes("traceId: runId");
};

const hasPreDispatchReadyEvent = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const body = getFunctionLikeBody(sourceFile, "recordTaskStartCommandAccepted");
  const bodyText = body?.getText() ?? "";
  return bodyText.includes("COMMAND_DISPATCH_READY") && !bodyText.includes('eventType: "COMMAND_ACCEPTED"');
};

const hasNerveBusResultProofEvents = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return [
    "NERVE_BUS_RESULT_ENVELOPE_RECEIVED",
    "NERVE_BUS_RESULT_SEMANTIC_GATE_PASSED",
    "NERVE_BUS_TRANSFER_PROOF_BUILT",
    "recordResultEnvelopeReceived",
    "recordResultSemanticGatePassed",
    "recordTransferProofBuilt",
    "traceId: transport.commandEnvelope.traceId",
    "runId: transport.commandEnvelope.runId",
  ].every((token) => text.includes(token));
};

export const collectTransportRunIdFindings = (input: {
  transportSchemaSource: import("ts-morph").SourceFile;
  transportSemanticGateSource: import("ts-morph").SourceFile;
  commandOutcomesSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  const transportResultFields = getObjectLiteralPropertyNamesFromVariable(input.transportSchemaSource, "CommandTransportResultSchema");
  if (!transportResultFields.has("runId")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TRANSPORT_SCHEMA_PATH, "Commander transport result schema must require runId before command outcomes can build runtime proof."));
  }
  if (!hasRunIdPropertyFromTransport(input.commandOutcomesSource, "createTransportOutcome")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_OUTCOMES_PATH, "createTransportOutcome must preserve runId from the governed transport result instead of nulling or fabricating it."));
  }
  if (hasRunIdNullInsideFunction(input.commandOutcomesSource, "createTransportOutcome")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_OUTCOMES_PATH, "Dispatched command outcome must not assign runId:null."));
  }
  if (hasRunIdNullInsideFunction(input.transportSemanticGateSource, "buildSemanticFailure") || hasRunIdNullInsideFunction(input.transportSemanticGateSource, "buildSemanticReviewRequired")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TRANSPORT_SEMANTIC_GATE_PATH, "Commander transport semantic failure and review builders must preserve a non-null runId instead of returning runId:null."));
  }
  if (!hasRunIdPropertyFromInput(input.transportSemanticGateSource, "buildSemanticReviewRequired")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TRANSPORT_SEMANTIC_GATE_PATH, "Commander transport semantic review path must preserve the accepted transport runId."));
  }
  if (!input.transportSemanticGateSource.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) =>
    expression.getText() === "input.result.runId" || expression.getText() === "result.runId",
  )) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2", TRANSPORT_SEMANTIC_GATE_PATH, "Commander transport semantic gate must validate transport result runId."));
  }
  return findings;
};

export const collectRuntimeProofRunIdFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  return hasCommandProofRunIdGuard(sourceFile)
    ? []
    : [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", RUNTIME_PROOF_SCHEMA_PATH, "Commander command runtime proofs must reject runId:null at schema level.")];
};

export const collectDebugRefFindings = (input: {
  workbenchDebugSource: import("ts-morph").SourceFile;
  taskStartDispatchResultSource: import("ts-morph").SourceFile;
  taskStartSupportSource: import("ts-morph").SourceFile;
  acceptedBoundarySource: import("ts-morph").SourceFile;
  commanderCommandTransportSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  if (!hasDebugRefsPassthrough(input.workbenchDebugSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", WORKBENCH_COMMANDER_DEBUG_PATH, "Commander debug event builder must preserve refs/proofRefs/inputRefs/outputRefs/artifactRefs from dispatch results."));
  }
  if (!hasTaskStartDispatchRefs(input.taskStartDispatchResultSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", TASK_START_DISPATCH_RESULT_PATH, "Task start dispatch result must keep commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef refs on the late COMMAND_REJECTED path."));
  }
  if (!hasEarlyAcceptedBoundaryRefs(input.acceptedBoundarySource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", WORKBENCH_HUMAN_COMMAND_DEBUG_EVENTS_PATH, "Early COMMAND_ACCEPTED boundary event must publish resultEnvelopeRef and activationSnapshotRef before the awaited mission execution completes."));
  }
  if (!hasPreDispatchReadyEvent(input.taskStartSupportSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", TASK_START_SUPPORT_PATH, "Task-start pre-dispatch logging must use COMMAND_DISPATCH_READY, not a duplicate COMMAND_ACCEPTED event."));
  }
  if (!hasLateCommandResponseEvent(input.taskStartDispatchResultSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", TASK_START_DISPATCH_RESULT_PATH, "Task-start dispatch response logging must use COMMAND_RESPONSE_SENT with a unified runtimeProof runId trace instead of emitting duplicate COMMAND_ACCEPTED with mixed trace/run."));
  }
  if (!hasNerveBusResultProofEvents(input.commanderCommandTransportSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", "src/lib/local-runtime/workbench-commander-command-transport.ts", "Commander command transport must emit terminal-visible Nerve Bus result envelope, semantic gate, and transfer proof events with governed trace/run."));
  }
  return findings;
};
