import { Node, type Project } from "ts-morph";

import { RUNTIME_LOGGING_CONFIG } from "./config.js";
import { getObjectArg, getPropertyInitializer, hasObjectProperty, isEmitCall, isRuntimeLogEmitCall } from "./runtime-log-emit.js";
import { extractEventTypeStrings } from "./runtime-log-event-resolution.js";
import { fail, pass } from "./runtime-log-result.js";
import { relPath } from "./runtime-log-source.js";
import type { RlogCheck } from "./runtime-log-types.js";

const governedDirs = (): string[] => [
  ...RUNTIME_LOGGING_CONFIG.aiSourcePaths,
  "src/lib/runtime-logs",
  "src/lib/local-runtime",
];

const checkEmitTraceId = (project: Project): RlogCheck => {
  const violations: string[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const path = relPath(sourceFile);
    if (!governedDirs().some((dir) => path === dir || path.startsWith(`${dir}/`))) continue;
    if (path.endsWith(".d.ts")) continue;
    sourceFile.forEachDescendant((node) => {
      if (!isEmitCall(node)) return;
      const objectArg = getObjectArg(node);
      if (objectArg && !hasObjectProperty(objectArg, "traceId")) violations.push(`${path}:${node.getStartLineNumber()} emit missing traceId`);
    });
  }
  if (violations.length > 0) return fail("RLOG-AST-005", "Every emit has traceId?", violations.slice(0, 4).join(" | "));
  return pass("RLOG-AST-005", "Every emit has traceId?", "All governed emit calls carry traceId.");
};

const collectBoundaryEventTypes = (project: Project): Set<string> => {
  const found = new Set<string>();
  for (const sourceFile of project.getSourceFiles()) {
    const path = relPath(sourceFile);
    if (!path.startsWith("src/") || path.endsWith(".d.ts") || path.endsWith("event-types.ts")) continue;
    sourceFile.forEachDescendant((node) => {
      if (!isRuntimeLogEmitCall(node)) return;
      const objectArg = getObjectArg(node);
      const initializer = objectArg ? getPropertyInitializer(objectArg, "eventType") : undefined;
      if (initializer) extractEventTypeStrings(initializer, found);
    });
  }
  return found;
};

const checkBoundaryEventEmitSites = (project: Project): RlogCheck => {
  const found = collectBoundaryEventTypes(project);
  const missing = RUNTIME_LOGGING_CONFIG.boundaryEventTypes.filter((eventType) => !found.has(eventType));
  if (missing.length > 0) return fail("RLOG-AST-010", "Boundary event types have emit sites?", `Missing: ${missing.join(", ")}`);
  return pass("RLOG-AST-010", "Boundary event types have emit sites?", "Boundary event emit sites exist.");
};

const isTraceGuarded = (node: Node): boolean => {
  let ancestor = node.getParent();
  while (ancestor) {
    if (Node.isIfStatement(ancestor) && ancestor.getExpression().getText().includes("isTraceEnabled")) return true;
    ancestor = ancestor.getParent();
  }
  return false;
};

const hasHeavyToken = (objectArg: Node): boolean => {
  if (!Node.isObjectLiteralExpression(objectArg)) return false;
  return objectArg.getProperties().some((property) =>
    (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
    && (RUNTIME_LOGGING_CONFIG.heavyPayloadTokens as readonly string[]).includes(property.getName()),
  );
};

const checkHeavyPayloadGuards = (project: Project): RlogCheck => {
  const violations: string[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const path = relPath(sourceFile);
    if (!path.startsWith("src/") || path.endsWith(".d.ts")) continue;
    sourceFile.forEachDescendant((node) => {
      if (!isEmitCall(node)) return;
      const objectArg = getObjectArg(node);
      if (objectArg && hasHeavyToken(objectArg) && !isTraceGuarded(node)) {
        violations.push(`${path}:${node.getStartLineNumber()} heavy payload is not trace guarded`);
      }
    });
  }
  if (violations.length > 0) return fail("RLOG-AST-011", "Heavy payload emit fields are TRACE guarded?", violations.slice(0, 3).join(" | "));
  return pass("RLOG-AST-011", "Heavy payload emit fields are TRACE guarded?", "No unguarded heavy payload emit fields.");
};

export const runRuntimeLogBoundaryChecks = (project: Project): RlogCheck[] => [
  checkEmitTraceId(project),
  checkBoundaryEventEmitSites(project),
  checkHeavyPayloadGuards(project),
];
