import { Node, SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getPropertyInitializer, isEventTypeFromRegistry } from "./ast/ast-object-literal-reader.js";
import { traceVariableInitializer } from "./ast/ast-symbol-utils.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isAuthorizedRuntimeLogHelperPath, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const isExcluded = (repoPath: string): boolean => repoPath === "src/lib/runtime-logs/event-types.ts";

const isInspectableRepoPath = (repoPath: string): boolean => isRuntimeLogLawSourcePath(repoPath) && !isExcluded(repoPath);

const typeNodeHasRuntimeLogEventType = (node: import("ts-morph").Node | null | undefined): boolean => {
  if (!node) {
    return false;
  }
  if (Node.isTypeReference(node) && node.getTypeName().getText() === "RuntimeLogEventType") {
    return true;
  }
  return node.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === "RuntimeLogEventType");
};

const hasRuntimeLogEventTypeDeclaration = (node: import("ts-morph").Node): boolean =>
  (node.getSymbol()?.getDeclarations() ?? []).some((declaration) => {
    const typeNode = ("getTypeNode" in declaration && typeof declaration.getTypeNode === "function") ? declaration.getTypeNode() : null;
    return typeNodeHasRuntimeLogEventType(typeNode);
  });

const isProvenRegistryEventType = (objectLiteral: import("ts-morph").ObjectLiteralExpression): boolean => {
  const initializer = getPropertyInitializer(objectLiteral, "eventType");
  const isLiteral = Boolean(initializer && Node.isStringLiteral(initializer));
  const isRegistry = isEventTypeFromRegistry(objectLiteral);
  const traced = initializer && Node.isIdentifier(initializer) ? traceVariableInitializer(initializer) : null;
  const tracedRegistry = Boolean(traced && Node.isPropertyAccessExpression(traced) && traced.getExpression().getText() === "RuntimeLogEventType");
  const declarationRegistry = Boolean(initializer && hasRuntimeLogEventTypeDeclaration(initializer));
  return !isLiteral && (isRegistry || tracedRegistry || declarationRegistry);
};

const appendEventTypeRegistryFindings = (findings: RuntimeLogSpineFinding[], sourceFile: import("ts-morph").SourceFile, repoPath: string): void => {
  if (isAuthorizedRuntimeLogHelperPath(repoPath)) {
    return;
  }
  for (const objectLiteral of resolveCallsInSourceFile(sourceFile, repoPath)
    .filter((call) => call.kind === "runtime-log-emit" || call.kind === "event-factory")
    .map((call) => call.objectLiteralArg)
    .filter((objectLiteral): objectLiteral is NonNullable<typeof objectLiteral> => objectLiteral !== undefined)) {
    const eventType = objectLiteral.getProperty("eventType");
    if (!eventType || !Node.isPropertyAssignment(eventType)) continue;
    if (isProvenRegistryEventType(objectLiteral)) continue;
    findings.push({
      checkId: "runtime-log-spine/event-type-registry",
      lawId: RuntimeLogSpineLaw.EVENT_REGISTRY,
      file: repoPath,
      line: eventType.getStartLineNumber(),
      severity: "fatal",
      message: "eventType is not proven to come from RuntimeLogEventType registry",
      hint: "Import RuntimeLogEventType from the runtime log registry and use RuntimeLogEventType.X directly or through a traceable constant.",
    });
  }
};

export const collectEventTypeRegistryFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isInspectableRepoPath(repoPath)) continue;
    inspectedFiles.push(repoPath);
    appendEventTypeRegistryFindings(findings, sourceFile, repoPath);
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
