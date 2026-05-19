import { Node, type Project, type SourceFile } from "ts-morph";

import { RUNTIME_LOGGING_CONFIG } from "./config.js";
import { getObjectArg, getPropertyInitializer, isEmitCall } from "./runtime-log-emit.js";
import { extractEventTypeStrings } from "./runtime-log-event-resolution.js";
import { fail, pass } from "./runtime-log-result.js";
import { getSfOrNull, isSourceInDirs } from "./runtime-log-source.js";
import type { RlogCheck } from "./runtime-log-types.js";

const AI_FILES = [
  "src/capabilities/ai/runtime/model-call.ts",
  "src/capabilities/ai/children/visual-mission-judge-once.ts",
  "src/capabilities/ai/ability-group.ts",
  "src/lib/online-ai/gemini-client.ts",
] as const;

const collectConsoleAliases = (sourceFile: SourceFile, file: string, violations: string[]): Set<string> => {
  const aliases = new Set<string>(["console"]);
  sourceFile.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node)) return;
    const initializer = node.getInitializer();
    const nameNode = node.getNameNode();
    if (!initializer || !Node.isIdentifier(nameNode)) return;
    if (Node.isIdentifier(initializer) && initializer.getText() === "console") {
      aliases.add(nameNode.getText());
      violations.push(`${file}:${node.getStartLineNumber()} console alias`);
    }
    if (Node.isPropertyAccessExpression(initializer) && initializer.getExpression().getText() === "console") {
      aliases.add(nameNode.getText());
      violations.push(`${file}:${node.getStartLineNumber()} console method alias`);
    }
  });
  return aliases;
};

const collectConsoleCalls = (sourceFile: SourceFile, aliases: Set<string>, file: string): string[] => {
  const violations: string[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (Node.isIdentifier(expression) && aliases.has(expression.getText()) && expression.getText() !== "console") {
      violations.push(`${file}:${node.getStartLineNumber()} console alias call`);
    }
    if (!Node.isPropertyAccessExpression(expression)) return;
    if (aliases.has(expression.getExpression().getText())) violations.push(`${file}:${node.getStartLineNumber()} console call`);
  });
  return violations;
};

const checkConsoleInAiFiles = (project: Project): RlogCheck => {
  const violations: string[] = [];
  for (const file of AI_FILES) {
    const sourceFile = getSfOrNull(project, file);
    if (!sourceFile) continue;
    const aliases = collectConsoleAliases(sourceFile, file, violations);
    violations.push(...collectConsoleCalls(sourceFile, aliases, file));
  }
  if (violations.length > 0) return fail("RLOG-AST-004", "No console aliases or calls in AI files?", violations.slice(0, 4).join(" | "));
  return pass("RLOG-AST-004", "No console aliases or calls in AI files?", "No console calls in AI files.");
};

const collectAiEmitEventTypes = (project: Project): Set<string> => {
  const eventTypes = new Set<string>();
  const dirs = [...RUNTIME_LOGGING_CONFIG.aiSourcePaths, "src/lib/runtime-logs"];
  for (const sourceFile of project.getSourceFiles()) {
    if (!isSourceInDirs(sourceFile, dirs)) continue;
    sourceFile.forEachDescendant((node) => {
      if (!isEmitCall(node)) return;
      const initializer = getObjectArg(node) ? getPropertyInitializer(getObjectArg(node)!, "eventType") : undefined;
      if (initializer) extractEventTypeStrings(initializer, eventTypes);
    });
  }
  return eventTypes;
};

const checkAiFourPieceEmitSites = (project: Project): RlogCheck => {
  const found = collectAiEmitEventTypes(project);
  const missing = RUNTIME_LOGGING_CONFIG.aiRequiredEventTypes.filter((eventType) => !found.has(eventType));
  if (missing.length > 0) return fail("RLOG-AST-006", "AI four-piece events have emit call sites?", `Missing: ${missing.join(", ")}`);
  return pass("RLOG-AST-006", "AI four-piece events have emit call sites?", "AI four-piece emit sites exist.");
};

const randomUuidNames = (sourceFile: SourceFile): Set<string> => {
  const names = new Set<string>();
  for (const importDecl of sourceFile.getImportDeclarations()) {
    if (!["node:crypto", "crypto"].includes(importDecl.getModuleSpecifierValue())) continue;
    for (const namedImport of importDecl.getNamedImports()) {
      if (namedImport.getName() === "randomUUID") names.add(namedImport.getAliasNode()?.getText() ?? "randomUUID");
    }
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) names.add(`${defaultImport.getText()}.randomUUID`);
  }
  return names;
};

const callsRandomUuid = (node: Node, names: Set<string>): boolean => {
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    if (Node.isIdentifier(callee)) return names.has(callee.getText());
    if (Node.isPropertyAccessExpression(callee)) return names.has(callee.getText());
  }
  if (Node.isBinaryExpression(node)) return callsRandomUuid(node.getLeft(), names) || callsRandomUuid(node.getRight(), names);
  if (Node.isConditionalExpression(node)) return callsRandomUuid(node.getWhenTrue(), names) || callsRandomUuid(node.getWhenFalse(), names);
  return false;
};

const checkNoRandomUuidAsTraceId = (project: Project): RlogCheck => {
  const violations: string[] = [];
  for (const file of AI_FILES) {
    const sourceFile = getSfOrNull(project, file);
    if (!sourceFile) continue;
    const names = randomUuidNames(sourceFile);
    sourceFile.forEachDescendant((node) => {
      if (!isEmitCall(node)) return;
      const objectArg = getObjectArg(node);
      const traceId = objectArg ? getPropertyInitializer(objectArg, "traceId") : undefined;
      if (traceId && callsRandomUuid(traceId, names)) violations.push(`${file}:${node.getStartLineNumber()} traceId uses randomUUID`);
    });
  }
  if (violations.length > 0) return fail("RLOG-AST-007", "traceId never comes from randomUUID?", violations.join(" | "));
  return pass("RLOG-AST-007", "traceId never comes from randomUUID?", "No randomUUID traceId source found.");
};

const checkRuntimeLoggerInjection = (project: Project): RlogCheck => {
  const sourceFile = getSfOrNull(project, "src/lib/local-runtime/workbench-assembly.ts");
  let found = false;
  sourceFile?.forEachDescendant((node) => {
    if (!Node.isCallExpression(node) || found) return;
    const expression = node.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "createConfiguredAiAbilityGroup") return;
    const objectArg = getObjectArg(node);
    found = Boolean(objectArg?.getText().includes("runtimeLogger"));
  });
  if (!found) return fail("RLOG-AST-008", "runtimeLogger is injected into AI ability group?", "runtimeLogger argument missing.");
  return pass("RLOG-AST-008", "runtimeLogger is injected into AI ability group?", "runtimeLogger injection exists.");
};

export const runAiRuntimeLogChecks = (project: Project): RlogCheck[] => [
  checkConsoleInAiFiles(project),
  checkAiFourPieceEmitSites(project),
  checkNoRandomUuidAsTraceId(project),
  checkRuntimeLoggerInjection(project),
];
