import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

export { collectRuntimeFailureReasonFindings } from "./runtime-failure-transparency-checks.js";

const hasGovernedFailureStatus = (objectLiteral: ObjectLiteralExpression): boolean => {
  const implementationStatusProperty = objectLiteral.getProperty("implementationStatus");
  if (!implementationStatusProperty || !Node.isPropertyAssignment(implementationStatusProperty)) {
    return false;
  }

  const implementationStatus = implementationStatusProperty.getInitializerIfKind(SyntaxKind.StringLiteral);
  return implementationStatus?.getLiteralText() === "governed_output_rejected";
};

const hasGovernedReviewBranches = (objectLiteral: ObjectLiteralExpression): boolean => {
  const statusProperty = objectLiteral.getProperty("status");
  if (!statusProperty || !Node.isPropertyAssignment(statusProperty)) {
    return false;
  }

  const initializer = statusProperty.getInitializer();
  return Boolean(
    initializer
      && Node.isConditionalExpression(initializer)
      && initializer.getWhenTrue().getText().includes('"review_required"')
      && initializer.getWhenFalse().getText().includes('"failed"'),
  );
};

export function hasGovernedFailureStatusBranch(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    return hasGovernedFailureStatus(objectLiteral) && hasGovernedReviewBranches(objectLiteral);
  });
}
