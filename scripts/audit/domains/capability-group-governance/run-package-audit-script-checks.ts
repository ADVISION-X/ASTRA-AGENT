import { loadDomainManifests } from "../../core/manifests.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

const {
  ACTIVE_ABILITY_GROUPS,
  LAW_ID_001,
} = capabilityGroupGovernanceConstants;

const abilityGroupToDomain = (abilityGroupId: string): string => `${abilityGroupId}-capability`;

const collectAbilityManifestFindings = async (): Promise<Finding[]> => {
  const manifests = await loadDomainManifests();
  const manifestByDomain = new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest]));
  const findings: Finding[] = [];

  for (const abilityGroupId of ACTIVE_ABILITY_GROUPS) {
    const capabilityDomain = abilityGroupToDomain(abilityGroupId);
    const manifest = manifestByDomain.get(capabilityDomain);
    if (!manifest) {
      findings.push(createFinding({
        lawId: LAW_ID_001,
        file: `scripts/audit/domains/${capabilityDomain}/manifest.json`,
        line: 1,
        severity: "fatal",
        message: "Active ability group is missing its owner manifest.",
      }));
      continue;
    }

    const expectedEntry = `scripts/audit/domains/${capabilityDomain}/inspector.ts`;
    if (manifest.entry !== expectedEntry) {
      findings.push(createFinding({
        lawId: LAW_ID_001,
        file: manifest.manifestPath,
        line: 1,
        severity: "fatal",
        message: "Active ability group manifest must point to its own inspector.",
        detail: `${manifest.entry} !== ${expectedEntry}`,
      }));
    }
  }

  return findings;
};

const createPackageAuditScriptPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "ability-owner-manifests",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Active ability groups are bound to owner manifests and ci-full-internal inspectors."
      : "Active ability group owner manifest binding is incomplete.",
  );

export async function runPackageAuditScriptChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings = await collectAbilityManifestFindings();
  return {
    findings,
    phases: [createPackageAuditScriptPhase(findings)],
  };
}
