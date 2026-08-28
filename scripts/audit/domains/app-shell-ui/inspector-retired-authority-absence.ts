import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const legacyDocPath = "docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md";
const legacyDocTitle = "GrassEye APP 用户需求启动施工图";
const legacyExamPath = "scripts/acceptance/app-shell-retired-authority-absence.acceptance.ts";
const textExtensions = new Set([
  "", ".cjs", ".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs",
  ".scss", ".sql", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

const enforcementMentionAllowed = (path: string): boolean => path === ".github/instructions/agent-rules/基础法案.md"
  || path === ".github/instructions/agent-rules/功能法案.md"
  || path === legacyExamPath
  || path.startsWith("scripts/audit/domains/app-shell-ui/")
  || path.startsWith("tests/governance/");

const legacyExamRequiredTokens = [
  `const legacyDocPath = "${legacyDocPath}"`,
  `const legacyDocTitle = "${legacyDocTitle}"`,
  '"git", ["ls-files", "--cached", "--others", "--exclude-standard"]',
  "assert.equal(existsSync(legacyDocPath), false",
  "for (const path of repositoryPaths().filter(governedPath))",
  "assert.equal(copiedVariant, false",
  "source.includes(legacyDocPath) || source.includes(legacyDocTitle)",
  "assert.equal(referencesRetiredAuthority, false",
  "acceptance:app-shell-ui:retired-startup-blueprint-physical-absence",
  "retired APP user-demand startup blueprint path, copied variants, and non-governance references are physically absent",
] as const;

export const retiredAuthorityExamContractViolations = (source: string): string[] =>
  legacyExamRequiredTokens.filter((token) => !source.includes(token));

const addFinding = (
  findings: InspectorFinding[], lawId: string, checkId: string, filePath: string, message: string,
): void => {
  findings.push(createFinding({ evidenceMode: "static.ast", checkId, lawId, filePath, message }));
};

export const inspectLegacyAppUserDemandPhysicalAbsence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const examSource = readFileSync(resolveFromRepo(legacyExamPath), "utf8");
  for (const token of retiredAuthorityExamContractViolations(examSource)) {
    addFinding(findings, lawId, "app-shell-ui/legacy-exam-object-binding", legacyExamPath,
      `Retired-authority Exam is missing semantic object binding ${token}.`);
  }
  if (existsSync(resolveFromRepo(legacyDocPath))) {
    addFinding(findings, lawId, "app-shell-ui/legacy-doc-present", legacyDocPath,
      "Legacy APP user-demand startup blueprint must be physically absent.");
  }

  for (const path of context.targetPaths) {
    inspectedFiles.add(path);
    const normalized = path.toLocaleLowerCase("en-US");
    if (normalized !== legacyDocPath.toLocaleLowerCase("en-US")
      && (normalized.includes(legacyDocTitle.toLocaleLowerCase("en-US"))
        || normalized.includes("grasseye app user demand startup"))) {
      addFinding(findings, lawId, "app-shell-ui/legacy-doc-copy-path", path,
        "Retired, archived, hidden, and renamed copies of the legacy APP startup blueprint are forbidden.");
    }
    if (enforcementMentionAllowed(path) || !textExtensions.has(extname(path).toLocaleLowerCase("en-US"))) continue;
    const source = readFileSync(resolveFromRepo(path), "utf8");
    if (!source.includes(legacyDocPath) && !source.includes(legacyDocTitle)) continue;
    addFinding(findings, lawId, "app-shell-ui/legacy-doc-reference", path,
      "Non-governance source, package, migration, or documentation must not reference the deleted legacy blueprint.");
  }
};
