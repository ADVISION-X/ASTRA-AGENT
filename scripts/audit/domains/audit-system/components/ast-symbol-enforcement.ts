import { existsSync } from "node:fs";

import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding, OwnerManifest } from "../../../core/schema.js";
import { getAuditProject, getSourceFileOrThrow } from "../../../core/ts-morph.js";

import type { SourceFile } from "ts-morph";

const qualityFinding = (manifest: OwnerManifest, file: string, message: string, hint: string): Finding =>
  createFinding({
    lawId: manifest.allowedLawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1",
    file,
    line: 1,
    severity: "fatal",
    message,
    hint,
  });

const collectInspectorSupportFiles = (entryFile: SourceFile, depthLimit = 3): SourceFile[] => {
  const project = getAuditProject();
  const queue: Array<{ sourceFile: SourceFile; depth: number }> = [{ sourceFile: entryFile, depth: 0 }];
  const visited = new Set<string>();
  const collected: SourceFile[] = [];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;
    const filePath = next.sourceFile.getFilePath();
    if (visited.has(filePath)) continue;
    visited.add(filePath);
    collected.push(next.sourceFile);
    if (next.depth >= depthLimit) continue;
    for (const importDeclaration of next.sourceFile.getImportDeclarations()) {
      const specifier = importDeclaration.getModuleSpecifierValue();
      if (!specifier.startsWith(".")) continue;
      const sourceFile = importDeclaration.getModuleSpecifierSourceFile();
      if (!sourceFile) continue;
      project.addSourceFileAtPathIfExists(sourceFile.getFilePath());
      queue.push({ sourceFile, depth: next.depth + 1 });
    }
  }

  return collected;
};

const hasAstEvidence = (sourceFiles: SourceFile[]): boolean =>
  sourceFiles.some((sourceFile) => {
    const importedTsMorph = sourceFile.getImportDeclarations().some((decl) => decl.getModuleSpecifierValue() === "ts-morph");
    const usesAuditProject = sourceFile.getImportDeclarations().some((decl) =>
      decl.getModuleSpecifierValue().endsWith("/ts-morph.js")
        && decl.getNamedImports().some((namedImport) => namedImport.getName() === "getAuditProject"),
    );
    const text = sourceFile.getFullText();
    return importedTsMorph
      || usesAuditProject
      || text.includes("getImportDeclarations")
      || text.includes("getSymbol(")
      || text.includes("findReferencesAsNodes")
      || text.includes("Node.");
  });

const hasResultCarrier = (sourceFiles: SourceFile[]): boolean =>
  sourceFiles.some((sourceFile) => {
    const text = sourceFile.getFullText();
    return text.includes("findings")
      || text.includes("checks")
      || text.includes("finalizeInspectorResult")
      || text.includes("passed")
      || text.includes("pass:");
  });

const runnerBlocksOnFailure = (runnerFile: SourceFile): boolean =>
  runnerFile.getFullText().includes("process.exit(1)");

export const runAstSymbolEnforcement = (manifests: OwnerManifest[]): { findings: Finding[] } => {
  const findings: Finding[] = [];
  const project = getAuditProject();

  for (const manifest of manifests) {
    if (!manifest.entry || !existsSync(pathFromRepoRoot(manifest.entry))) continue;
    const entryFile = getSourceFileOrThrow(project, manifest.entry);
    const supportFiles = collectInspectorSupportFiles(entryFile);
    const exportedNames = entryFile.getExportedDeclarations();
    const filePath = toRepoRelativePath(entryFile.getFilePath());
    const exportName = manifest.exportName ?? "";

    if (exportName && !exportedNames.has(exportName)) {
      findings.push(qualityFinding(manifest, filePath, `manifest exportName is not exported by inspector entry: ${exportName}`, "Export one authoritative runXInspector symbol from the entry file."));
    }
    if (!hasAstEvidence(supportFiles)) {
      findings.push(qualityFinding(manifest, filePath, "owner inspector has no decisive AST/symbol/import-graph evidence", "Back the decisive verdict with ts-morph AST or symbol analysis."));
    }
    if (!hasResultCarrier(supportFiles)) {
      findings.push(qualityFinding(manifest, filePath, "owner inspector has no findings/pass result carrier", "Return findings and a blocking pass/fail result from the owner inspector."));
    }

    if (manifest.runner && existsSync(pathFromRepoRoot(manifest.runner))) {
      const runnerFile = getSourceFileOrThrow(project, manifest.runner);
      if (!runnerBlocksOnFailure(runnerFile)) {
        findings.push(qualityFinding(manifest, manifest.runner, "runner does not block on owner inspector failure", "Exit non-zero when the owner inspector reports failure."));
      }
    }

    const forbiddenImports = supportFiles.flatMap((sourceFile) => sourceFile.getImportDeclarations()
      .filter((decl) => /(scripts\/acceptance|verify|smoke|capability-check)/.test(decl.getModuleSpecifierValue()))
      .map((decl) => qualityFinding(
        manifest,
        toRepoRelativePath(sourceFile.getFilePath()),
        `owner inspector imports forbidden verify/smoke target: ${decl.getModuleSpecifierValue()}`,
        "Inspect real code directly; do not delegate enforcement truth to smoke or verify scripts.",
      )));
    findings.push(...forbiddenImports);
  }

  return { findings };
};