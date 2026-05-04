import type { SourceFile } from "ts-morph";

import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getAuditProject, toRelativeSourcePath } from "../../core/ts-morph.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";

type ActiveAbilityGroup = {
  abilityGroupId: string;
  sourceDir: string;
  auditDomainDir: string;
};

type AuditManifest = {
  entry?: string;
};

type StandardPackageGroupFiles = {
  abilityGroupFile: string;
  contractFile: string;
  schemaFile: string;
  registryFile: string;
  indexFile: string;
  manifestFile: string;
  inspectorFile: string;
};

type StandardPackageGroupSources = {
  abilityGroupSource: SourceFile | undefined;
  contractSource: SourceFile | undefined;
  indexSource: SourceFile | undefined;
};

const ACTIVE_ABILITY_GROUPS: ActiveAbilityGroup[] = [
  { abilityGroupId: "ai", sourceDir: "src/capabilities/ai", auditDomainDir: "scripts/audit/domains/ai-capability" },
  { abilityGroupId: "commander-console", sourceDir: "src/capabilities/commander-console", auditDomainDir: "scripts/audit/domains/commander-console-capability" },
  { abilityGroupId: "forensics-persistence", sourceDir: "src/capabilities/forensics-persistence", auditDomainDir: "scripts/audit/domains/forensics-persistence-capability" },
  { abilityGroupId: "geometry-guard", sourceDir: "src/capabilities/geometry-guard", auditDomainDir: "scripts/audit/domains/geometry-guard-capability" },
  { abilityGroupId: "mouse-click", sourceDir: "src/capabilities/mouse-click", auditDomainDir: "scripts/audit/domains/mouse-click-capability" },
  { abilityGroupId: "mouse-scroll", sourceDir: "src/capabilities/mouse-scroll", auditDomainDir: "scripts/audit/domains/mouse-scroll-capability" },
  { abilityGroupId: "nerve-bus", sourceDir: "src/capabilities/nerve-bus", auditDomainDir: "scripts/audit/domains/nerve-bus-capability" },
  { abilityGroupId: "open", sourceDir: "src/capabilities/open", auditDomainDir: "scripts/audit/domains/open-capability" },
  { abilityGroupId: "orchestration", sourceDir: "src/capabilities/orchestration", auditDomainDir: "scripts/audit/domains/orchestration-capability" },
  { abilityGroupId: "page-state", sourceDir: "src/capabilities/page-state", auditDomainDir: "scripts/audit/domains/page-state-capability" },
  { abilityGroupId: "post-action-verification", sourceDir: "src/capabilities/post-action-verification", auditDomainDir: "scripts/audit/domains/post-action-verification-capability" },
  { abilityGroupId: "screenshot", sourceDir: "src/capabilities/screenshot", auditDomainDir: "scripts/audit/domains/screenshot-capability" },
  { abilityGroupId: "text-input", sourceDir: "src/capabilities/text-input", auditDomainDir: "scripts/audit/domains/text-input-capability" },
  { abilityGroupId: "visual-target", sourceDir: "src/capabilities/visual-target", auditDomainDir: "scripts/audit/domains/visual-target-capability" },
];

const getSourceFile = (relativePath: string): SourceFile | undefined =>
  getAuditProject().getSourceFile(pathFromRepoRoot(relativePath));

const hasResolvedImport = (sourceFile: SourceFile | undefined, targetRelativePath: string): boolean => {
  if (!sourceFile) {
    return false;
  }

  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedSource = declaration.getModuleSpecifierSourceFile();
    return resolvedSource ? toRelativeSourcePath(resolvedSource) === targetRelativePath : false;
  });
};

const hasResolvedExport = (sourceFile: SourceFile | undefined, targetRelativePath: string): boolean => {
  if (!sourceFile) {
    return false;
  }

  return sourceFile.getExportDeclarations().some((declaration) => {
    const resolvedSource = declaration.getModuleSpecifierSourceFile();
    return resolvedSource ? toRelativeSourcePath(resolvedSource) === targetRelativePath : false;
  });
};

const hasResolvedImportUnder = (sourceFile: SourceFile | undefined, directoryRelativePath: string): boolean => {
  if (!sourceFile) {
    return false;
  }

  const prefix = `${directoryRelativePath}/`;
  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedSource = declaration.getModuleSpecifierSourceFile();
    return resolvedSource ? toRelativeSourcePath(resolvedSource).startsWith(prefix) : false;
  });
};

const hasTypeScriptSourceUnder = (directoryRelativePath: string): boolean => {
  const prefix = `${directoryRelativePath}/`;
  return getAuditProject().getSourceFiles().some((sourceFile) => toRelativeSourcePath(sourceFile).startsWith(prefix));
};

const createStructureFinding = (lawId: string, file: string, message: string): Finding =>
  createFinding({
    lawId,
    file,
    line: 1,
    severity: "fatal",
    message,
  });

const buildGroupFiles = (group: ActiveAbilityGroup): StandardPackageGroupFiles => ({
  abilityGroupFile: `${group.sourceDir}/ability-group.ts`,
  contractFile: `${group.sourceDir}/contract.ts`,
  schemaFile: `${group.sourceDir}/schema.ts`,
  registryFile: `${group.sourceDir}/registry.ts`,
  indexFile: `${group.sourceDir}/index.ts`,
  manifestFile: `${group.auditDomainDir}/manifest.json`,
  inspectorFile: `${group.auditDomainDir}/inspector.ts`,
});

