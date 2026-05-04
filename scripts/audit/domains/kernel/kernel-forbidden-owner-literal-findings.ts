import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

const {
  FORBIDDEN_TOP_LEVEL_OWNER_LITERALS,
  GOVERNED_SURFACES,
  OWNER_LITERAL_PROPERTIES,
  REQUIREMENT_ID_001,
} = kernelInspectionConstants;

const getStringLiteralValue = (node: Node | undefined): string | null => {
  if (!node) {
    return null;
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isAsExpression(node) || Node.isTypeAssertion(node) || Node.isParenthesizedExpression(node)) {
    return getStringLiteralValue(node.getExpression());
  }
  return null;
};

const isGovernedSurface = (relativePath: string): boolean => {
  return GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix));
};

const createForbiddenOwnerLiteralFinding = (relativePath: string, propertyAssignment: Node, propertyName: string, literalValue: string): Finding => {
  return createFinding({
    lawId: REQUIREMENT_ID_001,
    file: relativePath,
    line: getNodeLine(propertyAssignment),
    severity: "fatal",
    message: "Governed source still emits a forbidden top-level owner literal.",
    detail: `${propertyName}=${literalValue}`,
  });
};

const collectSourceFileForbiddenOwnerLiteralFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  const relativePath = toRelativeSourcePath(sourceFile);
  if (!isGovernedSurface(relativePath)) {
    return [];
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).flatMap((propertyAssignment) => {
    const propertyName = propertyAssignment.getName();
    const literalValue = getStringLiteralValue(propertyAssignment.getInitializer());
    if (!OWNER_LITERAL_PROPERTIES.has(propertyName) || !literalValue || !FORBIDDEN_TOP_LEVEL_OWNER_LITERALS.has(literalValue)) {
      return [];
    }

    return [createForbiddenOwnerLiteralFinding(relativePath, propertyAssignment, propertyName, literalValue)];
  });
};

export const collectForbiddenOwnerLiteralFindings = (): Finding[] => {
  return getAuditProject().getSourceFiles().flatMap((sourceFile) => collectSourceFileForbiddenOwnerLiteralFindings(sourceFile));
};