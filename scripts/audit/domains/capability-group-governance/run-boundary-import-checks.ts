import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";
import { capabilityGroupGovernanceUtils } from "./inspection-utils.js";

const { LAW_ID_003 } = capabilityGroupGovernanceConstants;
const { collectDeclaredPublicEntries, getCapabilityRoot, isCapabilitySourcePath, isCrossBoundaryImport, isPublicCapabilityEntry, resolveImportTargetPath } = capabilityGroupGovernanceUtils;

const isAllowedBoundaryImport = (declaredPublicEntries: Map<string, Set<string>>, targetPath: string): boolean => {
  const targetRoot = getCapabilityRoot(targetPath);
  return Boolean((targetRoot && declaredPublicEntries.get(targetRoot)?.has(targetPath)) || isPublicCapabilityEntry(targetPath));
};

const collectBoundaryImportFindingsForSource = (
  relativePath: string,
  declaredPublicEntries: Map<string, Set<string>>,
  sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number],
): Finding[] => {
  const findings: Finding[] = [];

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const targetPath = resolveImportTargetPath(importDeclaration);
    if (!targetPath || !isCapabilitySourcePath(targetPath) || !isCrossBoundaryImport(relativePath, targetPath) || isAllowedBoundaryImport(declaredPublicEntries, targetPath)) {
      continue;
    }

    findings.push(createFinding({ lawId: LAW_ID_003, file: relativePath, line: getNodeLine(importDeclaration), severity: "fatal", message: "Cross-group or support-layer import bypasses the owning capability public index or contract.", detail: `${relativePath} -> ${targetPath}` }));
  }

  return findings;
};

export function runBoundaryImportChecks(project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } {
  const findings: Finding[] = [];
  const declaredPublicEntries = collectDeclaredPublicEntries(project);

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!relativePath.startsWith("src/")) {
      continue;
    }
    findings.push(...collectBoundaryImportFindingsForSource(relativePath, declaredPublicEntries, sourceFile));
  }

  return {
    findings,
    phases: [
      createPhase(
        "boundary-imports",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Cross-group imports stay on public capability indexes or contracts."
          : "Cross-group imports still reach private capability paths.",
      ),
    ],
  };
}