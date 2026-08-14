import {
  Node,
  SyntaxKind,
  type CallExpression,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";

import { collectResolvedModuleTargets } from "../../shared/source-module-targets.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const runnerRootPaths = ["scripts/audit/ci-full.ts", "scripts/audit/core/run-generated-plan.ts"] as const;
const generatedMatrixPaths = new Set([
  "scripts/audit/generated/enforcement-matrix.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.yaml",
]);
const nodeFsReadNames = new Set(["createReadStream", "open", "openSync", "readFile", "readFileSync"]);

const runnerDependencySources = (context: InspectorContext): SourceFile[] => {
  const pending: string[] = [...runnerRootPaths];
  const visited = new Set<string>();
  const sources: SourceFile[] = [];
  while (pending.length > 0) {
    const repoPath = pending.pop()!;
    if (visited.has(repoPath)) continue;
    visited.add(repoPath);
    const source = context.project.getSourceFile(resolveFromRepo(repoPath));
    if (!source) continue;
    sources.push(source);
    for (const target of collectResolvedModuleTargets(source)) {
      if (target.targetPath.startsWith("scripts/audit/") && !visited.has(target.targetPath)) {
        pending.push(target.targetPath);
      }
    }
  }
  return sources;
};

const resolvedSymbol = (node: MorphNode) => {
  const symbol = node.getSymbol();
  return symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
};

const isNodeFsRead = (call: CallExpression): boolean => {
  const symbol = resolvedSymbol(call.getExpression());
  if (!symbol || !nodeFsReadNames.has(symbol.getName())) return false;
  return symbol.getDeclarations().some((declaration) => {
    const sourcePath = declaration.getSourceFile().getFilePath();
    return declaration.getSourceFile().isDeclarationFile()
      && (sourcePath.endsWith("/node_modules/@types/node/fs.d.ts")
        || sourcePath.endsWith("/node_modules/@types/node/fs/promises.d.ts"));
  });
};

const collectStaticStrings = (node: MorphNode, visited: Set<string> = new Set()): string[] => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return [node.getLiteralValue()];
  if (Node.isIdentifier(node)) {
    const values: string[] = [];
    for (const declaration of resolvedSymbol(node)?.getDeclarations() ?? []) {
      const key = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;
      if (visited.has(key) || !Node.isVariableDeclaration(declaration)) continue;
      const initializer = declaration.getInitializer();
      if (!initializer) continue;
      visited.add(key);
      values.push(...collectStaticStrings(initializer, visited));
    }
    return values;
  }
  return node.getChildren().flatMap((child) => collectStaticStrings(child, visited));
};

const hasMatrixToken = (value: string): boolean => value.toLowerCase().includes("matrix");

const isCanonicalGeneratedMatrix = (values: readonly string[]): boolean => {
  if (values.some((value) => generatedMatrixPaths.has(value))) return true;
  const hasGeneratedSegment = values.some((value) => value === "generated" || value.endsWith("/generated"));
  return hasGeneratedSegment && values.some((value) =>
    value === "enforcement-matrix.generated.json" || value === "enforcement-matrix.generated.yaml");
};

const manualMatrixRead = (source: SourceFile): CallExpression | undefined =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    if (!isNodeFsRead(call)) return false;
    const pathArgument = call.getArguments()[0];
    if (!pathArgument) return false;
    const values = collectStaticStrings(pathArgument);
    return values.some(hasMatrixToken) && !isCanonicalGeneratedMatrix(values);
  });

const manualMatrixImport = (source: SourceFile): string | undefined =>
  collectResolvedModuleTargets(source)
    .map((target) => target.targetPath)
    .find((targetPath) => hasMatrixToken(targetPath) && !generatedMatrixPaths.has(targetPath));

export const inspectManualMatrixConsumption = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const sources = runnerDependencySources(context);
  for (const source of sources) {
    const filePath = toRepoPath(source.getFilePath());
    const importedPath = manualMatrixImport(source);
    const read = manualMatrixRead(source);
    if (!importedPath && !read) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-law-truth",
      lawId,
      filePath,
      message: "The CI runner dependency closure must not consume a manual enforcement matrix.",
      evidence: importedPath ?? collectStaticStrings(read!.getArguments()[0]!).join("/"),
    }));
  }
  return { findings, inspectedFiles: sources.map((source) => toRepoPath(source.getFilePath())).sort() };
};
