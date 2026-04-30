import path from "node:path";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getExpressionPath, getNodeLine } from "../../../core/ts-morph.js";
import { inspectStructuralPurity } from "./inspect-structural-purity.js";
import { collectCommentTokens, hasTodoHygiene, isCommentedOutCode, isTodoComment } from "./purity-comment-analysis.js";

const inspectConsoleScatter = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callPath = getExpressionPath(callExpression.getExpression());
    if (callPath.length !== 2 || callPath[0] !== "console" || callPath[1] !== "log") {
      continue;
    }

    findings.push(
      createFinding({
        lawId: "GRASSEYE-CODE-PURITY-008-V1",
        file: relativePath,
        line: getNodeLine(callExpression),
        severity: "error",
        message: "console.log debug scatter is forbidden in the active code-purity scope.",
        hint: "Remove the log or route it through a governed logging boundary.",
      }),
    );
  }
};

const inspectCommentCleanup = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const comment of collectCommentTokens(sourceFile)) {
    if (isTodoComment(comment.text) && !hasTodoHygiene(comment.text)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-CODE-PURITY-008-V1",
          file: relativePath,
          line: comment.line,
          severity: "error",
          message: "TODO or FIXME comment is missing owner, reason, or removal condition.",
          detail: comment.text,
        }),
      );
    }

    if (isCommentedOutCode(comment.text, relativePath)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-CODE-PURITY-008-V1",
          file: relativePath,
          line: comment.line,
          severity: "error",
          message: "Commented-out implementation code must be deleted from active source truth.",
          detail: comment.text,
        }),
      );
    }
  }
};

// @ts-ignore
const inspectCleanup = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  inspectConsoleScatter(sourceFile, findings, relativePath);
  inspectCommentCleanup(sourceFile, findings, relativePath);
};

const inspectRefactorDirection = (findings: Finding[], relativePath: string): void => {
  const fileName = path.basename(relativePath).toLowerCase();
  if (!["bridge", "compat", "legacy"].some((fragment) => fileName.includes(fragment))) {
    return;
  }

  findings.push(
    createFinding({
      lawId: "GRASSEYE-CODE-PURITY-009-V1",
      file: relativePath,
      line: 1,
      severity: "error",
      message: "Compatibility bridge style file naming is forbidden in the active code-purity scope.",
    }),
  );
};

export const inspectSourceFile = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  inspectStructuralPurity(sourceFile, findings, relativePath);
  inspectCleanup(sourceFile, findings, relativePath);
  inspectRefactorDirection(findings, relativePath);
};
