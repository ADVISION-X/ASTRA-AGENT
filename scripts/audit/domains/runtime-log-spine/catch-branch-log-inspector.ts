import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const logProofPattern = /(?:RuntimeLogger\.emit|\.emit\s*\(|stage\.(?:fail|reviewRequired)\s*\(|recoveryLogger|authorizedFailureResultWithLog|logFacebookMiningFlow|logFacebookNavigationDebug|throw\s+)/u;

export const collectCatchBranchLogFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/") || !/\.(?:ts|tsx)$/u.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const catchClause of sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause)) {
      const bodyText = catchClause.getBlock().getText();
      if (logProofPattern.test(bodyText)) continue;
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
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
