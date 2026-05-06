import path from "node:path";
import { type ArrayLiteralExpression, type CallExpression, type ElementAccessExpression, Node, type Node as MorphNode, type ObjectLiteralExpression, type PropertyAccessExpression, type PropertyAssignment, type ShorthandPropertyAssignment, type SourceFile, SyntaxKind } from "ts-morph";
import { toRepoRelativePath } from "./paths.js";
import type { SourceEvidence } from "./static-clause-coverage-support.js";

const LAW_ID_PATTERN = /^GRASSEYE-[A-Z0-9-]+$/;
const inferCheckKind = (filePath: string): SourceEvidence["checkKind"] => {
  if (filePath.includes("required-shape")) return "required-shape";
  if (filePath.includes("forbidden-shape") || filePath.includes("runtime")) return "forbidden-shape";
  if (filePath.includes("boundary")) return "boundary-attack";
  if (filePath.includes("anti-escape") || filePath.includes("negative-proof")) return "anti-escape";
  return "runtime-proof";
};

const unwrapExpression = (node: MorphNode | undefined): MorphNode | undefined => {
  let current = node;
  while (current) {
    if (Node.isAsExpression(current) || Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    const typeAssertion = current.asKind(SyntaxKind.TypeAssertionExpression);
    if (typeAssertion) {
      current = typeAssertion.getExpression();
      continue;
    }
    const satisfiesExpression = current.asKind(SyntaxKind.SatisfiesExpression);
    if (satisfiesExpression) {
      current = satisfiesExpression.getExpression();
      continue;
    }
    return current;
  }
  return undefined;
};

const getNodeKey = (node: MorphNode): string => `${node.getSourceFile().getFilePath()}:${node.getPos()}:${node.getKind()}`;
const resolveIdentifierInitializer = (node: MorphNode | undefined): MorphNode | undefined => {
  if (!node || !Node.isIdentifier(node)) return undefined;
  const symbol = node.getSymbol()?.getAliasedSymbol() ?? node.getSymbol();
  const declaration = symbol?.getDeclarations()[0];
  return Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const getObjectLiteralPropertyInitializer = (objectLiteral: ObjectLiteralExpression, propertyName: string): MorphNode | undefined => {
  const property = objectLiteral.getProperty(propertyName);
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  if (Node.isShorthandPropertyAssignment(property)) return property.getNameNode();
  return undefined;
};

const resolveObjectLiteral = (node: MorphNode | undefined, seen: Set<string>): ObjectLiteralExpression | null => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return null;
  const nodeKey = getNodeKey(unwrapped);
  if (seen.has(nodeKey)) return null;
  if (Node.isObjectLiteralExpression(unwrapped)) return unwrapped;
  seen.add(nodeKey);
  return resolveObjectLiteral(resolveIdentifierInitializer(unwrapped), seen);
};

const resolveArrayPropertyLiteral = (propertyAccess: PropertyAccessExpression, seen: Set<string>): ArrayLiteralExpression | null => {
  const objectLiteral = resolveObjectLiteral(propertyAccess.getExpression(), seen);
  return objectLiteral ? resolveArrayLiteral(getObjectLiteralPropertyInitializer(objectLiteral, propertyAccess.getName()), seen) : null;
};

const resolveArrayLiteral = (node: MorphNode | undefined, seen: Set<string>): ArrayLiteralExpression | null => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return null;
  const nodeKey = getNodeKey(unwrapped);
  if (seen.has(nodeKey)) return null;
  if (Node.isArrayLiteralExpression(unwrapped)) return unwrapped;
  seen.add(nodeKey);
  return Node.isPropertyAccessExpression(unwrapped)
    ? resolveArrayPropertyLiteral(unwrapped, seen)
    : resolveArrayLiteral(resolveIdentifierInitializer(unwrapped), seen);
};

const resolveIndexedArrayElement = (elementAccess: ElementAccessExpression, seen: Set<string>): string | null => {
  const argumentExpression = unwrapExpression(elementAccess.getArgumentExpression());
  if (!argumentExpression || !Node.isNumericLiteral(argumentExpression)) return null;
  const arrayLiteral = resolveArrayLiteral(elementAccess.getExpression(), seen);
  if (!arrayLiteral) return null;
  const index = Number.parseInt(argumentExpression.getLiteralText(), 10);
  return resolveStringLiteral(arrayLiteral.getElements()[index], seen);
};

