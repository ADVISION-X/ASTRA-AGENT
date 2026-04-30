import { Node, SyntaxKind, type AsExpression, type CallExpression, type SourceFile, type TypeNode } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getNodeLine } from "../../../core/ts-morph.js";
import { collectCommentTokens } from "./purity-comment-analysis.js";
import { hasProductionFakeImport } from "./purity-import-analysis.js";
import { isProductionFakePath } from "./purity-path-rules.js";

const LAW_ID = "GRASSEYE-CODE-PURITY-012-V1";
const FORBIDDEN_DYNAMIC_IMPORT_TOKENS = ["mock", "fake", "fixture", "demo", "bridge", "compat", "legacy"] as const;
const RETIRED_OWNER_PATH_TOKENS = ["features/" + "local-data/", "features/" + "platform-action/"] as const;

const createPurityFinding = (relativePath: string, line: number, message: string, detail?: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: relativePath,
    line,
    severity: "error",
    message,
    ...(detail ? { detail } : {}),
  });

const isAnyOrUnknownTypeNode = (typeNode: TypeNode | undefined): boolean => {
  if (!typeNode) {
    return false;
  }

  if (typeNode.getKind() === SyntaxKind.AnyKeyword || typeNode.getKind() === SyntaxKind.UnknownKeyword) {
    return true;
  }

  if (Node.isParenthesizedTypeNode(typeNode)) {
    return isAnyOrUnknownTypeNode(typeNode.getTypeNode());
  }

  return false;
};

const hasUnknownAsChain = (expression: AsExpression): boolean => {
  const currentTypeNode = expression.getTypeNode();
  if (!isAnyOrUnknownTypeNode(currentTypeNode)) {
    return false;
  }

  let currentExpression = expression.getExpression();
  while (Node.isAsExpression(currentExpression)) {
    if (isAnyOrUnknownTypeNode(currentExpression.getTypeNode())) {
      return true;
    }
    currentExpression = currentExpression.getExpression();
  }

  return currentTypeNode?.getKind() === SyntaxKind.UnknownKeyword;
};

const inspectFakePaths = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  if (!isProductionFakePath(relativePath) && !hasProductionFakeImport(sourceFile)) {
    return;
  }

  findings.push(createPurityFinding(relativePath, 1, "Production source truth must not live under or import fake/mock/demo/fixture paths."));
};

const inspectRetiredOwnerPaths = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  if (relativePath.startsWith("scripts/audit/")) {
    return;
  }

  const stringLikeNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const node of stringLikeNodes) {
    const literalText = node.getLiteralText();
    const retiredPath = RETIRED_OWNER_PATH_TOKENS.find((token) => literalText.includes(token));
    if (!retiredPath) {
      continue;
    }

    findings.push(
      createPurityFinding(
        relativePath,
        getNodeLine(node),
        "Retired owner paths must not survive in active source truth.",
        literalText,
      ),
    );
  }
};

const inspectTypeEscapes = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const anyKeyword of sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)) {
    findings.push(createPurityFinding(relativePath, getNodeLine(anyKeyword), "any is forbidden in active source truth."));
  }

  for (const asExpression of sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression)) {
    if (!hasUnknownAsChain(asExpression) && !isAnyOrUnknownTypeNode(asExpression.getTypeNode())) {
      continue;
    }

    findings.push(
      createPurityFinding(
        relativePath,
        getNodeLine(asExpression),
        "unknown/as or any/as type laundering is forbidden in active source truth.",
      ),
    );
  }
};

const inspectDirectiveEscapes = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const comment of collectCommentTokens(sourceFile)) {
    const text = comment.text.toLowerCase();
    if (text.includes("@ts-ignore") || text.includes("@ts-expect-error") || text.includes("eslint-disable")) {
      findings.push(
        createPurityFinding(relativePath, comment.line, "TypeScript or ESLint suppression directives are forbidden in active source truth.", comment.text),
      );
    }
  }
};

const isRequireCall = (importCall: CallExpression): boolean => {
  const expression = importCall.getExpression();
  return Node.isIdentifier(expression) && expression.getText() === "require";
};

const getDynamicImportLiteralText = (importCall: CallExpression): string | undefined => {
  const importTarget = importCall.getArguments()[0];
  if (!importTarget) {
    return undefined;
  }
  return Node.isStringLiteral(importTarget) || Node.isNoSubstitutionTemplateLiteral(importTarget)
    ? importTarget.getLiteralText().toLowerCase()
    : undefined;
};

const inspectDynamicImportEscape = (importCall: CallExpression, findings: Finding[], relativePath: string): void => {
  const expression = importCall.getExpression();
  if (expression.getKind() !== SyntaxKind.ImportKeyword) {
    return;
  }

  const literalText = getDynamicImportLiteralText(importCall);
  if (literalText && FORBIDDEN_DYNAMIC_IMPORT_TOKENS.some((token) => literalText.includes(token))) {
    findings.push(
      createPurityFinding(
        relativePath,
        getNodeLine(importCall),
        "dynamic import() must not load fake, demo, legacy, bridge, or compatibility paths.",
        literalText,
      ),
    );
  }
};

const inspectRuntimeEscapes = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  for (const importCall of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isRequireCall(importCall)) {
      findings.push(createPurityFinding(relativePath, getNodeLine(importCall), "require() is forbidden in active TypeScript or TSX source truth."));
      continue;
    }
    inspectDynamicImportEscape(importCall, findings, relativePath);
  }
};

export const inspectStructuralPurity = (sourceFile: SourceFile, findings: Finding[], relativePath: string): void => {
  inspectFakePaths(sourceFile, findings, relativePath);
  inspectRetiredOwnerPaths(sourceFile, findings, relativePath);
  inspectTypeEscapes(sourceFile, findings, relativePath);
  inspectDirectiveEscapes(sourceFile, findings, relativePath);
  inspectRuntimeEscapes(sourceFile, findings, relativePath);
};