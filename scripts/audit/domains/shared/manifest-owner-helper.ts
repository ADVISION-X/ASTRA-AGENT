import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { SourceFile } from "ts-morph";

import {
  collectDynamicImportFindings,
  collectExportStarFindings,
  collectRequireCallFindings,
} from "../../core/anti-escape.js";
import {
  collectForbiddenTargetImportFindings,
  collectPrivateCrossOwnerImportFindings,
} from "../../core/import-graph.js";
import { loadOwnerManifest } from "../../core/owner-manifests.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult, OwnerManifest } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/;

const walkCodeFiles = (absolutePath: string, acc: string[] = []): string[] => {
  if (!existsSync(absolutePath)) return acc;
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const nextPath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkCodeFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
      acc.push(nextPath);
    }
  }
  return acc;
};

const ownerLawId = (manifest: OwnerManifest): string => manifest.allowedLawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1";

const ownerFinding = (...input: readonly [
  manifest: OwnerManifest,
  file: string,
  message: string,
  hint: string,
  line?: number,
]): Finding => {
  const [manifest, file, message, hint, line = 1] = input;
  return createFinding({ lawId: ownerLawId(manifest), file, line, severity: "fatal", message, hint });
};

const loadOwnedSourceFiles = (manifest: OwnerManifest): SourceFile[] => {
  const project = getAuditProject();
  const paths = (manifest.ownedRoots ?? [])
    .flatMap((ownedRoot) => walkCodeFiles(pathFromRepoRoot(ownedRoot)))
    .sort((left, right) => left.localeCompare(right));
  return paths
    .map((absolutePath) => project.addSourceFileAtPathIfExists(absolutePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
};

const requiredPathFindings = (manifest: OwnerManifest): Finding[] =>
  (manifest.requiredPaths ?? [])
    .filter((relativePath) => !existsSync(pathFromRepoRoot(relativePath)))
    .map((relativePath) => ownerFinding(
      manifest,
      relativePath,
      "manifest required path is missing",
      "Restore the governed owner path or correct the manifest boundary.",
    ));

const ownedScopeFindings = (manifest: OwnerManifest, sourceFiles: SourceFile[]): Finding[] => {
  if (sourceFiles.length > 0) return [];
  return [
    ownerFinding(
      manifest,
      toRepoRelativePath(pathFromRepoRoot(`scripts/audit/domains/${manifest.capabilityDomain}/manifest.json`)),
      "owner manifest does not resolve any governed source files",
      "Bind ownedRoots to the real source root for this capability domain.",
    ),
  ];
};

const importBoundaryFindings = (manifest: OwnerManifest, sourceFiles: SourceFile[]): Finding[] => [
  ...collectPrivateCrossOwnerImportFindings(sourceFiles, manifest.capabilityDomain, manifest.allowedCrossOwnerImports)
    .map((finding) => ownerFinding(
      manifest,
      finding.file,
      finding.message,
      "Use the other owner's public contract only.",
      finding.line,
    )),
  ...collectForbiddenTargetImportFindings(sourceFiles)
    .map((finding) => ownerFinding(
      manifest,
      finding.file,
      finding.message,
      "Do not use verify/smoke/acceptance as enforcement truth.",
      finding.line,
    )),
];

const antiEscapeFindings = (manifest: OwnerManifest, sourceFiles: SourceFile[]): Finding[] => {
  const findings = [
    ...collectExportStarFindings(sourceFiles),
    ...collectRequireCallFindings(sourceFiles),
    ...(manifest.allowDynamicImport ? [] : collectDynamicImportFindings(sourceFiles)),
  ];
  return findings.map((finding) => ownerFinding(
    manifest,
    finding.file,
    finding.message,
    "Remove the escape hatch and keep the owner boundary explicit.",
    finding.line,
  ));
};

export const runManifestOwnerInspector = async (
  manifestPath: string,
  _context: InspectorContext,
): Promise<InspectorResult> => {
  const manifest = loadOwnerManifest(manifestPath);
  const sourceFiles = loadOwnedSourceFiles(manifest);
  const findings = [
    ...requiredPathFindings(manifest),
    ...ownedScopeFindings(manifest, sourceFiles),
    ...importBoundaryFindings(manifest, sourceFiles),
    ...antiEscapeFindings(manifest, sourceFiles),
  ];
  const passed = findings.length === 0;
  const phases = [
    createPhase("required-paths", passed ? "PASS" : "CODE VIOLATION", passed, "manifest boundary checked."),
    createPhase("owned-scope", passed ? "PASS" : "CODE VIOLATION", passed, "owned scope resolved."),
    createPhase("import-graph", passed ? "PASS" : "CODE VIOLATION", passed, "import graph boundary checked."),
    createPhase("anti-escape", passed ? "PASS" : "CODE VIOLATION", passed, "anti-escape checked."),
  ];

  return finalizeInspectorResult({
    inspector: manifest.capabilityDomain,
    inspectorId: manifest.inspectorId,
    capabilityDomain: manifest.capabilityDomain,
    findings,
    phases,
    summary: passed
      ? `${manifest.capabilityDomain} owner boundary is covered.`
      : `${manifest.capabilityDomain} owner boundary has blocking findings.`,
  });
};