const resolveObjectPropertyString = (elementAccess: ElementAccessExpression, seen: Set<string>): string | null => {
  const propertyName = resolveStringLiteral(elementAccess.getArgumentExpression(), seen);
  if (!propertyName) return null;
  const objectLiteral = resolveObjectLiteral(elementAccess.getExpression(), seen);
  if (!objectLiteral) return null;
  return resolveStringLiteral(getObjectLiteralPropertyInitializer(objectLiteral, propertyName), seen);
};

const resolveElementAccessString = (elementAccess: ElementAccessExpression, seen: Set<string>): string | null => {
  return resolveIndexedArrayElement(elementAccess, seen) ?? resolveObjectPropertyString(elementAccess, seen);
};

const getResolvableExpression = (node: MorphNode | undefined, seen: Set<string>): MorphNode | null => {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return null;
  const nodeKey = getNodeKey(unwrapped);
  if (seen.has(nodeKey)) return null;
  seen.add(nodeKey);
  return unwrapped;
};

const resolvePropertyAccessString = (propertyAccess: PropertyAccessExpression, seen: Set<string>): string | null => {
  const objectLiteral = resolveObjectLiteral(propertyAccess.getExpression(), seen);
  return objectLiteral ? resolveStringLiteral(getObjectLiteralPropertyInitializer(objectLiteral, propertyAccess.getName()), seen) : null;
};

const resolveExpressionString = (node: MorphNode, seen: Set<string>): string | null => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  if (Node.isIdentifier(node)) return resolveStringLiteral(resolveIdentifierInitializer(node), seen);
  if (Node.isPropertyAccessExpression(node)) return resolvePropertyAccessString(node, seen);
  if (Node.isElementAccessExpression(node)) return resolveElementAccessString(node, seen);
  return null;
};

const resolveStringLiteral = (node: MorphNode | undefined, seen: Set<string> = new Set()): string | null => {
  const resolvableExpression = getResolvableExpression(node, seen);
  return resolvableExpression ? resolveExpressionString(resolvableExpression, seen) : null;
};

const getEnclosingFunctionName = (node: MorphNode): string => {
  const functionNode = node.getFirstAncestor((ancestor) => {
    return Node.isFunctionDeclaration(ancestor)
      || Node.isMethodDeclaration(ancestor)
      || Node.isArrowFunction(ancestor)
      || Node.isFunctionExpression(ancestor);
  });
  if (!functionNode) return "module-scope";
  if (Node.isFunctionDeclaration(functionNode) || Node.isMethodDeclaration(functionNode)) {
    return functionNode.getName() ?? "anonymous";
  }
  const variableDeclaration = functionNode.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return variableDeclaration?.getName() ?? "anonymous";
};

const appendDeclaredLawIds = (literals: readonly MorphNode[], lawIds: Set<string>) => {
  for (const literal of literals) {
    if (!Node.isStringLiteral(literal) && !Node.isNoSubstitutionTemplateLiteral(literal)) continue;
    const value = literal.getLiteralText();
    if (LAW_ID_PATTERN.test(value)) lawIds.add(value);
  }
};

const appendResolvedLawIds = (sourceFile: SourceFile, kind: SyntaxKind, lawIds: Set<string>) => {
  for (const expression of sourceFile.getDescendantsOfKind(kind)) {
    const value = resolveStringLiteral(expression);
    if (value && LAW_ID_PATTERN.test(value)) lawIds.add(value);
  }
};

const collectDeclaredLawIds = (sourceFile: SourceFile): string[] => {
  const lawIds = new Set<string>();
  appendDeclaredLawIds(sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral), lawIds);
  appendDeclaredLawIds(sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral), lawIds);
  appendResolvedLawIds(sourceFile, SyntaxKind.ElementAccessExpression, lawIds);
  appendResolvedLawIds(sourceFile, SyntaxKind.PropertyAccessExpression, lawIds);
  return [...lawIds];
};

