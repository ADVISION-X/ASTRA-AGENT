import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const retiredTerms = [
  decode("bGVnYWN5XzFfbl9uXzE="),
  decode("ZmluYWxfc3ludGhlc2lz"),
  decode("ZGVja19leHBvcnRfcGFydGlhbA=="),
  decode("ZGVjaXNpb24tcGFja2FnZS5qc29u"),
  decode("cmVzZWFyY2gtYnVuZGxlLmpzb24="),
  decode("YnVzaW5lc3MtZGVjay1vdXRsaW5l"),
  decode("YnVzaW5lc3MtZGVjay5wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5haS1wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5sb2NhbC1wcHR4"),
  decode("b3B0aW9uYWwgcHJlc2VudGF0aW9uIGRlY2s="),
  decode("T3BlbiBQUFQ=").toLowerCase(),
  decode("RG93bmxvYWQgUFBU").toLowerCase(),
  decode("T3BlbiBEZWNrIE91dGxpbmU=").toLowerCase(),
] as const;

const scanTargets = [
  ".github/instructions/agent-rules/modules/module-deep-research-analysis.instructions.md",
  "docs/法案辅助文件/GrassEye Deep Research Analysis Job Flow 施工图.md",
  "src/plugins/deep-research-analysis",
  "src/app",
  "scripts/acceptance",
  "scripts/audit/domains/deep-research-analysis",
  "scripts/audit/domains/local-app-shell/components/scan-deep-research-report-reader-ui.ts",
] as const;

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".json"]);

const collectRepoFiles = (repoPath: string): string[] => {
  const absolutePath = resolveFromRepo(repoPath);
  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    return allowedExtensions.has(path.extname(repoPath)) ? [repoPath] : [];
  }
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "generated" || entry.name === "fixtures") {
      return [];
    }
    return collectRepoFiles(path.posix.join(repoPath, entry.name));
  });
};

export const inspectDeleteRetiredDeepResearchPaths = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const stringValues = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue().toLowerCase());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const found = retiredTerms.filter((term) =>
      stringValues.some((value) => value.includes(term.toLowerCase()))
      || identifiers.some((value) => value === term),
    );
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/delete-retired-path",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Retired Deep Research path markers remain in active runtime source.",
    }));
  }

  for (const repoPath of scanTargets.flatMap(collectRepoFiles)) {
    input.inspectedFiles.add(repoPath);
    const text = readFileSync(resolveFromRepo(repoPath), "utf8").toLowerCase();
    const found = retiredTerms.filter((term) => text.includes(term.toLowerCase()));
    if (found.length === 0) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/delete-retired-doc-path",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Retired Deep Research path markers remain in active docs, audit, acceptance, or UI surfaces.",
    }));
  }
};
