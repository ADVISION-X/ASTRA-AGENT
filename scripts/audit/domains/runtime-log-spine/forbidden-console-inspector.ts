import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const bannedMethods = new Set(["log", "error", "warn", "debug", "info"]);

const isExcluded = (repoPath: string): boolean =>
  repoPath.startsWith("scripts/")
  || repoPath.endsWith(".test.ts")
  || repoPath.endsWith(".spec.ts")
  || repoPath === "src/lib/runtime-logs/sinks.ts";

export const collectForbiddenConsoleFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  consoleViolationCount: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedSourceFiles = context.project
    .getSourceFiles()
    .filter((sourceFile) => {
      const repoPath = getRepoSourcePath(sourceFile);
      return repoPath.startsWith("src/") && /\.(?:ts|tsx)$/u.test(repoPath) && !isExcluded(repoPath);
    })
    .sort((left, right) => getRepoSourcePath(left).localeCompare(getRepoSourcePath(right)));

  for (const sourceFile of inspectedSourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = call.getExpression();
      let methodName: string | null = null;
      let isConsole = false;
      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propertyAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        methodName = propertyAccess.getName();
        const receiver = propertyAccess.getExpression().getText();
        isConsole = receiver === "console" || receiver === "globalThis.console";
      } else if (expression.getKind() === SyntaxKind.ElementAccessExpression) {
        const elementAccess = expression.asKindOrThrow(SyntaxKind.ElementAccessExpression);
        const receiver = elementAccess.getExpression().getText();
        methodName = elementAccess.getArgumentExpression()?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? null;
        isConsole = receiver === "console" || receiver === "globalThis.console";
      }
      if (!isConsole || !methodName || !bannedMethods.has(methodName)) continue;
      findings.push({
        checkId: "runtime-log-spine/forbidden-console",
        lawId: RuntimeLogSpineLaw.NO_CONSOLE,
        file: repoPath,
        line: call.getStartLineNumber(),
        severity: "fatal",
        message: "console logging is forbidden in runtime code",
        hint: "Replace console usage with RuntimeLogger.emit or authorized stage logger. Runtime facts must enter Runtime Log Spine.",
      });
    }
  }
  return {
    findings,
    inspectedFiles: inspectedSourceFiles.map(getRepoSourcePath),
    consoleViolationCount: findings.length,
  };
};
