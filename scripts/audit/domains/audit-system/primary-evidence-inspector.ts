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

const itemObject = (declaration: FunctionDeclaration): ObjectLiteralExpression | undefined => {
  const initializer = variable(declaration, "items")?.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  const expression = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "map") return undefined;
  const callback = initializer.getArguments()[0];
  if (!callback || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback))) return undefined;
  const body = callback.getBody();
  if (Node.isObjectLiteralExpression(body)) return body;
  return body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .map((statement) => statement.getExpression())
    .find((returned): returned is ObjectLiteralExpression => Boolean(returned && Node.isObjectLiteralExpression(returned)));
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

const inspectLawItem = (declaration: FunctionDeclaration, broken: BrokenFinding): Finding[] => {
  const findings: Finding[] = [];
  const item = itemObject(declaration);
  if (!item) findings.push(broken("law-items-map"));
  else {
    for (const name of ["lawId", "applicableEvidenceModes", "deferredEvidenceModes", "outcome", "evidenceRefs", "findings"]) {
      if (!propertyExpression(item, name)) findings.push(broken(`law-item.${name}`));
    }
    if (!containsNames(propertyExpression(item, "evidenceRefs"), ["evidenceRefs"])) findings.push(broken("law-item.evidenceRefs-path"));
    if (!containsNames(propertyExpression(item, "findings"), ["findings"])) findings.push(broken("law-item.findings-path"));
    if (!containsNames(propertyExpression(item, "outcome"), ["findings"])) findings.push(broken("law-item.outcome-path"));
  }
  return findings;
};

const inspectEvidencePaths = (
  declaration: FunctionDeclaration,
  functionName: string,
  broken: BrokenFinding,
): Finding[] => {
  const findings: Finding[] = [];
  const missing = variable(declaration, "missing")?.getInitializer();
  const findingsValue = variable(declaration, "findings")?.getInitializer();
  const evidenceRefs = variable(declaration, "evidenceRefs")?.getInitializer();
  if (!containsNames(missing, ["applicable", "covered"])) findings.push(broken("missing-evidence-path"));
  if (!containsNames(findingsValue, ["missing", "failed"])) findings.push(broken("findings-path"));
  const evidenceInputs = functionName === "writeReleaseReport"
    ? ["staticChecks", "lawProofs", "outcome", "evidenceRefs"]
    : ["relevant", "outcome", "evidenceRef"];
  if (!containsNames(evidenceRefs, evidenceInputs)) findings.push(broken("evidence-refs-path"));
  return findings;
};

const inspectReportPath = (declaration: FunctionDeclaration, broken: BrokenFinding): Finding[] => {
  const findings: Finding[] = [];
  const report = reportObject(declaration);
  if (!report) findings.push(broken("report-object"));
  else {
    if (!containsNames(propertyExpression(report, "laws"), ["items"])) findings.push(broken("report-laws-path"));
    if (!containsNames(propertyExpression(report, "outcome"), ["items", "outcome"])) findings.push(broken("report-outcome-path"));
  }
  if (!hasReportValidation(declaration)) findings.push(broken("validateQualityReport(report)"));
  if (!hasCanonicalReportWrite(declaration)) findings.push(broken("writeFileSync(canonicalBytes(report))"));
  return findings;
};

const inspectEvidenceOrder = (declaration: FunctionDeclaration, broken: BrokenFinding): Finding[] => {
  const calls = callNamesInOrder(declaration);
  const evidencePlanIndex = calls.indexOf("evidencePlan");
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
  return [
    ...inspectLawItem(declaration, broken),
    ...inspectEvidencePaths(declaration, functionName, broken),
    ...inspectReportPath(declaration, broken),
    ...inspectEvidenceOrder(declaration, broken),
  ];
};

export const inspectPrimaryEvidence = (source: SourceFile): Finding[] => [
  ...inspectFunction(source, "writeReport"),
  ...inspectFunction(source, "writeReleaseReport"),
];
