import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { hasTypeScriptExtension } from "../../shared/no-regex.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { ALLOWED_CONSOLE_SURFACES } from "./allowed-console-surfaces.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const isExcluded = (repoPath: string): boolean =>
  repoPath.startsWith("scripts/")
  || repoPath.endsWith(".test.ts")
  || repoPath.endsWith(".spec.ts")
  || ALLOWED_CONSOLE_SURFACES.includes(repoPath as (typeof ALLOWED_CONSOLE_SURFACES)[number]);

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
      return repoPath.startsWith("src/") && hasTypeScriptExtension(repoPath) && !isExcluded(repoPath);
    })
    .sort((left, right) => getRepoSourcePath(left).localeCompare(getRepoSourcePath(right)));

  for (const sourceFile of inspectedSourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    for (const call of resolveCallsInSourceFile(sourceFile, repoPath).filter((resolvedCall) => resolvedCall.kind === "console-call")) {
      findings.push({
        checkId: "runtime-log-spine/forbidden-console",
        lawId: RuntimeLogSpineLaw.NO_CONSOLE,
        file: repoPath,
        line: call.line,
        severity: "fatal",
        message: "console escape detected by AST/symbol inspector",
        hint: "Replace console usage or alias with RuntimeLogger.emit / authorized stage logger. Console aliases and destructuring are forbidden.",
      });
    }
  }
  return {
    findings,
    inspectedFiles: inspectedSourceFiles.map(getRepoSourcePath),
    consoleViolationCount: findings.length,
  };
};
