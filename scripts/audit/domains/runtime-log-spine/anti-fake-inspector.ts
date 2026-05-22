import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import type { RuntimeLogSemanticMetrics } from "./semantic-metrics-inspector.js";

const governedInspectorPattern = /^scripts\/audit\/domains\/(?:runtime-log-spine|facebook-product-video-mining-log-coverage)\/inspector\.ts$/u;

type AntiFakeSnapshot = {
  semanticMetrics: RuntimeLogSemanticMetrics;
  stageCoveragePercent: number;
  stagePairViolationCount: number;
};

const pushSemanticFinding = (
  findings: RuntimeLogSpineFinding[],
  checkId: string,
  message: string,
  hint: string,
): void => {
  findings.push({
    checkId,
    lawId: RuntimeLogSpineLaw.COVERAGE_REPORT,
    file: "scripts/audit/domains/runtime-log-spine/inspector.ts",
    line: 1,
    severity: "fatal",
    message,
    hint,
  });
};

const appendStageCountContradiction = (
  findings: RuntimeLogSpineFinding[],
  snapshot: AntiFakeSnapshot,
): void => {
  if (snapshot.semanticMetrics.stageStartCount > 0 && snapshot.semanticMetrics.stageTerminalCount === 0) {
    pushSemanticFinding(
      findings,
      "runtime-log-spine/anti-fake-stage-counts",
      "runtime-log report counts are semantically contradictory",
      "Stage coverage cannot report started stages without semantic terminal sites. Derive stage counts from AST-resolved start/terminal calls instead of file totals or finding totals.",
    );
  }
};

const appendStageCoverageContradiction = (
  findings: RuntimeLogSpineFinding[],
  snapshot: AntiFakeSnapshot,
): void => {
  if (snapshot.stageCoveragePercent === 100 && snapshot.stagePairViolationCount > 0) {
    pushSemanticFinding(
      findings,
      "runtime-log-spine/anti-fake-stage-coverage",
      "runtime-log report claims perfect coverage while pair violations still exist",
      "Coverage summary must be derived from the same semantic pair findings and cannot report 100% while violations remain.",
    );
  }
};

const appendFailureCountContradiction = (
  findings: RuntimeLogSpineFinding[],
  snapshot: AntiFakeSnapshot,
): void => {
  if (
    snapshot.semanticMetrics.failureBranchCount === 0
    && (snapshot.semanticMetrics.catchClauseCount > 0
      || snapshot.semanticMetrics.failureEmitCount > 0
      || snapshot.semanticMetrics.stageFailCount > 0
      || snapshot.semanticMetrics.stageSkipCount > 0
      || snapshot.semanticMetrics.stageReviewRequiredCount > 0)
  ) {
    pushSemanticFinding(
      findings,
      "runtime-log-spine/anti-fake-failure-counts",
      "runtime-log report failure metrics are semantically contradictory",
      "Failure branch counts must include semantic failed/skipped/reviewRequired stage terminals, failure-status emits, and catch/failure control-flow sites.",
    );
  }
};

const appendSemanticContradictionFindings = (
  findings: RuntimeLogSpineFinding[],
  snapshot: AntiFakeSnapshot,
): void => {
  appendStageCountContradiction(findings, snapshot);
  appendStageCoverageContradiction(findings, snapshot);
  appendFailureCountContradiction(findings, snapshot);
};

const collectAntiFakeInspectorFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!governedInspectorPattern.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    const text = sourceFile.getText();
    const hasEmptyFindingsLiteral = /findings\s*:\s*\[\s*\]/u.test(text);
    const hasEmptyInspectedFilesLiteral = /inspectedFiles\s*:\s*\[\s*\]/u.test(text);
    const readsSourceFiles = /getSourceFiles|SourceFile|collect[A-Z]\w+/u.test(text);
    const writesReport = /write[A-Z]\w*Report|reportJson|reportMarkdown/u.test(text);
    const detectionFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => /collect[A-Z]|write[A-Z]|render[A-Z]/u.test(call.getExpression().getText()));

    if ((!readsSourceFiles && detectionFunctions.length === 0) || !writesReport || (hasEmptyFindingsLiteral && hasEmptyInspectedFilesLiteral)) {
      findings.push({
        checkId: "runtime-log-spine/anti-fake-inspector",
        lawId: RuntimeLogSpineLaw.COVERAGE_REPORT,
        file: repoPath,
        line: 1,
        severity: "fatal",
        message: "inspector is a no-op shell returning empty findings and inspectedFiles",
        hint: "Replace no-op inspector with AST/symbol implementation and generated coverage report.",
      });
    }
  }

  return { findings, inspectedFiles };
};

export const collectAntiFakeInspectorFindingsWithSnapshot = (
  context: InspectorContext,
  snapshot: AntiFakeSnapshot,
): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const base = collectAntiFakeInspectorFindings(context);
  const findings = [...base.findings];
  appendSemanticContradictionFindings(findings, snapshot);
  return { findings, inspectedFiles: base.inspectedFiles };
};
