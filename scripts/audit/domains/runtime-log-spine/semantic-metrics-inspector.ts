import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { isFailureReturn, isPotentialFailureThrow } from "./ast/ast-control-flow-utils.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getStringLiteralProperty } from "./ast/ast-object-literal-reader.js";
import { hasRuntimeLogSignal, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

export type RuntimeLogSemanticMetrics = {
  scannedFiles: number;
  emitCallCount: number;
  stageStartCount: number;
  stageTerminalCount: number;
  stageFailCount: number;
  stageSkipCount: number;
  stageReviewRequiredCount: number;
  failureEmitCount: number;
  catchClauseCount: number;
  failureReturnCount: number;
  failureThrowCount: number;
  failureBranchCount: number;
};

const isFailureStatus = (status: string | null): boolean =>
  status !== null && ["failed", "review_required", "skipped"].includes(status);

const buildInitialMetrics = (): RuntimeLogSemanticMetrics => ({
  scannedFiles: 0,
  emitCallCount: 0,
  stageStartCount: 0,
  stageTerminalCount: 0,
  stageFailCount: 0,
  stageSkipCount: 0,
  stageReviewRequiredCount: 0,
  failureEmitCount: 0,
  catchClauseCount: 0,
  failureReturnCount: 0,
  failureThrowCount: 0,
  failureBranchCount: 0,
});

const accumulateEmitMetrics = (metrics: RuntimeLogSemanticMetrics, call: ReturnType<typeof resolveCallsInSourceFile>[number]): boolean => {
  if (call.kind !== "runtime-log-emit" && call.kind !== "event-factory") {
    return false;
  }
  metrics.emitCallCount += 1;
  if (call.objectLiteralArg && isFailureStatus(getStringLiteralProperty(call.objectLiteralArg, "status"))) {
    metrics.failureEmitCount += 1;
  }
  return true;
};

const accumulateStageMetrics = (metrics: RuntimeLogSemanticMetrics, call: ReturnType<typeof resolveCallsInSourceFile>[number]): void => {
  if (call.kind === "stage-start") {
    metrics.stageStartCount += 1;
    return;
  }
  if (call.kind !== "stage-terminal") {
    return;
  }
  metrics.stageTerminalCount += 1;
  if (call.symbolName === "fail") {
    metrics.stageFailCount += 1;
    return;
  }
  if (call.symbolName === "skip") {
    metrics.stageSkipCount += 1;
    return;
  }
  if (call.symbolName === "reviewRequired") {
    metrics.stageReviewRequiredCount += 1;
  }
};

const collectCallMetrics = (sourceFile: SourceFile, repoPath: string, metrics: RuntimeLogSemanticMetrics): void => {
  for (const call of resolveCallsInSourceFile(sourceFile, repoPath)) {
    if (accumulateEmitMetrics(metrics, call)) {
      continue;
    }
    accumulateStageMetrics(metrics, call);
  }
};

export const collectRuntimeLogSemanticMetrics = (context: InspectorContext): {
  inspectedFiles: string[];
  metrics: RuntimeLogSemanticMetrics;
} => {
  const metrics = buildInitialMetrics();
  const inspectedFiles: string[] = [];

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isRuntimeLogLawSourcePath(repoPath)) continue;
    if (!hasRuntimeLogSignal(sourceFile, repoPath)) continue;
    inspectedFiles.push(repoPath);
    metrics.scannedFiles += 1;
    collectCallMetrics(sourceFile, repoPath, metrics);
    metrics.catchClauseCount += sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause).length;
    metrics.failureReturnCount += sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement).filter(isFailureReturn).length;
    metrics.failureThrowCount += sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).filter(isPotentialFailureThrow).length;
  }

  metrics.failureBranchCount = metrics.failureEmitCount
    + metrics.stageFailCount
    + metrics.stageSkipCount
    + metrics.stageReviewRequiredCount
    + metrics.catchClauseCount
    + metrics.failureReturnCount
    + metrics.failureThrowCount;

  return {
    inspectedFiles: inspectedFiles.sort(),
    metrics,
  };
};
