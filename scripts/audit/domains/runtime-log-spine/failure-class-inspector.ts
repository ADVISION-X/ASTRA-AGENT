import { SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { readRepoFile } from "./source-read.js";

const requiredClasses = [
  "TRANSIENT_RETRYABLE",
  "SKIPPABLE_ROUND_FAILURE",
  "RECOVERABLE_BROWSER_DRIFT",
  "ACCOUNT_SECURITY_BLOCKER",
  "PLATFORM_RATE_LIMIT",
  "SCHEMA_CONTRACT_VIOLATION",
  "AI_PROVIDER_FAILURE",
  "AI_PARSE_FAILURE",
  "MEDIA_DOWNLOAD_FAILURE",
  "DOM_PROBE_FAILURE",
  "NAVIGATION_FAILURE",
  "ARTIFACT_FAILURE",
  "INTERNAL_BUG",
  "UNKNOWN",
] as const;

const failureContractTokens = ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"] as const;

export const collectFailureClassFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  failureWithoutClassCount: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = ["src/lib/runtime-logs/failure-classes.ts"];
  const failureClasses = readRepoFile("src/lib/runtime-logs/failure-classes.ts");
  if (!failureClasses) {
    findings.push({
      checkId: "runtime-log-spine/failure-class-file",
      lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
      file: "src/lib/runtime-logs/failure-classes.ts",
      line: 1,
      severity: "fatal",
      message: "failure class registry is missing",
      hint: "Create RuntimeFailureClass with the standard classified failure constants.",
    });
  } else {
    for (const className of requiredClasses) {
      if (failureClasses.text.includes(className)) continue;
      findings.push({
        checkId: "runtime-log-spine/failure-class-registry",
        lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
        file: failureClasses.path,
        line: 1,
        severity: "fatal",
        message: `RuntimeFailureClass.${className} is missing`,
        hint: "Use the standard RuntimeFailureClass registry from the law before emitting failed/skipped/review_required events.",
      });
    }
  }

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/") || !/\.(?:ts|tsx)$/u.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const objectLiteral of sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const text = objectLiteral.getText();
      if (!/status\s*:\s*["'](?:failed|review_required|skipped)["']/u.test(text)) continue;
      const missing = failureContractTokens.filter((token) => !text.includes(token));
      if (missing.length === 0) continue;
      findings.push({
        checkId: "runtime-log-spine/failure-class-contract",
        lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
        file: repoPath,
        line: objectLiteral.getStartLineNumber(),
        severity: "fatal",
        message: "failure event is missing failureClass contract",
        hint: `Use RuntimeFailureClass enum and include ${missing.join(", ")}.`,
      });
    }
  }

  return {
    findings,
    inspectedFiles: [...new Set(inspectedFiles)].sort(),
    failureWithoutClassCount: findings.length,
  };
};
