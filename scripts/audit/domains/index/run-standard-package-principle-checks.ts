import type { SourceFile } from "ts-morph";

import { fileExists, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, toRelativeSourcePath } from "../../core/ts-morph.js";

const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";
const SECTION_21_HEADING = "### 2.1 统一模式原则";

type SectionRequirement = {
  requirementId: string;
  expectedLine: string;
};

type ActiveAbilityGroup = {
  abilityGroupId: string;
  sourceDir: string;
  auditDomainDir: string;
};

type AuditManifest = {
  entry?: string;
};

const SECTION_21_TAIL_REQUIREMENTS: SectionRequirement[] = [
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-009", expectedLine: "所有能力组必须统一成：" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-010", expectedLine: "Ability Group Standard Package" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-011", expectedLine: "├── ability-group.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-012", expectedLine: "├── contract.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-013", expectedLine: "├── schema.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-014", expectedLine: "├── registry.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-015", expectedLine: "├── index.ts" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-016", expectedLine: "├── runtime/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-017", expectedLine: "├── children/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-018", expectedLine: "├── ports/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-019", expectedLine: "├── shared/" },
  { requirementId: "K02-BLUEPRINT-02-SECTION-010-REQ-020", expectedLine: "└── audit domain inspector" },
] as const;

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
] as const;

const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ") || line.startsWith("### ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

const buildBlueprintNeedle = (requirementId: string): string =>
  `Index standard-package blueprint section 2.1 must keep the exact line for ${requirementId}.`;

const buildPhaseName = (requirementId: string): string =>
  `standard-package-section-21-${requirementId.toLowerCase()}`;

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

async function collectStructureFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const group of ACTIVE_ABILITY_GROUPS) {
    const abilityGroupFile = `${group.sourceDir}/ability-group.ts`;
    const contractFile = `${group.sourceDir}/contract.ts`;
    const schemaFile = `${group.sourceDir}/schema.ts`;
    const registryFile = `${group.sourceDir}/registry.ts`;
    const indexFile = `${group.sourceDir}/index.ts`;
    const manifestFile = `${group.auditDomainDir}/manifest.json`;
    const inspectorFile = `${group.auditDomainDir}/inspector.ts`;

    const abilityGroupSource = getSourceFile(abilityGroupFile);
  const contractSource = getSourceFile(contractFile);
    const indexSource = getSourceFile(indexFile);

    if (!hasResolvedExport(indexSource, abilityGroupFile)) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-011",
        indexFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} to expose ability-group.ts through index.ts.`,
      ));
    }

    if (!hasResolvedImport(abilityGroupSource, contractFile) && !hasResolvedExport(indexSource, contractFile)) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-012",
        abilityGroupFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} ability-group.ts to resolve contract.ts.`,
      ));
    }

    if (!hasResolvedImport(abilityGroupSource, schemaFile)
      && !hasResolvedImport(contractSource, schemaFile)
      && !hasResolvedExport(indexSource, schemaFile)) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-013",
        contractSource ? contractFile : indexFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} to keep schema.ts wired through a governed package entrypoint.`,
      ));
    }

    if (!hasResolvedImport(abilityGroupSource, registryFile) && !hasResolvedExport(indexSource, registryFile)) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-014",
        indexFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} to keep registry.ts wired through the governed package surface.`,
      ));
    }

    if (!indexSource || indexSource.getExportDeclarations().length === 0) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-015",
        indexFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} index.ts to remain the explicit public export surface.`,
      ));
    }

    if (!hasTypeScriptSourceUnder(`${group.sourceDir}/runtime`) || !hasResolvedImportUnder(abilityGroupSource, `${group.sourceDir}/runtime`)) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-016",
        abilityGroupFile,
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

    const [manifestExists, inspectorExists] = await Promise.all([
      fileExists(pathFromRepoRoot(manifestFile)),
      fileExists(pathFromRepoRoot(inspectorFile)),
    ]);
    const manifest = manifestExists
      ? await readJsonFile<AuditManifest>(pathFromRepoRoot(manifestFile))
      : null;

    if (!manifestExists || !inspectorExists || manifest?.entry !== inspectorFile) {
      findings.push(createStructureFinding(
        "K02-BLUEPRINT-02-SECTION-010-REQ-020",
        manifestExists ? manifestFile : inspectorFile,
        `Ability Group Standard Package requires ${group.abilityGroupId} to keep a governed audit domain inspector with manifest entry ${inspectorFile}.`,
      ));
    }
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

export async function runStandardPackagePrincipleChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const content = await readTextFile(pathFromRepoRoot(STANDARD_PACKAGE_BLUEPRINT_FILE));
  const section21Lines = extractSectionLines(content.split(/\r?\n/), SECTION_21_HEADING);

  const findings = SECTION_21_TAIL_REQUIREMENTS
    .filter((requirement) => !section21Lines.includes(requirement.expectedLine))
    .map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: STANDARD_PACKAGE_BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: buildBlueprintNeedle(requirement.requirementId),
    }));

  findings.push(...await collectStructureFindings());

  return {
    findings,
    phases: SECTION_21_TAIL_REQUIREMENTS.map((requirement) => {
      const requirementFindings = findings.filter((finding) => finding.lawId === requirement.requirementId);
      return createPhase(
        buildPhaseName(requirement.requirementId),
        requirementFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        requirementFindings.length === 0,
        requirementFindings.length === 0
          ? `${requirement.requirementId} remains enforced in blueprint-02 section 2.1 and active source structure.`
          : `${requirement.requirementId} drifted in blueprint-02 section 2.1 or active source structure.`,
      );
    }),
  };
}