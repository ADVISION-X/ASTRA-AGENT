import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  collectDynamicImportFindings,
  collectExportStarFindings,
  collectRequireCallFindings,
  collectSuppressionDirectiveFindings,
  collectUnknownLaunderingFindings,
} from "../../../core/anti-escape.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getAuditProject } from "../../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { runCodePurityInspector } from "../../code-purity/inspector.js";

import type { SourceFile } from "ts-morph";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/;
const ALLOWED_DYNAMIC_IMPORT_FILES = new Set([
  "scripts/audit/domains/shared/run-manifest-owner.ts",
  "scripts/audit/law-enforcement/owner-verdicts.ts",
]);

const walkFiles = (absolutePath: string, acc: string[] = []): string[] => {
  if (!existsSync(absolutePath)) return acc;
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const nextPath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
      acc.push(nextPath);
    }
  }
  return acc;
};

const toFinding = (file: string, line: number, message: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
    file,
    line,
    severity: "fatal",
    message,
    hint: "Remove the escape hatch and keep the type and ownership boundary explicit.",
  });

const collectAuditSourceFiles = (): SourceFile[] => {
  const project = getAuditProject();
  const files = [
    ...walkFiles(pathFromRepoRoot("src")),
    ...walkFiles(pathFromRepoRoot("scripts/audit")),
  ];
  return files
    .map((absolutePath) => project.addSourceFileAtPathIfExists(absolutePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
};

export const runAuditSystemAntiEscape = (): { findings: Finding[] } => {
  const sourceFiles = collectAuditSourceFiles();
  const codePurityFindings = runCodePurityInspector().findings
    .filter((finding) => finding.rule === "CP-AST-001" || finding.rule === "CP-AST-002" || finding.rule === "CP-AST-003")
    .map((finding) => toFinding(finding.file, finding.line, finding.message));
  const dynamicImportFindings = collectDynamicImportFindings(sourceFiles)
    .filter((finding) => !ALLOWED_DYNAMIC_IMPORT_FILES.has(finding.file))
    .map((finding) => toFinding(finding.file, finding.line, finding.message));
  const findings = [
    ...codePurityFindings,
    ...collectSuppressionDirectiveFindings(sourceFiles).map((finding) => toFinding(finding.file, finding.line, finding.message)),
    ...collectExportStarFindings(sourceFiles).map((finding) => toFinding(finding.file, finding.line, finding.message)),
    ...collectRequireCallFindings(sourceFiles).map((finding) => toFinding(finding.file, finding.line, finding.message)),
    ...dynamicImportFindings,
    ...collectUnknownLaunderingFindings(sourceFiles).map((finding) => toFinding(finding.file, finding.line, finding.message)),
  ];
  return { findings };
};