const buildGroupSources = (files: StandardPackageGroupFiles): StandardPackageGroupSources => ({
  abilityGroupSource: getSourceFile(files.abilityGroupFile),
  contractSource: getSourceFile(files.contractFile),
  indexSource: getSourceFile(files.indexFile),
});

const collectIndexPublicSurfaceFindings = (
  group: ActiveAbilityGroup,
  files: StandardPackageGroupFiles,
  sources: StandardPackageGroupSources,
): Finding[] => {
  const findings: Finding[] = [];

  if (!hasResolvedExport(sources.indexSource, files.abilityGroupFile)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-011",
      files.indexFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} to expose ability-group.ts through index.ts.`,
    ));
  }

  if (!hasResolvedImport(sources.abilityGroupSource, files.registryFile) && !hasResolvedExport(sources.indexSource, files.registryFile)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-014",
      files.indexFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep registry.ts wired through the governed package surface.`,
    ));
  }

  if (!sources.indexSource || sources.indexSource.getExportDeclarations().length === 0) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-015",
      files.indexFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} index.ts to remain the explicit public export surface.`,
    ));
  }

  return findings;
};

const collectContractAndSchemaFindings = (
  group: ActiveAbilityGroup,
  files: StandardPackageGroupFiles,
  sources: StandardPackageGroupSources,
): Finding[] => {
  const findings: Finding[] = [];

  if (!hasResolvedImport(sources.abilityGroupSource, files.contractFile) && !hasResolvedExport(sources.indexSource, files.contractFile)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-012",
      files.abilityGroupFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} ability-group.ts to resolve contract.ts.`,
    ));
  }

  if (!hasResolvedImport(sources.abilityGroupSource, files.schemaFile)
    && !hasResolvedImport(sources.contractSource, files.schemaFile)
    && !hasResolvedExport(sources.indexSource, files.schemaFile)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-013",
      sources.contractSource ? files.contractFile : files.indexFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep schema.ts wired through a governed package entrypoint.`,
    ));
  }

  return findings;
};

const collectDirectoryStructureFindings = (
  group: ActiveAbilityGroup,
  files: StandardPackageGroupFiles,
  sources: StandardPackageGroupSources,
): Finding[] => {
  const findings: Finding[] = [];

  if (!hasTypeScriptSourceUnder(`${group.sourceDir}/runtime`) || !hasResolvedImportUnder(sources.abilityGroupSource, `${group.sourceDir}/runtime`)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-016",
      files.abilityGroupFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} ability-group.ts to resolve runtime/ through the governed package structure.`,
    ));
  }

  if (!hasTypeScriptSourceUnder(`${group.sourceDir}/children`)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-017",
      group.sourceDir,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep children/ as a real source directory.`,
    ));
  }

  if (!hasTypeScriptSourceUnder(`${group.sourceDir}/ports`)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-018",
      group.sourceDir,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep ports/ as a real source directory.`,
    ));
  }

  if (!hasTypeScriptSourceUnder(`${group.sourceDir}/shared`)) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-019",
      group.sourceDir,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep shared/ as a real source directory.`,
    ));
  }

  return findings;
};

const collectAuditInspectorFinding = async (group: ActiveAbilityGroup, files: StandardPackageGroupFiles): Promise<Finding[]> => {
  const [manifestExists, inspectorExists] = await Promise.all([
    fileExists(pathFromRepoRoot(files.manifestFile)),
    fileExists(pathFromRepoRoot(files.inspectorFile)),
  ]);
  const manifest = manifestExists
    ? await readJsonFile<AuditManifest>(pathFromRepoRoot(files.manifestFile))
    : null;

  return !manifestExists || !inspectorExists || manifest?.entry !== files.inspectorFile
    ? [createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-020",
      manifestExists ? files.manifestFile : files.inspectorFile,
      `Ability Group Standard Package requires ${group.abilityGroupId} to keep a governed audit domain inspector with manifest entry ${files.inspectorFile}.`,
    )]
    : [];
};

const collectGroupStructureFindings = async (group: ActiveAbilityGroup): Promise<Finding[]> => {
  const files = buildGroupFiles(group);
  const sources = buildGroupSources(files);

  return [
    ...collectIndexPublicSurfaceFindings(group, files, sources),
    ...collectContractAndSchemaFindings(group, files, sources),
    ...collectDirectoryStructureFindings(group, files, sources),
    ...await collectAuditInspectorFinding(group, files),
  ];
};

export async function collectStandardPackageStructureFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const group of ACTIVE_ABILITY_GROUPS) {
    findings.push(...await collectGroupStructureFindings(group));
  }

  if (findings.some((finding) => finding.lawId >= "K02-BLUEPRINT-02-SECTION-010-REQ-011" && finding.lawId <= "K02-BLUEPRINT-02-SECTION-010-REQ-020")) {
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-009",
      STANDARD_PACKAGE_BLUEPRINT_FILE,
      "Index standard-package structure requires all 14 active ability groups to stay unified under one governed package shape.",
    ));
    findings.push(createStructureFinding(
      "K02-BLUEPRINT-02-SECTION-010-REQ-010",
      STANDARD_PACKAGE_BLUEPRINT_FILE,
      "Index standard-package structure requires every active ability group to satisfy the Ability Group Standard Package contract.",
    ));
  }

  return findings;
}