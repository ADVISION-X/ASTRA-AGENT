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
  const functionNode = sourceFile.getFunction("createRuntimePayloadRelay");
  return !!functionNode
    && functionHasPropertyAccessPath(sourceFile, "createRuntimePayloadRelay", ["payload", "refs"])
    && variableInitializerReferencesIdentifier(functionNode, "refs", "payloadRefs");
};

export const collectTerminalRelayFinding = (project: import("ts-morph").Project): Finding[] => {
  const terminalSource = getScriptSource(project, TERMINAL_STRUCTURED_LOG_PATH);
  const payloadSource = getSourceFileOrThrow(project, STRUCTURED_LOG_PAYLOAD_PATH);
  const payloadFields = ["runId", "ownerResponsible", "actionableMessage"].every((fieldName) => hasObjectProperty(payloadSource, fieldName));
  const terminalFields = ["runId", "ownerResponsible", "actionableMessage", "traceId", "selectedMapId", "activationSnapshotRef"].every((fieldName) => hasObjectProperty(terminalSource, fieldName));
  const terminalDiagnosticFields = functionHasStringLiterals(terminalSource, "renderEvent", [
    "capabilityCallId",
    "childCapabilityId",
    "implementationStatus",
    "errorKind",
    "runtimeCallId",
    "diagnosticPayloadRef",
    "promptContractId",
    "outputSchemaRef",
  ]);

  return payloadFields && terminalFields && terminalDiagnosticFields && hasTerminalPayloadRefsRelay(terminalSource)
    ? []
    : [createFinding({ lawId: LAW_STRUCTURED_LOGGING_COMMAND_FLOW, file: TERMINAL_STRUCTURED_LOG_PATH, line: 1, severity: "fatal", message: "Terminal structured runtime relay must preserve runId, ownerResponsible, actionableMessage, traceId, selectedMapId, activationSnapshotRef, payload refs, and AI runtime diagnostic fields for blocking command/runtime events." })];
};
