import { readFileSync } from "node:fs";

import { Node, type Identifier, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { toRelativeSourcePath } from "./scope.js";
import type { PurityFinding } from "./types.js";

const ownerFromPath = (path: string): string | undefined => {
  const match = /^src\/capabilities\/([^/]+)\//.exec(path);
  return match?.[1];
};

const publicSurfacePattern = /(^|\/)(index|contract|schema[^/]*|types|manifest|run-inspector)\.(ts|tsx|js|mjs|cjs)$/;

const readPackageEntrypoints = (): Set<string> => {
  const packageJson = JSON.parse(
    readFileSync(pathFromRepoRoot("package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const scripts = Object.values(packageJson.scripts ?? {});
  const entries = new Set<string>();
  for (const script of scripts) {
    const matches = script.matchAll(/(?:tsx|node(?: --import tsx)?) ([^\s]+)/g);
    for (const match of matches) {
      const entry = match[1];
      if (!entry) continue;
      entries.add(entry.replace(/^dist\//, "").replace(/\.js$/, ".ts"));
    }
  }
  return entries;
};

const collectConsoleFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const file = toRelativeSourcePath(sourceFile);
  if (file.includes("terminal-structured-log") || file.includes("runtime-logs/sinks.ts")) return [];
  const aliases = new Set(["console"]);
  const findings: PurityFinding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node)) return;
    const init = node.getInitializer();
    if (!init) return;
    const nameNode = node.getNameNode();
    if (Node.isIdentifier(init) && init.getText() === "console" && Node.isIdentifier(nameNode)) aliases.add(nameNode.getText());
    if (Node.isPropertyAccessExpression(init) && init.getExpression().getText() === "console" && Node.isIdentifier(nameNode)) aliases.add(nameNode.getText());
  });
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (Node.isPropertyAccessExpression(expr) && aliases.has(expr.getExpression().getText())) {
      findings.push({ rule: "CP-AST-004", file, line: node.getStartLineNumber(), message: "console scatter is forbidden outside logging sinks" });
    }
    if (Node.isIdentifier(expr) && aliases.has(expr.getText()) && expr.getText() !== "console") {
      findings.push({ rule: "CP-AST-005", file, line: node.getStartLineNumber(), message: "console alias call is forbidden" });
    }
  });
  return findings;
};

const collectPrivateImportFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const importer = toRelativeSourcePath(sourceFile);
  const importerOwner = ownerFromPath(importer);
  const findings: PurityFinding[] = [];
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const target = importDecl.getModuleSpecifierSourceFile();
    if (!target) continue;
    const targetPath = toRelativeSourcePath(target);
    const targetOwner = ownerFromPath(targetPath);
    if (!targetOwner || targetOwner === importerOwner) continue;
    if (!/\/(runtime|children|shared)\//.test(targetPath)) continue;
    findings.push({
      rule: "CP-AST-011",
      file: importer,
      line: importDecl.getStartLineNumber(),
      message: `cross-owner private import is forbidden: ${targetPath}`,
    });
  }
  return findings;
};

const collectDeadImportFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const file = toRelativeSourcePath(sourceFile);
  if (!/\.(ts|tsx)$/.test(file)) return [];
  const findings: PurityFinding[] = [];
  for (const importDecl of sourceFile.getImportDeclarations()) {
    for (const named of importDecl.getNamedImports()) {
      const nameNode = named.getNameNode();
      if (!Node.isIdentifier(nameNode)) continue;
      const refs = nameNode.findReferencesAsNodes();
      if (refs.length <= 1) {
        findings.push({ rule: "CP-AST-012", file, line: named.getStartLineNumber(), message: `dead import is forbidden: ${named.getName()}` });
      }
    }
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport && defaultImport.findReferencesAsNodes().length <= 1) {
      findings.push({ rule: "CP-AST-012", file, line: importDecl.getStartLineNumber(), message: `dead default import is forbidden: ${defaultImport.getText()}` });
    }
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport && namespaceImport.findReferencesAsNodes().length <= 1) {
      findings.push({ rule: "CP-AST-012", file, line: importDecl.getStartLineNumber(), message: `dead namespace import is forbidden: ${namespaceImport.getText()}` });
    }
  }
  return findings;
};

const collectUnusedExportFindings = (sourceFile: SourceFile): PurityFinding[] => {
  const file = toRelativeSourcePath(sourceFile);
  if (!/\.(ts|tsx)$/.test(file)) return [];
  if (publicSurfacePattern.test(file)) return [];
  const findings: PurityFinding[] = [];
  sourceFile.forEachChild((node) => {
    if (!Node.isFunctionDeclaration(node) && !Node.isVariableStatement(node)) return;
    const symbols = Node.isFunctionDeclaration(node)
      ? [node.getNameNode()].filter(Node.isIdentifier)
      : node.getDeclarations().map((declaration) => declaration.getNameNode()).filter(Node.isIdentifier);
    for (const symbol of symbols) {
      if (!node.hasExportKeyword()) continue;
      const refs = safeFindReferences(symbol);
      if (refs <= 1) {
        findings.push({
          rule: "CP-AST-015",
          file,
          line: symbol.getStartLineNumber(),
          message: `unused export is forbidden: ${symbol.getText()}`,
        });
      }
    }
  });
  return findings;
};

const safeFindReferences = (node: Identifier): number => {
  try {
    return node.findReferencesAsNodes().length;
  } catch {
    return 2;
  }
};

const collectReferencedSourcePaths = (sourceFiles: SourceFile[]): Set<string> =>
  new Set([
    ...sourceFiles
      .flatMap((sourceFile) => [
        ...sourceFile.getImportDeclarations().map((decl) =>
          decl.getModuleSpecifierSourceFile(),
        ),
        ...sourceFile.getExportDeclarations().map((decl) =>
          decl.getModuleSpecifierSourceFile(),
        ),
      ])
      .filter((target): target is SourceFile => Boolean(target))
      .map(toRelativeSourcePath),
    ...sourceFiles.flatMap((sourceFile) => {
      const file = toRelativeSourcePath(sourceFile);
      if (!file.startsWith("scripts/audit/")) {
        return [];
      }

      const referenced: string[] = [];
      sourceFile.forEachDescendant((node) => {
        if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) {
          return;
        }
        const target = node.getLiteralText();
        if (target.startsWith("src/")) {
          referenced.push(target);
        }
      });
      return referenced;
    }),
  ]);

const collectDeadFileFindings = (sourceFiles: SourceFile[]): PurityFinding[] => {
  const imported = collectReferencedSourcePaths(sourceFiles);
  const entrypoints = readPackageEntrypoints();
  return sourceFiles
    .map(toRelativeSourcePath)
    .filter((file) => file.startsWith("src/"))
    .filter((file) => !publicSurfacePattern.test(file))
    .filter((file) => !entrypoints.has(file))
    .filter((file) => !imported.has(file))
    .map((file) => ({
      rule: "CP-AST-016",
      file,
      line: 1,
      message: "dead file is forbidden: no active import reaches this file",
    }));
};

export const collectBoundaryFindings = (sourceFiles: SourceFile[]): PurityFinding[] => [
  ...sourceFiles.flatMap(collectConsoleFindings),
  ...sourceFiles.flatMap(collectPrivateImportFindings),
  ...sourceFiles.flatMap(collectDeadImportFindings),
  ...sourceFiles.flatMap(collectUnusedExportFindings),
  ...collectDeadFileFindings(sourceFiles),
];
