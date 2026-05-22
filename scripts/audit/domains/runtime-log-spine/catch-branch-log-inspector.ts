import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { blockHasAuthorizedLogCall, isFailureReturn, isPotentialFailureThrow, nearestBlock } from "./ast/ast-control-flow-utils.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { hasRuntimeLogSignal, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const isInspectableRepoPath = (repoPath: string): boolean => isRuntimeLogLawSourcePath(repoPath);

const appendCatchClauseFindings = (findings: RuntimeLogSpineFinding[], sourceFile: SourceFile, repoPath: string): void => {
  for (const catchClause of sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause)) {
    if (blockHasAuthorizedLogCall(catchClause.getBlock(), repoPath)) continue;
    findings.push({
      checkId: "runtime-log-spine/catch-branch-log",
      lawId: RuntimeLogSpineLaw.NO_SILENT_BRANCH,
      file: repoPath,
      line: catchClause.getStartLineNumber(),
      severity: "fatal",
      message: "catch branch has no structured runtime log",
      hint: "Emit a failed/review_required event with failureClass, reason, stageName and recoveryPolicy before returning or throwing.",
    });
  }
};

const appendFailureReturnFindings = (findings: RuntimeLogSpineFinding[], sourceFile: SourceFile, repoPath: string): void => {
  for (const returnStatement of sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    if (!isFailureReturn(returnStatement)) continue;
    const block = nearestBlock(returnStatement);
    if (block && blockHasAuthorizedLogCall(block, repoPath)) continue;
    findings.push({
      checkId: "runtime-log-spine/failure-return-log",
      lawId: RuntimeLogSpineLaw.NO_SILENT_BRANCH,
      file: repoPath,
      line: returnStatement.getStartLineNumber(),
      severity: "fatal",
      message: "control-flow failure branch has no proven structured log",
      hint: "Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating.",
    });
  }
};

const appendFailureThrowFindings = (findings: RuntimeLogSpineFinding[], sourceFile: SourceFile, repoPath: string): void => {
  for (const throwStatement of sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement)) {
    if (!isPotentialFailureThrow(throwStatement)) continue;
    const block = nearestBlock(throwStatement);
    if (block && blockHasAuthorizedLogCall(block, repoPath)) continue;
    findings.push({
      checkId: "runtime-log-spine/throw-log",
      lawId: RuntimeLogSpineLaw.NO_SILENT_BRANCH,
      file: repoPath,
      line: throwStatement.getStartLineNumber(),
      severity: "fatal",
      message: "control-flow failure branch has no proven structured log",
      hint: "Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating.",
    });
  }
};

export const collectCatchBranchLogFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isInspectableRepoPath(repoPath)) continue;
    if (!hasRuntimeLogSignal(sourceFile.getText())) continue;
    inspectedFiles.push(repoPath);
    appendCatchClauseFindings(findings, sourceFile, repoPath);
    appendFailureReturnFindings(findings, sourceFile, repoPath);
    appendFailureThrowFindings(findings, sourceFile, repoPath);
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
