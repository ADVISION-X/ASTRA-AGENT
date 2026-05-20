import { Project, Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

const targetPath = process.argv[2];
if (!targetPath) {
  throw new Error("Usage: node --import tsx tmp/function-metrics.ts <file>");
}

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const sourceFile = project.getSourceFile(targetPath) ?? project.addSourceFileAtPath(targetPath);

const isFunctionLike = (node: MorphNode): boolean =>
  Node.isFunctionDeclaration(node)
  || Node.isFunctionExpression(node)
  || Node.isArrowFunction(node)
  || Node.isMethodDeclaration(node);

const forEachOwnDescendant = (node: MorphNode, visit: (descendant: MorphNode) => void): void => {
  node.forEachChild((child) => {
    if (child !== node && isFunctionLike(child)) return;
    visit(child);
    forEachOwnDescendant(child, visit);
  });
};

const countOwnDescendants = (node: MorphNode, kinds: SyntaxKind[]): number => {
  let count = 0;
  forEachOwnDescendant(node, (descendant) => {
    if (kinds.includes(descendant.getKind())) count += 1;
  });
  return count;
};

const countEffectiveStatements = (node: MorphNode): number => {
  let count = 0;
  forEachOwnDescendant(node, (descendant) => {
    if (Node.isStatement(descendant)) count += 1;
  });
  return count;
};

const maxNestingDepth = (node: MorphNode, depth = 0): number => {
  let max = depth;
  node.forEachChild((child) => {
    if (child !== node && isFunctionLike(child)) return;
    const nextDepth = Node.isIfStatement(child)
      || Node.isForStatement(child)
      || Node.isForOfStatement(child)
      || Node.isForInStatement(child)
      || Node.isWhileStatement(child)
      || Node.isDoStatement(child)
      || Node.isSwitchStatement(child)
      || Node.isTryStatement(child)
      ? depth + 1
      : depth;
    max = Math.max(max, maxNestingDepth(child, nextDepth));
  });
  return max;
};

const countIfElseChain = (node: MorphNode): number => {
  let maxChain = 0;
  forEachOwnDescendant(node, (descendant) => {
    if (!Node.isIfStatement(descendant)) return;
    let chain = 1;
    let current = descendant.getElseStatement();
    while (current && Node.isIfStatement(current)) {
      chain += 1;
      current = current.getElseStatement();
    }
    maxChain = Math.max(maxChain, chain);
  });
  return maxChain;
};

const countParameters = (node: MorphNode): number => {
  if (Node.isFunctionDeclaration(node)) return node.getParameters().length;
  if (Node.isFunctionExpression(node)) return node.getParameters().length;
  if (Node.isArrowFunction(node)) return node.getParameters().length;
  if (Node.isMethodDeclaration(node)) return node.getParameters().length;
  return 0;
};

const describeFunction = (source: SourceFile, node: MorphNode): string => {
  const variable = node.getParentIfKind(SyntaxKind.VariableDeclaration);
  if (variable) return variable.getName();
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) return node.getName() ?? "anonymous";
  return `${source.getBaseName()}:${node.getStartLineNumber()}`;
};

sourceFile.forEachDescendant((node) => {
  if (!isFunctionLike(node)) return;
  const lines = node.getEndLineNumber() - node.getStartLineNumber() + 1;
  const statements = countEffectiveStatements(node);
  const params = countParameters(node);
  const returns = countOwnDescendants(node, [SyntaxKind.ReturnStatement]);
  const switches = countOwnDescendants(node, [SyntaxKind.CaseClause, SyntaxKind.DefaultClause]);
  const branches = countOwnDescendants(node, [
    SyntaxKind.IfStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.ForInStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.DoStatement,
    SyntaxKind.CaseClause,
    SyntaxKind.CatchClause,
    SyntaxKind.ConditionalExpression,
  ]);
  const nesting = maxNestingDepth(node);
  const ifElseChain = countIfElseChain(node);
  if (lines > 40 || statements > 35 || params > 4 || returns > 5 || switches > 8 || branches > 8 || nesting > 3 || ifElseChain > 5) {
    process.stdout.write(JSON.stringify({
      file: sourceFile.getFilePath(),
      name: describeFunction(sourceFile, node),
      start: node.getStartLineNumber(),
      lines,
      statements,
      params,
      returns,
      branches,
      switches,
      nesting,
      ifElseChain,
    }) + "\n");
  }
});