const appendEvidence = (evidenceByLaw: Map<string, SourceEvidence[]>, lawId: string, evidence: SourceEvidence) => {
  const existing = evidenceByLaw.get(lawId) ?? [];
  evidenceByLaw.set(lawId, [...existing, evidence]);
};

const isLawIdProperty = (property: MorphNode | undefined): property is PropertyAssignment | ShorthandPropertyAssignment => {
  return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property);
};

const getLawIdPropertyInitializer = (property: PropertyAssignment | ShorthandPropertyAssignment) => {
  return Node.isPropertyAssignment(property) ? property.getInitializer() : property.getNameNode();
};

const getLawIdCarrierArgument = (callExpression: CallExpression): ObjectLiteralExpression | null => {
  for (const argument of callExpression.getArguments()) {
    if (!Node.isObjectLiteralExpression(argument)) continue;
    const lawIdProperty = argument.getProperty("lawId");
    if (isLawIdProperty(lawIdProperty)) return argument;
  }
  return null;
};

const buildSourceEvidence = (sourcePath: string, callExpression: CallExpression): SourceEvidence => {
  const functionName = getEnclosingFunctionName(callExpression);
  return {
    checkPhase: path.basename(sourcePath, ".ts"),
    checkFunction: functionName,
    sourceFile: sourcePath,
    targetSymbol: functionName,
    checkKind: inferCheckKind(sourcePath),
  };
};

const getLawIdProperty = (argument: ObjectLiteralExpression) => {
  const lawIdProperty = argument.getProperty("lawId");
  return isLawIdProperty(lawIdProperty) ? lawIdProperty : null;
};

const recordCallEvidence = (
  callExpression: CallExpression,
  sourcePath: string,
  evidenceByLaw: Map<string, SourceEvidence[]>,
  dynamicEvidenceTemplates: SourceEvidence[],
) => {
  const argument = getLawIdCarrierArgument(callExpression);
  if (!argument) return;
  const lawIdProperty = getLawIdProperty(argument);
  if (!lawIdProperty) return;
  const evidence = buildSourceEvidence(sourcePath, callExpression);
  const lawId = resolveStringLiteral(getLawIdPropertyInitializer(lawIdProperty));
  if (!lawId) {
    dynamicEvidenceTemplates.push(evidence);
    return;
  }
  appendEvidence(evidenceByLaw, lawId, evidence);
};

const appendDynamicEvidenceFallback = (
  evidenceByLaw: Map<string, SourceEvidence[]>,
  declaredLawIds: string[],
  dynamicEvidenceTemplates: SourceEvidence[],
) => {
  const fallbackTemplate = dynamicEvidenceTemplates[0];
  if (!fallbackTemplate) return;
  for (const lawId of declaredLawIds) {
    if (!evidenceByLaw.has(lawId)) appendEvidence(evidenceByLaw, lawId, fallbackTemplate);
  }
};

const collectLawEvidence = (sourceFile: SourceFile): Map<string, SourceEvidence[]> => {
  const evidenceByLaw = new Map<string, SourceEvidence[]>();
  const sourcePath = toRepoRelativePath(sourceFile.getFilePath());
  const dynamicEvidenceTemplates: SourceEvidence[] = [];
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    recordCallEvidence(callExpression, sourcePath, evidenceByLaw, dynamicEvidenceTemplates);
  }
  appendDynamicEvidenceFallback(evidenceByLaw, collectDeclaredLawIds(sourceFile), dynamicEvidenceTemplates);
  return evidenceByLaw;
};

export const mergeEvidenceMaps = (files: SourceFile[]): Map<string, SourceEvidence[]> => {
  const evidenceByLaw = new Map<string, SourceEvidence[]>();
  for (const sourceFile of files) {
    const fileEvidence = collectLawEvidence(sourceFile);
    for (const [lawId, evidence] of fileEvidence.entries()) {
      const existing = evidenceByLaw.get(lawId) ?? [];
      evidenceByLaw.set(lawId, [...existing, ...evidence]);
    }
  }
  return evidenceByLaw;
};