import { readJsonFile, pathFromRepoRoot, type DomainManifest } from "./inspection-core.js";

import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

const MANIFEST_LAW_ID = config.ACTIVE_LAW_IDS[7];

const isCanonicalManifest = (manifest: DomainManifest): boolean => manifest.owner
  && manifest.inspectorId === config.INSPECTOR_ID
  && manifest.entry === config.INSPECTOR_ENTRY
  && manifest.capabilityDomain === config.CAPABILITY_DOMAIN;

const collectManifestLawFindings = (manifest: DomainManifest): AttackOutcome["findings"] => {
  const findings = [] as AttackOutcome["findings"];
  for (const lawId of config.ACTIVE_LAW_IDS) {
    if (!manifest.allowedLawIds.includes(lawId)) {
      findings.push(createViolation({ lawId, file: config.MANIFEST_PATH, message: `Visual Target manifest must include ${lawId} in allowedLawIds.` }));
    }
  }
  for (const lawId of manifest.allowedLawIds) {
    if (!config.ACTIVE_LAW_IDS.includes(lawId as (typeof config.ACTIVE_LAW_IDS)[number])) {
      findings.push(createViolation({ lawId: MANIFEST_LAW_ID, file: config.MANIFEST_PATH, message: `Visual Target manifest must not retain retired law id ${lawId}.` }));
    }
  }
  return findings;
};

export async function runManifestCheck(): Promise<AttackOutcome> {
  const manifest = await readJsonFile<DomainManifest>(pathFromRepoRoot(config.MANIFEST_PATH));
  const findings = collectManifestLawFindings(manifest);
  if (!isCanonicalManifest(manifest)) {
    findings.unshift(createViolation({ lawId: MANIFEST_LAW_ID, file: config.MANIFEST_PATH, message: "Visual Target manifest must declare the canonical owner inspector, domain, and entry." }));
  }
  return { findings, phase: createAttackPhase("manifest-check", findings, "Visual Target manifest points at the canonical owner inspector and preserves the expected law binding set.", "Visual Target manifest drifted from the canonical owner entry or allowed law binding set.") };
}