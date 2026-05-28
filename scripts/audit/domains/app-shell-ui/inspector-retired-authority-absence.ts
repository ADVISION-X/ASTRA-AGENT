import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const legacyLawIdValue = "GRASSEYE-APP-SHELL-UI-PHYSICAL-CLEANUP-001-V1";
const lawPath = ".github/instructions/agent-rules/modules/module-app-shell-ui.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye App Shell UI 施工图.md";
const legacyDocPath = "docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md";
const packagePath = "package.json";
const migrationTablePath = "MIGRATION_FILE_DECISION_TABLE.md";
const blueprintAnchor = "## 23. Legacy APP User-Demand Authority Physical Absence";
const legacyDocTitle = "GrassEye APP 用户需求启动施工图";
const legacyDocMarkers = [
  legacyDocTitle,
  "任务入口不是通用需求引擎",
  "POST /api/amazon-invoice-upload/mission",
] as const;
const ignoredDirectoryNames = new Set([".git", "dist", "node_modules", "runtime-evidence", "tmp", "tmp-probe", "tmp-probe2"]);
const allowedGovernancePaths = new Set([
  lawPath,
  blueprintPath,
  "scripts/audit/domains/app-shell-ui/inspector.ts",
  "scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.ts",
  "scripts/acceptance/app-shell-ui.acceptance.ts",
]);

const hasLegacyReference = (value: string): boolean =>
  value.includes(legacyDocPath) || value.includes(legacyDocTitle);

const countLegacyMarkerHits = (value: string): number =>
  legacyDocMarkers.reduce((count, marker) => count + (value.includes(marker) ? 1 : 0), 0);

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const collectSourceStringLiterals = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
];

const walkMarkdownFiles = (directoryPath: string, repoPaths: string[]): void => {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) continue;
      walkMarkdownFiles(join(directoryPath, entry.name), repoPaths);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    repoPaths.push(toRepoPath(join(directoryPath, entry.name)));
  }
};

const inspectAuthorityClauses = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(lawPath);
  inspectedFiles.add(blueprintPath);
  if (!readRepoText(lawPath).includes(legacyLawIdValue)) {
    findings.push(createFinding({
      checkId: "app-shell-ui/legacy-cleanup-law",
      lawId,
      filePath: lawPath,
      message: "App Shell UI law must include the legacy APP user-demand physical absence clause.",
    }));
  }
  if (!readRepoText(blueprintPath).includes(blueprintAnchor)) {
    findings.push(createFinding({
      checkId: "app-shell-ui/legacy-cleanup-blueprint",
      lawId,
      filePath: blueprintPath,
      message: "App Shell UI blueprint must include the legacy APP user-demand physical absence section.",
    }));
  }
};

const inspectLegacyDocumentAbsence = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(legacyDocPath);
  if (!existsSync(resolveFromRepo(legacyDocPath))) {
    return;
  }
  findings.push(createFinding({
    checkId: "app-shell-ui/legacy-doc-present",
    lawId,
    filePath: legacyDocPath,
    message: "Legacy APP user-demand startup blueprint must be physically absent.",
  }));
};

const inspectSourceReferences = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = toRepoPath(sourceFile.getFilePath());
    if (!repoPath.startsWith("src/app/")) continue;
    const legacyLiteral = collectSourceStringLiterals(sourceFile).find((literal) => hasLegacyReference(literal));
    if (!legacyLiteral) continue;
    inspectedFiles.add(repoPath);
    findings.push(createFinding({
      checkId: "app-shell-ui/legacy-doc-source-reference",
      lawId,
      filePath: repoPath,
      message: "App source must not reference the deleted legacy APP user-demand startup blueprint.",
      evidence: legacyLiteral,
    }));
  }
};

const inspectPackageReference = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(packagePath);
  const packageText = readRepoText(packagePath);
  if (!hasLegacyReference(packageText)) {
    return;
  }
  findings.push(createFinding({
    checkId: "app-shell-ui/legacy-doc-package-reference",
    lawId,
    filePath: packagePath,
    message: "package.json must not reference the deleted legacy APP user-demand startup blueprint.",
  }));
};

const inspectMarkdownReferencesAndCopies = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const markdownPaths: string[] = [];
  walkMarkdownFiles(resolveFromRepo("."), markdownPaths);
  for (const repoPath of markdownPaths) {
    if (allowedGovernancePaths.has(repoPath)) continue;
    const content = readRepoText(repoPath);
    const markerHits = countLegacyMarkerHits(content);
    if (!content.includes(legacyDocPath) && markerHits < 2) {
      continue;
    }
    inspectedFiles.add(repoPath);
    findings.push(createFinding({
      checkId: content.includes(legacyDocPath)
        ? "app-shell-ui/legacy-doc-markdown-reference"
        : "app-shell-ui/legacy-doc-markdown-copy",
      lawId,
      filePath: repoPath,
      message: content.includes(legacyDocPath)
        ? "Non-governance markdown must not reference the deleted legacy APP user-demand startup blueprint path."
        : "Legacy APP user-demand startup blueprint content must not survive as a copied markdown authority.",
    }));
  }
};

export const inspectLegacyAppUserDemandPhysicalAbsence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
): void => {
  const lawId = selectLawId(context.planEntry.lawIds, legacyLawIdValue);
  inspectedFiles.add(migrationTablePath);
  inspectAuthorityClauses(findings, inspectedFiles, lawId);
  inspectLegacyDocumentAbsence(findings, inspectedFiles, lawId);
  inspectSourceReferences(context, findings, inspectedFiles, lawId);
  inspectPackageReference(findings, inspectedFiles, lawId);
  inspectMarkdownReferencesAndCopies(findings, inspectedFiles, lawId);
};
