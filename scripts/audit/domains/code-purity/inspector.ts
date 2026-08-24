import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Project, SyntaxKind, type SourceFile } from "ts-morph";

import { inspectCommentedCode } from "./commented-code.js";
import { inspectDeclarationLiveness } from "./liveness.js";
import { existingEntryScripts, inspectModuleGraph, repoPath, resolveModuleTarget } from "./module-graph.js";
import { inspectStructuralPurity } from "./structural.js";
import { emptyManifest, type PurityFinding, type PurityInput, type PurityManifest } from "./types.js";

type PackageJson = { scripts?: Record<string, string> };

const excluded = (path: string): boolean => path.includes("/node_modules/")
  || path.includes("/dist/")
  || path.startsWith("scripts/acceptance/fixtures/")
  || path.startsWith("scripts/audit/generated/")
  || path.startsWith("src/plugins/xuanxue-ai-production/generated/")
  || path.endsWith(".d.ts")
  || path.endsWith(".d.mts")
  || path.endsWith(".d.cts");

const sourceFiles = (project: Project, root: string): SourceFile[] => project.getSourceFiles()
  .filter((source) => {
    const path = repoPath(root, source.getFilePath());
    return (path.startsWith("src/") || path.startsWith("scripts/")) && !excluded(path);
  })
  .sort((left, right) => left.getFilePath().localeCompare(right.getFilePath()));

const browserExternalEntries = (root: string, project: Project): string[] => {
  const manifestPath = resolve(root, "src/lib/browser/chrome-extension/manifest.json");
  if (!existsSync(manifestPath)) return [];
  const raw = readFileSync(manifestPath, "utf8");
  let manifest: unknown;
  try { manifest = JSON.parse(raw); } catch { return []; }
  const values: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(manifest);
  const manifestEntries = values.flatMap((value) => {
    if (!value.endsWith(".js")) return [];
    const tsPath = `src/lib/browser/chrome-extension/${value.slice(0, -3)}.ts`;
    return existsSync(resolve(root, tsPath)) ? [tsPath] : [];
  });
  const build = project.getSourceFile(resolve(root, "src/lib/browser/chrome-extension/build.mjs"));
  const buildEntries = build?.getDescendantsOfKind(SyntaxKind.StringLiteral).flatMap((literal) => {
    const value = literal.getLiteralValue();
    if (!value.endsWith(".ts") || value.includes("/")) return [];
    const path = `src/lib/browser/chrome-extension/${value}`;
    return existsSync(resolve(root, path)) ? [path] : [];
  }) ?? [];
  return [...new Set([...manifestEntries, ...buildEntries])].sort();
};

const normalizedManifest = (manifest: Partial<PurityManifest> | undefined): PurityManifest => ({
  externalEntryExports: manifest?.externalEntryExports ?? [],
  externalEntryFiles: manifest?.externalEntryFiles ?? [],
  lawfulDynamicImports: manifest?.lawfulDynamicImports ?? [],
  lawfulDynamicRegistryConsumers: manifest?.lawfulDynamicRegistryConsumers ?? [],
  lawfulSideEffectImports: manifest?.lawfulSideEffectImports ?? [],
});

const browserManifestSideEffects = (root: string, project: Project, entries: string[]): PurityManifest["lawfulSideEffectImports"] => entries.flatMap((consumerFilePath) => {
  const source = project.getSourceFile(resolve(root, consumerFilePath));
  if (!source) return [];
  return source.getImportDeclarations().flatMap((declaration) => {
    if (declaration.getImportClause() !== undefined) return [];
    const targetFilePath = resolveModuleTarget(root, source, declaration.getModuleSpecifierValue());
    return targetFilePath ? [{ consumerFilePath, targetFilePath }] : [];
  });
});

export function inspectCodePurityInput(input: PurityInput): PurityFinding[] {
  const graph = inspectModuleGraph(input);
  const findings = [
    ...graph.findings,
    ...inspectCommentedCode(input),
    ...inspectStructuralPurity(input),
    ...inspectDeclarationLiveness(input, graph),
  ];
  const unique = new Map(findings.map((item) => [`${item.code}\u0000${item.path}\u0000${item.line}\u0000${item.symbol ?? ""}\u0000${item.detail}`, item]));
  return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.code.localeCompare(right.code));
}

export function inspectCodePurity(root = process.cwd(), manifest?: Partial<PurityManifest>): PurityFinding[] {
  const project = new Project({ compilerOptions: { allowJs: true }, tsConfigFilePath: resolve(root, "tsconfig.json") });
  project.addSourceFilesAtPaths([
    resolve(root, "scripts/**/*.cjs"),
    resolve(root, "scripts/**/*.js"),
    resolve(root, "scripts/**/*.mjs"),
    resolve(root, "src/**/*.cjs"),
    resolve(root, "src/**/*.js"),
    resolve(root, "src/**/*.mjs"),
  ]);
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as PackageJson;
  const browserEntries = browserExternalEntries(root, project);
  const entries = new Set([...existingEntryScripts(root, pkg.scripts ?? {}), ...browserEntries, ...(manifest?.externalEntryFiles ?? [])]);
  const configured = normalizedManifest(manifest ?? emptyManifest());
  const input: PurityInput = {
    entryScripts: [...entries].sort(),
    manifest: {
      ...configured,
      lawfulSideEffectImports: [...configured.lawfulSideEffectImports, ...browserManifestSideEffects(root, project, browserEntries)],
    },
    project,
    root,
    sourceFiles: sourceFiles(project, root),
  };
  return inspectCodePurityInput(input);
}
