import {
  Node,
  SyntaxKind,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";

import type { ActiveCodeFile, PurityFinding } from "./types.js";
import { toRelativeSourcePath } from "./scope.js";

const typeOrSchemaSurfacePattern =
  /(^src\/types\/.*|(^|\/)[^/]*(schema|types)[^/]*\.(ts|tsx|js|mjs|cjs)$)/;

const boundarySurfacePattern =
  /(^|\/)(index|contract|manifest|children)\.(ts|tsx|js|mjs|cjs)$/;

const baseLimitFor = (file: ActiveCodeFile): number => {
  if (file.relativePath.endsWith(".json")) return 700;
  if (file.relativePath.includes("/schema") || file.relativePath.includes("/types")) return 500;
  if (file.relativePath.includes("/scripts/audit/domains/code-purity/")) return 250;
  if (file.relativePath.includes("/scripts/audit/")) return 250;
  if (file.relativePath.includes("/runtime/") || file.relativePath.includes("/implementation")) return 300;
  if (file.relativePath.includes("/app/") && file.relativePath.includes("handler")) return 250;
  return 300;
};

const forEachOwnDescendant = (
  node: MorphNode,
  visit: (descendant: MorphNode) => void,
): void => {
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

const isFunctionLike = (node: MorphNode): boolean =>
  Node.isFunctionDeclaration(node)
  || Node.isFunctionExpression(node)
  || Node.isArrowFunction(node)
  || Node.isMethodDeclaration(node);

const countParameters = (node: MorphNode): number => {
  if (Node.isFunctionDeclaration(node)) return node.getParameters().length;
  if (Node.isFunctionExpression(node)) return node.getParameters().length;
  if (Node.isArrowFunction(node)) return node.getParameters().length;
  if (Node.isMethodDeclaration(node)) return node.getParameters().length;
  return 0;
};

const countEffectiveStatements = (node: MorphNode): number => {
  let count = 0;
  forEachOwnDescendant(node, (descendant) => {
    if (Node.isStatement(descendant)) count += 1;
  });
  return count;
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

const countBoundaryExports = (sourceFile: SourceFile): number => {
  let count = 0;
  sourceFile.forEachChild((child) => {
    if (Node.isExportDeclaration(child)) {
      const named = child.getNamedExports();
      count += named.length > 0 ? named.length : 1;
      return;
    }
    if (Node.isExportAssignment(child)) {
      count += 1;
      return;
    }
    const modifiers = "getModifiers" in child && typeof child.getModifiers === "function"
      ? child.getModifiers()
      : [];
    if (modifiers.some((modifier: MorphNode) => modifier.getKind() === SyntaxKind.ExportKeyword)) {
      count += 1;
    }
  });
  return count;
};

const isPureTypeBoundaryFile = (sourceFile: SourceFile): boolean =>
  sourceFile.getStatements().every((statement) =>
    Node.isImportDeclaration(statement)
    || Node.isTypeAliasDeclaration(statement)
    || Node.isInterfaceDeclaration(statement)
    || Node.isExportDeclaration(statement)
  );

const boundaryLimitsFor = (file: string, sourceFile: SourceFile) => {
  if (isPureTypeBoundaryFile(sourceFile)) {
    return { importLimit: 20, importSourceLimit: 16, exportLimit: 80 };
  }
  if (typeOrSchemaSurfacePattern.test(file)) {
    return { importLimit: 20, importSourceLimit: 16, exportLimit: 80 };
  }
  if (boundarySurfacePattern.test(file)) {
    return { importLimit: 18, importSourceLimit: 14, exportLimit: 40 };
  }
  return { importLimit: 15, importSourceLimit: 12, exportLimit: 8 };
};

const collectFunctionFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
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
      findings.push({
        rule: "CP-AST-008",
        file,
        line: node.getStartLineNumber(),
        message: `function exceeds hard limits: lines=${lines}, statements=${statements}, params=${params}, returns=${returns}, complexity=${branches}, switchCases=${switches}, nesting=${nesting}, ifElseChain=${ifElseChain}`,
      });
    }
  });
  return findings;
};

const collectClassObjectFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
  const allowLargeSurfaceObject = typeOrSchemaSurfacePattern.test(file)
    || boundarySurfacePattern.test(file);
  sourceFile.forEachDescendant((node) => {
    const isSizedObject = Node.isClassDeclaration(node)
      || Node.isObjectLiteralExpression(node);
    if (!isSizedObject) return;
    if (allowLargeSurfaceObject && Node.isObjectLiteralExpression(node)) return;
    const lines = node.getEndLineNumber() - node.getStartLineNumber() + 1;
    if (lines <= 40) return;
    findings.push({
      rule: "CP-AST-013",
      file,
      line: node.getStartLineNumber(),
      message: `class/object exceeds physical size hard limit: lines=${lines}`,
    });
  });
  return findings;
};

const collectImportExportFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const file = toRelativeSourcePath(sourceFile);
  const imports = sourceFile.getImportDeclarations();
  const importSources = new Set(imports.map((importDecl) => importDecl.getModuleSpecifierValue()));
  const exports = countBoundaryExports(sourceFile);
  const limits = boundaryLimitsFor(file, sourceFile);
  const findings: PurityFinding[] = [];
  if (
    imports.length > limits.importLimit
    || importSources.size > limits.importSourceLimit
    || exports > limits.exportLimit
  ) {
    findings.push({
      rule: "CP-AST-009",
      file,
      line: 1,
      message: `module boundary exceeds hard limits: imports=${imports.length}, importSources=${importSources.size}, exports=${exports}`,
    });
  }
  return findings;
};

const collectFileLineFindings = (files: ActiveCodeFile[]): PurityFinding[] =>
  files
    .filter((file) => file.lineCount > baseLimitFor(file))
    .map((file) => ({
      rule: "CP-FILE-001",
      file: file.relativePath,
      line: 1,
      message: `active source file has ${file.lineCount} lines; hard limit is ${baseLimitFor(file)}`,
    }));

export const collectStructureFindings = (
  sourceFiles: SourceFile[],
  codeFiles: ActiveCodeFile[],
): PurityFinding[] => [
  ...collectFileLineFindings(codeFiles),
  ...sourceFiles.flatMap(collectFunctionFindings),
  ...sourceFiles.flatMap(collectClassObjectFindings),
  ...sourceFiles.flatMap(collectImportExportFindings),
];
