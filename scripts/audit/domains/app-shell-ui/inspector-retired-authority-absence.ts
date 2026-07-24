import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { extractMarkdownHeadings, normalizeMarkdownHeading } from "../../shared/no-regex.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const legacyLawIdValue = "GRASSEYE-APP-SHELL-UI-PHYSICAL-CLEANUP-001-V1";
const lawPath = ".github/instructions/agent-rules/modules/module-app-shell-ui.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye App Shell UI 施工图.md";
const legacyDocPath = "docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md";
const packagePath = "package.json";
const migrationTablePath = "MIGRATION_FILE_DECISION_TABLE.md";
const blueprintAnchor = "## 23. Legacy APP User-Demand Authority Physical Absence";
const legacyDocTitle = "GrassEye APP 用户需求启动施工图";

const hasLegacyReference = (value: string): boolean =>
  value.includes(legacyDocPath) || value.includes(legacyDocTitle);

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const collectSourceStringLiterals = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
];

const inspectAuthorityClauses = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(lawPath);
  inspectedFiles.add(blueprintPath);
  if (!context.planEntry.lawIds.some((lawId) => lawId === legacyLawIdValue)) {
    findings.push(createFinding({
      checkId: "app-shell-ui/legacy-cleanup-law",
      lawId,
      filePath: lawPath,
      message: "App Shell UI law must include the legacy APP user-demand physical absence clause.",
    }));
  }
  const blueprintHeadings = extractMarkdownHeadings(readRepoText(blueprintPath));
  if (!blueprintHeadings.has(normalizeMarkdownHeading(blueprintAnchor))) {
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
  const packageJson = JSON.parse(readRepoText(packagePath)) as {
    scripts?: Record<string, string>;
  };
  const legacyScript = Object.values(packageJson.scripts ?? {}).find((script) => hasLegacyReference(script));
  if (!legacyScript) {
    return;
  }
  findings.push(createFinding({
    checkId: "app-shell-ui/legacy-doc-package-reference",
    lawId,
    filePath: packagePath,
    message: "package.json must not reference the deleted legacy APP user-demand startup blueprint.",
  }));
};

export const inspectLegacyAppUserDemandPhysicalAbsence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
): void => {
  const lawId = selectLawId(context.planEntry.lawIds, legacyLawIdValue);
  inspectedFiles.add(migrationTablePath);
  inspectAuthorityClauses(context, findings, inspectedFiles, lawId);
  inspectLegacyDocumentAbsence(findings, inspectedFiles, lawId);
  inspectSourceReferences(context, findings, inspectedFiles, lawId);
  inspectPackageReference(findings, inspectedFiles, lawId);
};
