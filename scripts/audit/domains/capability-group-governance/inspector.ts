import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { SourceFile } from "ts-morph";

import {
  collectCapabilityGroupPrivateImportFindings,
  collectForbiddenTargetImportFindings,
} from "../../core/import-graph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/;

const walkCapabilityFiles = (absolutePath: string, acc: string[] = []): string[] => {
  if (!existsSync(absolutePath)) return acc;
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const nextPath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkCapabilityFiles(nextPath, acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
      acc.push(nextPath);
    }
  }
  return acc;
};

const governanceFinding = (file: string, line: number, message: string, hint: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-CAPABILITY-GROUP-003-V1",
    file,
    line,
    severity: "fatal",
    message,
    hint,
  });

const loadCapabilitySourceFiles = (): SourceFile[] => {
  const project = getAuditProject();
  return walkCapabilityFiles(pathFromRepoRoot("src/capabilities"))
    .map((absolutePath) => project.addSourceFileAtPathIfExists(absolutePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
};

export const runCapabilityGroupGovernanceInspector = async (
  _context: InspectorContext,
): Promise<InspectorResult> => {
  const sourceFiles = loadCapabilitySourceFiles();
  const findings = [
    ...collectCapabilityGroupPrivateImportFindings(sourceFiles)
      .map((finding) => governanceFinding(
        finding.file,
        finding.line,
        finding.message,
        "Import the other capability group through its public contract only.",
      )),
    ...collectForbiddenTargetImportFindings(sourceFiles)
      .map((finding) => governanceFinding(
        finding.file,
        finding.line,
        finding.message,
        "verify/smoke files are not capability-group public contracts.",
      )),
  ];
  const passed = findings.length === 0;
  return finalizeInspectorResult({
    inspector: "capability-group-governance",
    inspectorId: "capability-group-governance-owner",
    capabilityDomain: "capability-group-governance",
    findings,
    phases: [
      createPhase("cross-group-private-imports", passed ? "PASS" : "CODE VIOLATION", passed, "cross-group private path imports checked."),
      createPhase("verify-smoke-boundary", passed ? "PASS" : "CODE VIOLATION", passed, "verify/smoke boundary checked."),
    ],
    summary: passed
      ? "capability-group governance boundary is clean."
      : "capability-group governance boundary has blocking findings.",
  });
};