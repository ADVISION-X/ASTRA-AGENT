import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import { Node, SyntaxKind, type CallExpression, type ImportDeclaration, type SourceFile } from "ts-morph";

import { purityFinding, type PurityFinding, type PurityInput } from "./types.js";

export type ModuleEdge = {
  consumer: string;
  kind: "dynamic" | "import" | "reexport" | "side-effect";
  line: number;
  target: string;
};

export type ModuleGraphResult = {
  edges: ModuleEdge[];
  findings: PurityFinding[];
  reachable: Set<string>;
};

export const repoPath = (root: string, absolute: string): string => relative(root, absolute).split(sep).join("/");
const edgeKey = (consumer: string, target: string): string => `${consumer}\u0000${target}`;

export const resolveModuleTarget = (root: string, source: SourceFile, value: string): string | null => {
  if (!value.startsWith(".")) return null;
  const raw = resolve(dirname(source.getFilePath()), value);
  const candidates = [raw];
  if (raw.endsWith(".js")) candidates.push(`${raw.slice(0, -3)}.ts`, `${raw.slice(0, -3)}.tsx`);
  if (raw.endsWith(".mjs")) candidates.push(`${raw.slice(0, -4)}.mts`);
  candidates.push(resolve(raw, "index.ts"), resolve(raw, "index.tsx"));
  const target = candidates.map((path) => source.getProject().getSourceFile(path)).find(Boolean);
  return target ? repoPath(root, target.getFilePath()) : null;
};

const resolvedPath = (root: string, declaration: ImportDeclaration): string | null => {
  const value = declaration.getModuleSpecifierValue();
  const direct = resolveModuleTarget(root, declaration.getSourceFile(), value);
  if (direct) return direct;
  const target = declaration.getModuleSpecifierSourceFile();
  if (target) return repoPath(root, target.getFilePath());
  return null;
};

const collectEdges = (input: PurityInput): { edges: ModuleEdge[]; findings: PurityFinding[] } => {
  const findings: PurityFinding[] = [];
  const edges: ModuleEdge[] = [];
  const allowedDynamic = new Set(input.manifest.lawfulDynamicImports.map((item) => edgeKey(item.consumerFilePath, item.targetFilePath)));
  const allowedSideEffects = new Set(input.manifest.lawfulSideEffectImports.map((item) => edgeKey(item.consumerFilePath, item.targetFilePath)));
  for (const source of input.sourceFiles) {
    const consumer = repoPath(input.root, source.getFilePath());
    for (const declaration of source.getImportDeclarations()) {
      const target = resolvedPath(input.root, declaration);
      if (!target) continue;
      const sideEffect = declaration.getImportClause() === undefined;
      if (sideEffect && !allowedSideEffects.has(edgeKey(consumer, target))) {
        findings.push(purityFinding("CODE_PURITY_SIDE_EFFECT_IMPORT_UNPROVEN", consumer, declaration.getStartLineNumber(), target));
        continue;
      }
      edges.push({ consumer, kind: sideEffect ? "side-effect" : "import", line: declaration.getStartLineNumber(), target });
    }
    for (const declaration of source.getExportDeclarations()) {
      const value = declaration.getModuleSpecifierValue();
      const targetSource = declaration.getModuleSpecifierSourceFile();
      const target = value ? resolveModuleTarget(input.root, source, value) : targetSource ? repoPath(input.root, targetSource.getFilePath()) : null;
      if (target) edges.push({ consumer, kind: "reexport", line: declaration.getStartLineNumber(), target });
    }
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
      const argument = call.getArguments()[0];
      if (!argument || (!Node.isStringLiteral(argument) && !Node.isNoSubstitutionTemplateLiteral(argument))) {
        findings.push(purityFinding("CODE_PURITY_DYNAMIC_IMPORT_NONLITERAL", consumer, call.getStartLineNumber(), call.getText()));
        continue;
      }
      const value = argument.getLiteralValue();
      if (!value.startsWith(".")) continue;
      const target = resolveModuleTarget(input.root, source, value);
      if (!target) {
        findings.push(purityFinding("CODE_PURITY_DYNAMIC_IMPORT_UNRESOLVED", consumer, call.getStartLineNumber(), value));
        continue;
      }
      if (!allowedDynamic.has(edgeKey(consumer, target))) {
        findings.push(purityFinding("CODE_PURITY_DYNAMIC_IMPORT_UNPROVEN", consumer, call.getStartLineNumber(), target));
        continue;
      }
      edges.push({ consumer, kind: "dynamic", line: call.getStartLineNumber(), target });
    }
  }
  return { edges, findings };
};

const ownerBoundaryFindings = (edges: ModuleEdge[]): PurityFinding[] => edges.flatMap((edge) => {
  const plugin = edge.consumer.includes("/plugins/");
  const privateCapability = edge.target.includes("/capabilities/") && edge.target.includes("/runtime/");
  const capabilityToPlugin = edge.consumer.includes("/capabilities/") && edge.target.includes("/plugins/");
  if (!plugin && !capabilityToPlugin || plugin && !privateCapability) return [];
  return [purityFinding("CODE_PURITY_OWNER_BOUNDARY_VIOLATION", edge.consumer, edge.line, `${edge.kind}->${edge.target}`)];
});

export function inspectModuleGraph(input: PurityInput): ModuleGraphResult {
  const collected = collectEdges(input);
  const byConsumer = new Map<string, ModuleEdge[]>();
  for (const edge of collected.edges) byConsumer.set(edge.consumer, [...(byConsumer.get(edge.consumer) ?? []), edge]);
  const entries = new Set([...input.entryScripts, ...input.manifest.externalEntryFiles]);
  const reachable = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of byConsumer.get(current) ?? []) if (!reachable.has(edge.target)) queue.push(edge.target);
  }
  const findings = [...collected.findings, ...ownerBoundaryFindings(collected.edges)];
  for (const source of input.sourceFiles) {
    const path = repoPath(input.root, source.getFilePath());
    if (!reachable.has(path)) findings.push(purityFinding("CODE_PURITY_ZOMBIE_FILE", path, 1, "not reachable from a lawful live entry"));
  }
  return { edges: collected.edges, findings, reachable };
}

export function existingEntryScripts(root: string, scripts: Record<string, string>): string[] {
  const entries = new Set<string>();
  for (const command of Object.values(scripts)) {
    for (const token of command.split(" ")) {
      const clean = token.trim();
      if (!clean.endsWith(".ts") && !clean.endsWith(".js") && !clean.endsWith(".mjs") && !clean.endsWith(".cjs")) continue;
      const absolute = resolve(root, clean);
      if (existsSync(absolute)) entries.add(repoPath(root, absolute));
    }
  }
  return [...entries].sort();
}
