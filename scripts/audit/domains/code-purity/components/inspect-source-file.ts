import path from "node:path";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getExpressionPath, getNodeLine } from "../../../core/ts-morph.js";
import { collectCommentTokens, hasTodoHygiene, isCommentedOutCode, isTodoComment } from "./purity-comment-analysis.js";
import { fileLineLimit } from "./purity-constants.js";
import { getFunctionMetrics, getFunctionName, getFunctionNodes, getLogicalLineCount, isExportedFunction } from "./purity-function-analysis.js";

const inspectFileLength = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  const physicalLines = sourceFile.getEndLineNumber();
  const maxLines = fileLineLimit(relativePath);
  if (physicalLines <= maxLines) {
    return;
  }

  findings.push(
    createFinding({
      lawId: "GRASSEYE-CODE-PURITY-001-V1",
      file: relativePath,
      line: 1,
      severity: "error",
      message: `Source file exceeds the active code-purity line limit of ${maxLines}.`,
      detail: `physicalLines=${physicalLines}`,
      hint: "Split by capability owner instead of expanding the file.",
    }),
  );
};

const pushFunctionFinding = (
  findings: Finding[],
  input: { relativePath: string; line: number; functionName: string; message: string; detail: string },
): void => {
  findings.push(
    createFinding({
      lawId: "GRASSEYE-CODE-PURITY-002-V1",
      file: input.relativePath,
      line: input.line,
      severity: "error",
      message: `Function ${input.functionName} ${input.message}`,
      detail: input.detail,
    }),
  );
};

const inspectFunctionLength = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const functionNode of getFunctionNodes(sourceFile)) {
    const line = getNodeLine(functionNode);
    const functionName = getFunctionName(functionNode, relativePath);
    const logicalLines = getLogicalLineCount(functionNode);
    const lineLimit = isExportedFunction(functionNode) ? 55 : 40;
    if (logicalLines > lineLimit) {
      pushFunctionFinding(findings, {
        relativePath,
        line,
        functionName,
        message: `exceeds the active logical line limit of ${lineLimit}.`,
        detail: `logicalLines=${logicalLines}`,
      });
    }

    const parameterCount = functionNode.getParameters().length;
    if (parameterCount > 4) {
      pushFunctionFinding(findings, {
        relativePath,
        line,
        functionName,
        message: "exceeds the parameter limit of 4.",
        detail: `parameters=${parameterCount}`,
      });
    }
  }
};

const inspectFunctionComplexity = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const functionNode of getFunctionNodes(sourceFile)) {
    const line = getNodeLine(functionNode);
    const functionName = getFunctionName(functionNode, relativePath);
    const metrics = getFunctionMetrics(functionNode);
    if (metrics.maxDepth > 3) {
      pushFunctionFinding(findings, {
        relativePath,
        line,
        functionName,
        message: "exceeds the maximum nesting depth of 3.",
        detail: `nestingDepth=${metrics.maxDepth}`,
      });
    }

    if (metrics.complexity > 10) {
      pushFunctionFinding(findings, {
        relativePath,
        line,
        functionName,
        message: "exceeds the cyclomatic complexity limit of 10.",
        detail: `cyclomaticComplexity=${metrics.complexity}`,
      });
    }

    if (metrics.cognitive > 15) {
      pushFunctionFinding(findings, {
        relativePath,
        line,
        functionName,
        message: "exceeds the cognitive complexity limit of 15.",
        detail: `cognitiveComplexity=${metrics.cognitive}`,
      });
    }
  }
};

const inspectFunctions = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  inspectFunctionLength(sourceFile, findings, relativePath);
  inspectFunctionComplexity(sourceFile, findings, relativePath);
};

const inspectConsoleScatter = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callPath = getExpressionPath(callExpression.getExpression());
    if (callPath.length === 2 && callPath[0] === "console" && callPath[1] === "log") {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-CODE-PURITY-003-V1",
          file: relativePath,
          line: getNodeLine(callExpression),
          severity: "error",
          message: "console.log debug scatter is forbidden in the active code-purity scope.",
          hint: "Remove the log or route it through a governed logging boundary.",
        }),
      );
    }
  }
};

const inspectCommentCleanup = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const comment of collectCommentTokens(sourceFile)) {
    if (isTodoComment(comment.text) && !hasTodoHygiene(comment.text)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-CODE-PURITY-003-V1",
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
          lawId: "GRASSEYE-CODE-PURITY-003-V1",
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
      lawId: "GRASSEYE-CODE-PURITY-004-V1",
      file: relativePath,
      line: 1,
      severity: "error",
      message: "Compatibility bridge style file naming is forbidden in the active code-purity scope.",
    }),
  );
};

export const inspectSourceFile = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  inspectFileLength(sourceFile, findings, relativePath);
  inspectFunctions(sourceFile, findings, relativePath);
  inspectCleanup(sourceFile, findings, relativePath);
  inspectRefactorDirection(findings, relativePath);
};