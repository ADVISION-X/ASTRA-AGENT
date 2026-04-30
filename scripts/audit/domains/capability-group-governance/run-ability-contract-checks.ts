import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createFinding, createPhase } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { getAuditProject, getNodeLine } from "../../core/ts-morph.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";
import { capabilityGroupGovernanceUtils } from "./inspection-utils.js";

const { ACTIVE_ABILITY_GROUPS, LAW_ID_001, LAW_ID_002 } = capabilityGroupGovernanceConstants;
const { resolveExportedAbilityGroupConstant } = capabilityGroupGovernanceUtils;

const findMissingContractFiles = async (contractPath: string, indexPath: string): Promise<Finding[]> => {
  const findings: Finding[] = [];
  if (!(await fileExists(pathFromRepoRoot(contractPath)))) {
    findings.push(createFinding({ lawId: LAW_ID_001, file: contractPath, line: 1, severity: "fatal", message: "Active ability group is missing its public contract file." }));
    return findings;
  }
  if (!(await fileExists(pathFromRepoRoot(indexPath)))) {
    findings.push(createFinding({ lawId: LAW_ID_002, file: indexPath, line: 1, severity: "error", message: "Active ability group is missing its public index entry." }));
  }
  return findings;
};

const findStableContractViolations = (abilityGroupId: string, contractPath: string): Finding[] => {
  const contractSourceFile = getAuditProject().getSourceFile(pathFromRepoRoot(contractPath));
  if (!contractSourceFile) {
    return [];
  }

  const abilityGroupConstant = resolveExportedAbilityGroupConstant(contractSourceFile, abilityGroupId);
  if (!abilityGroupConstant) {
    return [createFinding({ lawId: LAW_ID_002, file: contractPath, line: 1, severity: "error", message: "Public contract is missing a stable exported abilityGroupId constant." })];
  }

  const abilityGroupNameNode = abilityGroupConstant.getNameNode();
  const externalReferences = abilityGroupNameNode.findReferencesAsNodes().map((referenceNode) => referenceNode.getSourceFile().getFilePath()).filter((referencePath) => !referencePath.endsWith(contractPath));
  return externalReferences.length === 0
    ? [createFinding({ lawId: LAW_ID_002, file: contractPath, line: getNodeLine(abilityGroupConstant), severity: "error", message: "Ability-group public contract is not referenced outside its contract file." })]
    : [];
};

export async function runAbilityContractChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings: Finding[] = [];

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const capabilityRoot = `src/capabilities/${abilityGroupId}`;
    const contractPath = `${capabilityRoot}/contract.ts`;
    const indexPath = `${capabilityRoot}/index.ts`;
    const fileFindings = await findMissingContractFiles(contractPath, indexPath);
    findings.push(...fileFindings);
    if (fileFindings.some((finding) => finding.file === contractPath)) {
      continue;
    }
    findings.push(...findStableContractViolations(abilityGroupId, contractPath));
  }

  return {
    findings,
    phases: [
      createPhase(
        "ability-group-contracts",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Active ability groups expose stable public contract roots and referenced abilityGroupId constants."
          : "Some active ability groups are missing public contract or index truth.",
      ),
    ],
  };
}