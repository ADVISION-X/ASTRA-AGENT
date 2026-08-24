import { Node, SyntaxKind, type FunctionDeclaration, type Node as MorphNode, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { callNamesInOrder } from "./control-flow-reachability.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";

type Finding = { code: string; detail: string; path: string };

const variable = (declaration: FunctionDeclaration, name: string) =>
  declaration.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === name);

const propertyExpression = (object: ObjectLiteralExpression, name: string): MorphNode | undefined => {
  const property = object.getProperty(name);
  if (property && Node.isPropertyAssignment(property)) return property.getInitializer();
  if (property && Node.isShorthandPropertyAssignment(property)) return property.getNameNode();
  return undefined;
};

const identifierSet = (node: MorphNode | undefined): Set<string> =>
  new Set(node?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);

const containsNames = (node: MorphNode | undefined, names: string[]): boolean => {
  const identifiers = identifierSet(node);
  if (node && Node.isIdentifier(node)) identifiers.add(node.getText());
  return names.every((name) => identifiers.has(name));
};

const reportObject = (declaration: FunctionDeclaration): ObjectLiteralExpression | undefined => {
  const initializer = variable(declaration, "report")?.getInitializer();
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : undefined;
};

const directlyExecuted = (node: MorphNode, declaration: FunctionDeclaration): boolean =>
  node.getFirstAncestor(Node.isFunctionLikeDeclaration) === declaration
  && !isDefinitelyUnreachable(node, declaration);

const hasReportValidation = (declaration: FunctionDeclaration): boolean =>
  declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    const first = call.getArguments()[0];
    return directlyExecuted(call, declaration)
      && Node.isIdentifier(expression) && expression.getSymbol()?.getName() === "validateQualityReport"
      && Boolean(first && Node.isIdentifier(first) && first.getSymbol()?.getName() === "report");
  });

const hasCanonicalReportWrite = (declaration: FunctionDeclaration): boolean =>
  declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (!directlyExecuted(call, declaration)) return false;
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression) || expression.getSymbol()?.getName() !== "writeFileSync") return false;
    const payload = call.getArguments()[1];
    if (!payload || !Node.isCallExpression(payload)) return false;
    const serializer = payload.getExpression();
    const report = payload.getArguments()[0];
    return Node.isIdentifier(serializer) && serializer.getSymbol()?.getName() === "canonicalBytes"
      && Boolean(report && Node.isIdentifier(report) && report.getSymbol()?.getName() === "report");
  });

type BrokenFinding = (detail: string) => Finding;

const inspectReportPath = (declaration: FunctionDeclaration, broken: BrokenFinding): Finding[] => {
  const findings: Finding[] = [];
  const report = reportObject(declaration);
  if (!report) findings.push(broken("report-object"));
  else {
    if (!containsNames(propertyExpression(report, "laws"), ["items"])) findings.push(broken("report-laws-path"));
    if (!containsNames(propertyExpression(report, "outcome"), ["items", "mutants"])) findings.push(broken("report-outcome-path"));
  }
  if (!hasReportValidation(declaration)) findings.push(broken("validateQualityReport(report)"));
  if (!hasCanonicalReportWrite(declaration)) findings.push(broken("writeFileSync(canonicalBytes(report))"));
  return findings;
};

const inspectEvidenceOrder = (declaration: FunctionDeclaration, broken: BrokenFinding): Finding[] => {
  const calls = callNamesInOrder(declaration);
  const evidencePlanIndex = calls.indexOf("candidateSnapshot");
  const validationIndex = calls.indexOf("validateQualityReport");
  const writeIndex = calls.indexOf("writeFileSync");
  return evidencePlanIndex < 0 || validationIndex <= evidencePlanIndex || writeIndex <= validationIndex
    ? [broken("evidence-plan-validation-write-order")] : [];
};

const inspectFunction = (source: SourceFile, functionName: string): Finding[] => {
  const declaration = source.getFunction(functionName);
  const broken: BrokenFinding = (detail) => ({
    code: "AUDIT_PRIMARY_EVIDENCE_BROKEN",
    detail: `${functionName}:${detail}`,
    path: source.getFilePath(),
  });
  if (!declaration) return [broken("declaration")];
  const names = identifierSet(declaration);
  const required = ["candidateSnapshot", "items", "laws", "mutants", "outcome", "report", "validateQualityReport"];
  const report = reportObject(declaration);
  const findings = required.filter((name) => !names.has(name)).map((name) => broken(`required.${name}`));
  if (!report || !containsNames(propertyExpression(report, "laws"), ["items"]) || !containsNames(propertyExpression(report, "mutants"), ["mutants"])) findings.push(broken("single-report-denominator"));
  findings.push(...inspectReportPath(declaration, broken));
  findings.push(...inspectEvidenceOrder(declaration, broken));
  return findings;
};

export const inspectPrimaryEvidence = (source: SourceFile): Finding[] => [
  ...inspectFunction(source, "writeReport"),
  ...inspectFunction(source, "writeReleaseReport"),
];
