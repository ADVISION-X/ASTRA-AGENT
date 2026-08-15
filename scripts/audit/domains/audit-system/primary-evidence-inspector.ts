import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type Node as MorphNode,
} from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { discoverLawFiles } from "../../build/discover-law-files.js";
import { parseApexLaws } from "../../build/parse-apex-laws.js";
import { sourceEvidenceIsReachable } from "../../build/source-evidence-reachability.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { ManifestSource } from "../../shared/manifest-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const toManifestSource = (entry: InspectorContext["generatedPlan"][number]): ManifestSource => ({
  capabilityDomain: entry.capabilityDomain,
  ownerInspectorPath: entry.ownerInspectorPath,
  executionGroup: entry.executionGroup,
  coverage: {
    mode: "explicit",
    bindings: entry.bindings.map(({ evidenceMode: _evidenceMode, ...binding }) => binding),
  },
  blueprintRefs: entry.blueprintRefs,
  manifestPath: entry.manifestPath,
});

type FunctionNode = FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression;

const functionNodeFor = (declaration: MorphNode): FunctionNode | null => {
  if (Node.isFunctionDeclaration(declaration) || Node.isMethodDeclaration(declaration)
    || Node.isArrowFunction(declaration) || Node.isFunctionExpression(declaration)) return declaration;
  const initializer = Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer
    : null;
};

const functionKey = (node: FunctionNode): string =>
  `${node.getSourceFile().getFilePath()}:${node.getStart()}`;

const callTargets = (call: MorphNode): FunctionNode[] => {
  if (!Node.isCallExpression(call)) return [];
  const symbol = call.getExpression().getSymbol();
  const resolved = symbol?.getAliasedSymbol() ?? symbol;
  return (resolved?.getDeclarations() ?? []).flatMap((declaration) => {
    if (declaration.getSourceFile().isDeclarationFile()
      || !toRepoPath(declaration.getSourceFile().getFilePath()).startsWith("scripts/audit/")) return [];
    const functionNode = functionNodeFor(declaration);
    return functionNode ? [functionNode] : [];
  });
};

const reachableFunctions = (
  context: InspectorContext,
  filePath: string,
  symbolName: string,
): FunctionNode[] => {
  const pending = (context.project.getSourceFile(resolveFromRepo(filePath))
    ?.getExportedDeclarations().get(symbolName) ?? []).flatMap((declaration) => {
    const functionNode = functionNodeFor(declaration);
    return functionNode ? [functionNode] : [];
  });
  const visited = new Set<string>();
  const functions: FunctionNode[] = [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const key = functionKey(current);
    if (visited.has(key)) continue;
    visited.add(key);
    functions.push(current);
    pending.push(...current.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap(callTargets));
  }
  return functions;
};

const usesProjectAst = (node: FunctionNode): boolean =>
  node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
    access.getName() === "project"
    && Node.isIdentifier(access.getExpression())
    && (access.getExpression().getSymbol()?.getDeclarations().some((declaration) =>
      Node.isParameterDeclaration(declaration) && declaration.getName() === "context") ?? false));

const isNodeFsCall = (call: MorphNode): boolean => {
  if (!Node.isCallExpression(call)) return false;
  const symbol = call.getExpression().getSymbol();
  const declarations = [
    ...(symbol?.getDeclarations() ?? []),
    ...(symbol?.getAliasedSymbol()?.getDeclarations() ?? []),
  ];
  return declarations.some((declaration) => {
    if (Node.isImportSpecifier(declaration)) {
      return declaration.getImportDeclaration().getModuleSpecifierValue().startsWith("node:fs");
    }
    const sourcePath = declaration.getSourceFile().getFilePath();
    return declaration.getSourceFile().isDeclarationFile()
      && (sourcePath.endsWith("/node_modules/@types/node/fs.d.ts")
        || sourcePath.endsWith("/node_modules/@types/node/fs/promises.d.ts"));
  });
};

const isConfigParseCall = (call: MorphNode): boolean => {
  if (!Node.isCallExpression(call)) return false;
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return false;
  if (callee.getName() === "safeParse") return true;
  const receiver = callee.getExpression();
  return callee.getName() === "parse"
    && Node.isIdentifier(receiver)
    && receiver.getSymbol()?.getEscapedName().toString() === "JSON"
    && (receiver.getSymbol()?.getDeclarations().every((declaration) =>
      declaration.getSourceFile().isDeclarationFile()) ?? false);
};

const sourceEvidenceUsesEngine = (
  context: InspectorContext,
  sourceEvidence: { filePath: string; symbolName: string },
  engine: "ast" | "fs" | "config",
): boolean => {
  const functions = reachableFunctions(context, sourceEvidence.filePath, sourceEvidence.symbolName);
  if (engine === "ast") return functions.some(usesProjectAst);
  const calls = functions.flatMap((node) => node.getDescendantsOfKind(SyntaxKind.CallExpression));
  return engine === "fs" ? calls.some(isNodeFsCall) : calls.some(isConfigParseCall);
};

export const inspectPrimaryEvidenceContract = (
  context: InspectorContext,
  lawId: string,
  inspectedFiles: Set<string>,
): ReturnType<typeof createFinding>[] => {
  const lawFiles = discoverLawFiles();
  lawFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const parsed = parseApexLaws(lawFiles);
  const activeLaws = new Map(parsed.laws
    .filter((law) => law.status === "active")
    .map((law) => [law.lawId, law]));
  const findings: ReturnType<typeof createFinding>[] = [];

  for (const entry of context.generatedPlan) {
    inspectedFiles.add(entry.ownerInspectorPath);
    inspectedFiles.add(entry.manifestPath);
    const manifest = toManifestSource(entry);
    for (const binding of entry.bindings) {
      const activeLaw = activeLaws.get(binding.lawId);
      if (!activeLaw || activeLaw.evidenceMode !== "hybrid") continue;
      const primaryEvidence = binding.primaryEvidence;
      if (!primaryEvidence) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: entry.manifestPath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} has no declared primary evidence path.`,
        }));
        continue;
      }
      const sourceEvidence = binding.sourceEvidence[primaryEvidence.sourceEvidenceIndex];
      if (!sourceEvidence) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: entry.manifestPath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} points to missing sourceEvidence index ${primaryEvidence.sourceEvidenceIndex}.`,
        }));
        continue;
      }
      inspectedFiles.add(sourceEvidence.filePath);
      if (!sourceEvidenceIsReachable(
        context.project,
        manifest,
        sourceEvidence.filePath,
        sourceEvidence.symbolName,
      )) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: sourceEvidence.filePath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} primary evidence is not on the signed owner verdict path.`,
        }));
        continue;
      }
      if (!sourceEvidenceUsesEngine(context, sourceEvidence, primaryEvidence.engine)) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: sourceEvidence.filePath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} declares ${primaryEvidence.engine} primary evidence, but its selected sourceEvidence does not execute that engine.`,
        }));
      }
    }
  }
  return findings;
};
