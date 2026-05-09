import { pathFromRepoRoot } from "../../core/paths.js";
import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { flattenPropertyAccess, getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  LAW_STRUCTURED_LOGGING_COMMAND_FLOW,
  TERMINAL_STRUCTURED_LOG_PATH,
  STRUCTURED_LOG_PAYLOAD_PATH,
} = forensicsPersistenceInspectionConstants;

const getScriptSource = (project: import("ts-morph").Project, repoRelativePath: string) => {
  const scriptPath = pathFromRepoRoot(repoRelativePath);
  return project.addSourceFileAtPathIfExists(scriptPath) ?? project.addSourceFileAtPath(scriptPath);
};

const hasObjectProperty = (sourceFile: import("ts-morph").SourceFile, propertyName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName);
};

const functionHasPropertyAccessPath = (
  sourceFile: import("ts-morph").SourceFile,
  functionName: string,
  propertyPath: readonly string[],
): boolean => {
  const functionNode = sourceFile.getFunction(functionName);
  if (!functionNode) {
    return false;
  }

  return functionNode.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    return flattenPropertyAccess(expression).join(".") === propertyPath.join(".");
  });
};

const functionHasStringLiterals = (
  sourceFile: import("ts-morph").SourceFile,
  functionName: string,
  requiredLiterals: readonly string[],
): boolean => {
  const functionNode = sourceFile.getFunction(functionName);
  if (!functionNode) {
    return false;
  }

  const literals = new Set(functionNode.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()));
  return requiredLiterals.every((literal) => literals.has(literal));
};

const variableInitializerReferencesIdentifier = (
  functionNode: import("ts-morph").FunctionDeclaration,
  variableName: string,
  identifierName: string,
): boolean => {
  const declaration = functionNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((candidate) => candidate.getName() === variableName);
  const initializer = declaration?.getInitializer();
  return !!initializer
    && initializer.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
};

const hasTerminalPayloadRefsRelay = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const resolverNode = sourceFile.getFunction("resolvePayloadRefs");
  const relayBuilderNode = sourceFile.getFunction("buildRuntimeRelayEvent");
  return !!resolverNode
    && !!relayBuilderNode
    && functionHasPropertyAccessPath(sourceFile, "resolvePayloadRefs", ["payload", "refs"])
    && variableInitializerReferencesIdentifier(resolverNode, "payloadRefs", "payload")
    && relayBuilderNode.getText().includes("refs: resolvePayloadRefs(payload)");
};

const hasTerminalDedupeResolverShape = (dedupeResolver: import("ts-morph").FunctionDeclaration): boolean => (
  dedupeResolver.getText().includes("runtimeCallId")
  && dedupeResolver.getText().includes("eventType")
  && dedupeResolver.getText().includes("implementationStatus")
  && dedupeResolver.getText().includes("diagnosticPayloadRef")
);

const hasTerminalDedupeListenerShape = (
  listener: import("ts-morph").FunctionDeclaration,
  sourceText: string,
): boolean => (
  sourceText.includes("MAX_TERMINAL_DEDUPE_KEYS")
  && listener.getText().includes("mirroredRuntimeDedupeKeys")
  && (
    listener.getText().includes('eventType.startsWith("AI_")')
    || (
      sourceText.includes('eventType.startsWith("AI_")')
      && listener.getText().includes("shouldSkipStructuredTerminalLogEntry(logEntry, level, mirroredRuntimeDedupeKeys)")
    )
  )
);

const hasBoundedAiDebugTerminalDedupe = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const listener = sourceFile.getFunction("createStructuredTerminalLogListener");
  const dedupeResolver = sourceFile.getFunction("resolveTerminalDedupeKey");
  if (!listener || !dedupeResolver) {
    return false;
  }

  return hasTerminalDedupeResolverShape(dedupeResolver) && hasTerminalDedupeListenerShape(listener, sourceFile.getFullText());
};

export const collectTerminalRelayFinding = (project: import("ts-morph").Project): Finding[] => {
  const terminalSource = getScriptSource(project, TERMINAL_STRUCTURED_LOG_PATH);
  const localTerminalSource = getSourceFileOrThrow(project, "src/lib/local-runtime/structured-log-terminal.ts");
  const payloadSource = getSourceFileOrThrow(project, STRUCTURED_LOG_PAYLOAD_PATH);
  const payloadFields = ["runId", "ownerResponsible", "actionableMessage"].every((fieldName) => hasObjectProperty(payloadSource, fieldName));
  const terminalFields = ["runId", "ownerResponsible", "actionableMessage", "traceId", "selectedMapId", "activationSnapshotRef"].every((fieldName) => hasObjectProperty(terminalSource, fieldName));
  const terminalDiagnosticFields = [
    "capabilityCallId",
    "childCapabilityId",
    "implementationStatus",
    "errorKind",
    "runtimeCallId",
    "diagnosticPayloadRef",
    "promptContractId",
    "outputSchemaRef",
  ].every((fieldName) => hasObjectProperty(terminalSource, fieldName));

  return payloadFields && terminalFields && terminalDiagnosticFields && hasTerminalPayloadRefsRelay(terminalSource) && hasBoundedAiDebugTerminalDedupe(localTerminalSource)
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_COMMAND_FLOW, file: TERMINAL_STRUCTURED_LOG_PATH, line: 1, severity: "fatal", message: "Terminal structured runtime relay must preserve runId, ownerResponsible, actionableMessage, traceId, selectedMapId, activationSnapshotRef, payload refs, AI runtime diagnostic fields, and bounded AI debug terminal de-duplication." })];
};
