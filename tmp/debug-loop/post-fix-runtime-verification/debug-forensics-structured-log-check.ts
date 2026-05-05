import { Project, Node, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../../scripts/audit/core/paths.js";
import { flattenPropertyAccess, hasCallExpression } from "../../../scripts/audit/domains/_shared/ast-helpers.js";
import { hasLiteralTextFragment, hasStringLiteral } from "../../../scripts/audit/domains/_shared/ast-literal-queries.js";

const project = new Project({
  tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

const boundarySource = project.getSourceFileOrThrow(pathFromRepoRoot("src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts"));
const abilityGroupSource = project.getSourceFileOrThrow(pathFromRepoRoot("src/capabilities/forensics-persistence/ability-group.ts"));
const workbenchSource = project.getSourceFileOrThrow(pathFromRepoRoot("src/lib/local-runtime/workbench-persistence-runtime.ts"));

const isLiteralValue = (node, value) => {
  return (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    && node.getLiteralText() === value;
};

const matchesStatusComparison = (expression, operatorKind, literal) => {
  if (expression.getOperatorToken().getKind() !== operatorKind) {
    return false;
  }

  const leftPath = flattenPropertyAccess(expression.getLeft()).join(".");
  const rightPath = flattenPropertyAccess(expression.getRight()).join(".");

  return (leftPath === "result.status" && isLiteralValue(expression.getRight(), literal))
    || (rightPath === "result.status" && isLiteralValue(expression.getLeft(), literal));
};

const hasBoundaryEventCall = (sourceFile, eventType, status) => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "buildBoundaryEvent") {
      return false;
    }

    const [, eventArgument, statusArgument] = callExpression.getArguments();
    return isLiteralValue(eventArgument, eventType) && isLiteralValue(statusArgument, status);
  });
};

const hasWrittenBoundaryFailureOnlyGate = (sourceFile) => {
  const emitWritten = sourceFile.getFunction("emitForensicsRecordWritten");
  if (!emitWritten) {
    return false;
  }

  const comparisons = emitWritten.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const hasFailedGate = comparisons.some((expression) => matchesStatusComparison(expression, SyntaxKind.EqualsEqualsEqualsToken, "failed"));
  const hasSuccessOnlyGate = comparisons.some((expression) => {
    return matchesStatusComparison(expression, SyntaxKind.ExclamationEqualsEqualsToken, "success")
      || matchesStatusComparison(expression, SyntaxKind.EqualsEqualsEqualsToken, "success");
  });

  return { hasFailedGate, hasSuccessOnlyGate };
};

const hasPersistedBoundaryEventEmitter = (sourceFile) => {
  const emitterDeclaration = sourceFile.getVariableDeclaration("boundaryEventEmitter");
  const emitterObject = emitterDeclaration?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  if (!emitterObject) {
    return false;
  }

  const emitRuntimeEventProperty = emitterObject.getProperty("emitRuntimeEvent");
  if (!emitRuntimeEventProperty || !Node.isPropertyAssignment(emitRuntimeEventProperty)) {
    return false;
  }

  const initializer = emitRuntimeEventProperty.getInitializer();
  if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) {
    return false;
  }

  return initializer.getDescendantsOfKind(SyntaxKind.CallExpression).map((callExpression) => flattenPropertyAccess(callExpression.getExpression()).join("."));
};

const hasBoundaryEmitterAbilityGroupWiring = (sourceFile) => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).map((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "createForensicsPersistenceAbilityGroup") {
      return null;
    }

    const [configuration] = callExpression.getArguments();
    if (!configuration || !Node.isObjectLiteralExpression(configuration)) {
      return null;
    }

    const structuredLogBusProperty = configuration.getProperty("structuredLogBus");
    if (!structuredLogBusProperty || !Node.isPropertyAssignment(structuredLogBusProperty)) {
      return null;
    }

    const initializer = structuredLogBusProperty.getInitializer();
    return Node.isIdentifier(initializer) ? initializer.getText() : initializer?.getText();
  });
};

console.log(JSON.stringify({
  hasBoundaryEvents: hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED") && hasStringLiteral(boundarySource, "FORENSICS_RECORD_WRITTEN"),
  requestedCall: hasBoundaryEventCall(boundarySource, "FORENSICS_RECORD_WRITE_REQUESTED", "started"),
  writtenCall: hasBoundaryEventCall(boundarySource, "FORENSICS_RECORD_WRITTEN", "success"),
  abilityRequested: hasCallExpression(abilityGroupSource, "emitForensicsRecordWriteRequested"),
  abilityWritten: hasCallExpression(abilityGroupSource, "emitForensicsRecordWritten"),
  persistedBoundaryEmitterCalls: hasPersistedBoundaryEventEmitter(workbenchSource),
  boundaryEmitterAbilityGroupWiring: hasBoundaryEmitterAbilityGroupWiring(workbenchSource),
  writtenGate: hasWrittenBoundaryFailureOnlyGate(boundarySource),
  hasRecordTypeFragment: hasLiteralTextFragment(boundarySource, "recordType="),
}, null, 2));
