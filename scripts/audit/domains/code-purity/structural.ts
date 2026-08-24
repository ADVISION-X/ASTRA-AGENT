import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

import { repoPath } from "./module-graph.js";
import { purityFinding, type PurityFinding, type PurityInput } from "./types.js";

const functionLike = (node: MorphNode): boolean => Node.isFunctionDeclaration(node)
  || Node.isMethodDeclaration(node)
  || Node.isArrowFunction(node)
  || Node.isFunctionExpression(node)
  || Node.isConstructorDeclaration(node)
  || Node.isGetAccessorDeclaration(node)
  || Node.isSetAccessorDeclaration(node);

const owningFunction = (node: MorphNode): MorphNode | undefined => node.getAncestors().find(functionLike);
const nestedIn = (node: MorphNode, owner: MorphNode): boolean => owningFunction(node) === owner;

const metricFinding = (path: string, node: MorphNode, metric: string, actual: number, limit: number): PurityFinding => purityFinding(
  "CODE_PURITY_STRUCTURAL_BUDGET_EXCEEDED",
  path,
  node.getStartLineNumber(),
  `${metric}=${actual} limit=${limit}`,
);

const maxNesting = (owner: MorphNode): number => {
  const kinds = new Set([SyntaxKind.IfStatement, SyntaxKind.ForStatement, SyntaxKind.ForInStatement, SyntaxKind.ForOfStatement, SyntaxKind.WhileStatement, SyntaxKind.DoStatement, SyntaxKind.SwitchStatement, SyntaxKind.TryStatement]);
  let maximum = 0;
  for (const node of owner.getDescendants()) {
    if (!kinds.has(node.getKind()) || !nestedIn(node, owner)) continue;
    const depth = node.getAncestors().filter((ancestor) => ancestor !== owner && kinds.has(ancestor.getKind()) && owningFunction(ancestor) === owner).length + 1;
    maximum = Math.max(maximum, depth);
  }
  return maximum;
};

const complexity = (owner: MorphNode): number => 1 + owner.getDescendants().filter((node) => nestedIn(node, owner) && new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.CatchClause,
]).has(node.getKind())).length;

const functionFindings = (path: string, source: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  for (const node of source.getDescendants().filter(functionLike)) {
    const lineCount = node.getEndLineNumber() - node.getStartLineNumber() + 1;
    const parameters = Node.isParametered(node) ? node.getParameters().length : 0;
    const returns = node.getDescendantsOfKind(SyntaxKind.ReturnStatement).filter((item) => nestedIn(item, node)).length;
    const awaits = node.getDescendantsOfKind(SyntaxKind.AwaitExpression).filter((item) => nestedIn(item, node)).length;
    const checks: Array<[string, number, number]> = [
      ["function-lines", lineCount, 75],
      ["parameters", parameters, 7],
      ["return-branches", returns, 8],
      ["nesting-depth", maxNesting(node), 5],
      ["cyclomatic-complexity", complexity(node), 16],
      ["await-points", awaits, 10],
    ];
    for (const [metric, actual, limit] of checks) if (actual > limit) findings.push(metricFinding(path, node, metric, actual, limit));
  }
  return findings;
};

type Constant = boolean | string | number | undefined;

const literalValue = (node: MorphNode): Constant => {
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node)) return false;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node) || Node.isNumericLiteral(node)) return node.getLiteralValue();
  return undefined;
};

const compareConstants = (operator: SyntaxKind, left: Exclude<Constant, undefined>, right: Exclude<Constant, undefined>): Constant => {
  if (operator === SyntaxKind.EqualsEqualsEqualsToken || operator === SyntaxKind.EqualsEqualsToken) return left === right;
  if (operator === SyntaxKind.ExclamationEqualsEqualsToken || operator === SyntaxKind.ExclamationEqualsToken) return left !== right;
  return undefined;
};

const constantValue = (node: MorphNode | undefined, source: SourceFile, seen = new Set<string>()): Constant => {
  if (!node) return undefined;
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node)) return constantValue(node.getExpression(), source, seen);
  const literal = literalValue(node);
  if (literal !== undefined) return literal;
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const value = constantValue(node.getOperand(), source, seen);
    return typeof value === "boolean" ? !value : undefined;
  }
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    if (seen.has(name)) return undefined;
    seen.add(name);
    return constantValue(source.getVariableDeclaration(name)?.getInitializer(), source, seen);
  }
  if (!Node.isBinaryExpression(node)) return undefined;
  const left = constantValue(node.getLeft(), source, new Set(seen));
  const right = constantValue(node.getRight(), source, new Set(seen));
  return left === undefined || right === undefined ? undefined : compareConstants(node.getOperatorToken().getKind(), left, right);
};

const deadBranchFindings = (path: string, source: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  for (const statement of source.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const value = constantValue(statement.getExpression(), source);
    if (typeof value === "boolean") findings.push(purityFinding("CODE_PURITY_LITERAL_DEAD_BRANCH", path, statement.getStartLineNumber(), `condition=${value}`));
  }
  for (const conditional of source.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const value = constantValue(conditional.getCondition(), source);
    if (typeof value === "boolean") findings.push(purityFinding("CODE_PURITY_LITERAL_DEAD_BRANCH", path, conditional.getStartLineNumber(), `condition=${value}`));
  }
  return findings;
};

const sourceShapeFindings = (path: string, source: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const lines = source.getEndLineNumber();
  if (lines > 500) findings.push(metricFinding(path, source, "file-lines", lines, 500));
  const imports = source.getImportDeclarations();
  if (imports.length > 28) findings.push(metricFinding(path, source, "import-declarations", imports.length, 28));
  const sources = new Set(imports.map((declaration) => declaration.getModuleSpecifierValue()));
  if (sources.size > 24) findings.push(metricFinding(path, source, "import-sources", sources.size, 24));
  const namedExports = [...source.getExportedDeclarations().keys()];
  if (namedExports.length > 24) findings.push(metricFinding(path, source, "named-exports", namedExports.length, 24));
  for (const declaration of source.getExportDeclarations()) {
    if (declaration.getModuleSpecifierValue() && declaration.getNamedExports().length === 0 && declaration.getNamespaceExport() === undefined) findings.push(purityFinding("CODE_PURITY_EXPORT_STAR_FORBIDDEN", path, declaration.getStartLineNumber(), declaration.getText()));
  }
  for (const anyNode of source.getDescendantsOfKind(SyntaxKind.AnyKeyword)) findings.push(purityFinding("CODE_PURITY_TYPE_ESCAPE", path, anyNode.getStartLineNumber(), "any"));
  for (const clause of source.getDescendantsOfKind(SyntaxKind.CatchClause)) if (clause.getBlock().getStatements().length === 0) findings.push(purityFinding("CODE_PURITY_CATCH_AND_SWALLOW", path, clause.getStartLineNumber(), "empty catch"));
  return findings;
};

export function inspectStructuralPurity(input: PurityInput): PurityFinding[] {
  const findings: PurityFinding[] = [];
  for (const source of input.sourceFiles) {
    const path = repoPath(input.root, source.getFilePath());
    findings.push(...sourceShapeFindings(path, source), ...functionFindings(path, source), ...deadBranchFindings(path, source));
  }
  return findings;
}
