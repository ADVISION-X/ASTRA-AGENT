import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { collectAntiEscapeFindings } from "./rules-anti-escape.js";
import { collectBoundaryFindings } from "./rules-boundary.js";
import { collectGeneratedEditFindings } from "./rules-generated.js";
import { collectStructureFindings } from "./rules-structure.js";
import { collectActiveCodeFiles, filterActiveSourceFiles } from "./scope.js";
import type { CodePurityInspectorResult, PurityFinding } from "./types.js";

const dedupeFindings = (findings: PurityFinding[]): PurityFinding[] => {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.rule}:${finding.file}:${finding.line}:${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function runCodePurityInspector(): CodePurityInspectorResult {
  const project = getAuditProject();
  project.addSourceFilesFromTsConfig(pathFromRepoRoot("tsconfig.json"));
  for (const file of collectActiveCodeFiles()) {
    project.addSourceFileAtPathIfExists(file.absolutePath);
  }

  const sourceFiles = filterActiveSourceFiles(project.getSourceFiles());
  const codeFiles = collectActiveCodeFiles();
  const findings = dedupeFindings([
    ...collectStructureFindings(sourceFiles, codeFiles),
    ...collectAntiEscapeFindings(sourceFiles),
    ...collectBoundaryFindings(sourceFiles),
    ...collectGeneratedEditFindings(),
  ]);

  const hardFails = findings.length;
  const fileCountFails = findings.filter((f) => f.rule === "CP-FILE-001").length;

  return { findings, hardFails, fileCountFails, pass: hardFails === 0 };
}
