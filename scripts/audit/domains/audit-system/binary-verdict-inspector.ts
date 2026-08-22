import {
  Node,
  SyntaxKind,
  type CallExpression,
  type PropertySignature,
  type SourceFile,
  type Type,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

type TypePropertyTarget = {
  filePath: string;
  declarationName: string;
  ownerKind: "parameter" | "type";
  propertyNames: readonly string[];
};

type SchemaTarget = {
  filePath: string;
  declarationName: string;
  propertyName: "status" | "finalDecision";
  expectedCount: number;
};

const typePropertyTargets: readonly TypePropertyTarget[] = [
  {
    filePath: "scripts/audit/shared/inspector-check-session.ts",
    declarationName: "InspectorCheckRunReceipt",
    ownerKind: "type",
    propertyNames: ["status"],
  },
  {
    filePath: "scripts/audit/shared/inspector-contracts.ts",
    declarationName: "CompletedReport",
    ownerKind: "type",
    propertyNames: ["status"],
  },
  {
    filePath: "scripts/audit/ci-full-summary.ts",
    declarationName: "StepResult",
    ownerKind: "type",
    propertyNames: ["status"],
  },
  {
    filePath: "scripts/audit/ci-full-summary.ts",
    declarationName: "CiFullOwnerReport",
    ownerKind: "type",
    propertyNames: ["status"],
  },
  {
    filePath: "scripts/audit/ci-full-summary.ts",
    declarationName: "CiFullSummaryInput",
    ownerKind: "type",
    propertyNames: ["status", "finalDecision"],
  },
] as const;

const schemaTargets: readonly SchemaTarget[] = [
  {
    filePath: "scripts/audit/shared/inspector-check-session.ts",
    declarationName: "inspectorCheckRunReceiptSchema",
    propertyName: "status",
    expectedCount: 1,
  },
  {
    filePath: "scripts/audit/ci-audit-plan-runner.ts",
    declarationName: "domainReportSchema",
    propertyName: "status",
    expectedCount: 1,
  },
  {
    filePath: "scripts/audit/ci-audit-plan-runner.ts",
    declarationName: "reportArtifactSchema",
    propertyName: "status",
    expectedCount: 2,
  },
] as const;

const binaryValuesAreExact = (values: readonly string[] | null): boolean =>
  values !== null && values.length === 2 && new Set(values).size === 2
  && values.includes("PASS") && values.includes("FAIL");

const stringLiteralTypeValues = (type: Type): string[] | null => {
  const variants = type.isUnion() ? type.getUnionTypes() : [type];
  if (variants.some((variant) => !variant.isStringLiteral())) return null;
  return variants.map((variant) => String(variant.getLiteralValue()));
};

const namedProperties = (
  source: SourceFile,
  target: TypePropertyTarget,
): PropertySignature[] => {
  if (target.ownerKind === "type") {
    const typeNode = source.getTypeAlias(target.declarationName)?.getTypeNode();
    return typeNode?.getDescendantsOfKind(SyntaxKind.PropertySignature) ?? [];
  }
  const initializer = source.getVariableDeclaration(target.declarationName)?.getInitializer();
  if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) return [];
  const parameterType = initializer.getParameters()[0]?.getTypeNode();
  return parameterType?.getDescendantsOfKind(SyntaxKind.PropertySignature) ?? [];
};

const inspectTypePropertyTarget = (
  source: SourceFile,
  target: TypePropertyTarget,
): string[] => {
  const properties = namedProperties(source, target);
  const errors: string[] = [];
  for (const propertyName of target.propertyNames) {
    const matches = properties.filter((property) => property.getName() === propertyName);
    if (matches.length !== 1) {
      errors.push(`${target.declarationName}.${propertyName} must exist exactly once`);
      continue;
    }
    const typeNode = matches[0]?.getTypeNode();
    const values = typeNode ? stringLiteralTypeValues(typeNode.getType()) : null;
    if (!binaryValuesAreExact(values)) {
      errors.push(`${target.declarationName}.${propertyName}=${JSON.stringify(values)}`);
    }
  }
  return errors;
};

const isZodEnumCall = (call: CallExpression): boolean => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "enum") return false;
  const receiver = expression.getExpression();
  if (!Node.isIdentifier(receiver)) return false;
  return receiver.getSymbol()?.getDeclarations().some((declaration) =>
    Node.isImportSpecifier(declaration)
    && declaration.getImportDeclaration().getModuleSpecifierValue() === "zod") === true;
};

const zodEnumValues = (call: CallExpression): string[] | null => {
  if (!isZodEnumCall(call)) return null;
  const values = call.getArguments()[0];
  if (!values || !Node.isArrayLiteralExpression(values)) return null;
  const elements = values.getElements();
  if (elements.some((element) => !Node.isStringLiteral(element))) return null;
  return elements.map((element) => Node.isStringLiteral(element) ? element.getLiteralValue() : "");
};

const inspectSchemaTarget = (source: SourceFile, target: SchemaTarget): string[] => {
  const initializer = source.getVariableDeclaration(target.declarationName)?.getInitializer();
  if (!initializer) return [`${target.declarationName} is missing`];
  const properties = initializer.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => property.getName() === target.propertyName);
  if (properties.length !== target.expectedCount) {
    return [`${target.declarationName}.${target.propertyName} count=${properties.length}`];
  }
  return properties.flatMap((property) => {
    const call = property.getInitializerIfKind(SyntaxKind.CallExpression);
    const values = call ? zodEnumValues(call) : null;
    return binaryValuesAreExact(values)
      ? []
      : [`${target.declarationName}.${target.propertyName}=${JSON.stringify(values)}`];
  });
};

const sourceFor = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
  filePath: string,
): SourceFile | undefined => {
  inspectedFiles.add(filePath);
  return context.project.getSourceFile(resolveFromRepo(filePath));
};

const pushVerdictFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  errors: readonly string[],
): void => {
  if (errors.length === 0) return;
  findings.push(createFinding({
    checkId: "audit-system/binary-verdict",
    lawId,
    filePath,
    message: `${filePath} executable verdict domains must each equal exactly PASS | FAIL.`,
    evidence: errors.join("; "),
  }));
};

export const inspectBinaryVerdictContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const target of typePropertyTargets) {
    const source = sourceFor(context, inspectedFiles, target.filePath);
    const errors = source ? inspectTypePropertyTarget(source, target) : [`${target.declarationName} source is missing`];
    pushVerdictFinding(findings, lawId, target.filePath, errors);
  }
  for (const target of schemaTargets) {
    const source = sourceFor(context, inspectedFiles, target.filePath);
    const errors = source ? inspectSchemaTarget(source, target) : [`${target.declarationName} source is missing`];
    pushVerdictFinding(findings, lawId, target.filePath, errors);
  }
};
