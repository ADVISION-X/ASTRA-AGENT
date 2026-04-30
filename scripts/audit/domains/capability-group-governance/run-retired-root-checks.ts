import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";
import { capabilityGroupGovernanceUtils } from "./inspection-utils.js";

const { GOVERNED_SURFACES, LAW_ID_006, RETIRED_ROOTS } = capabilityGroupGovernanceConstants;
const { isRetiredSpecifier } = capabilityGroupGovernanceUtils;

const findRetiredRootExistenceViolations = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const retiredRoot of RETIRED_ROOTS) {
    if (!(await fileExists(pathFromRepoRoot(retiredRoot)))) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_006, file: retiredRoot, line: 1, severity: "fatal", message: "Retired support root still exists and violates ability-group boundary governance." }));
  }
  return findings;
};

const findRetiredRootImportViolations = (project: ReturnType<typeof getAuditProject>): string[] => {
  const importViolations: string[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    if (!GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    if (sourceFile.getImportDeclarations().some((declaration) => isRetiredSpecifier(declaration.getModuleSpecifierValue()))) {
      importViolations.push(relativePath);
      continue;
    }
    if (sourceFile.getExportDeclarations().some((declaration) => isRetiredSpecifier(declaration.getModuleSpecifierValue() ?? ""))) {
      importViolations.push(relativePath);
    }
  }

  return importViolations;
};

export async function runRetiredRootChecks(project: ReturnType<typeof getAuditProject>): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings = await findRetiredRootExistenceViolations();
  const importViolations = findRetiredRootImportViolations(project);

  if (importViolations.length > 0) {
    findings.push(createFinding({ lawId: LAW_ID_006, file: importViolations[0]!, line: 1, severity: "fatal", message: "Ability-group or runtime surfaces still import retired support roots." }));
  }

  return {
    findings,
    phases: [
      createPhase(
        "required-shape",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Ability groups stay isolated from retired support roots."
          : "Ability groups still depend on retired support roots.",
      ),
      createPhase(
        "anti-escape",
        importViolations.length === 0 ? "PASS" : "CODE VIOLATION",
        importViolations.length === 0,
        importViolations.length === 0
          ? "No import or export path lets retired roots bypass ability-group governance."
          : "Import or export paths still let retired roots bypass ability-group governance.",
      ),
    ],
  };
}