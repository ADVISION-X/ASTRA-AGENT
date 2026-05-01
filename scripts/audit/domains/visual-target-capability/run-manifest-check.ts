import { readJsonFile, pathFromRepoRoot, type DomainManifest } from "./inspection-core.js";

import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

export async function runManifestCheck(): Promise<AttackOutcome> {
  const findings = [];
  const manifest = await readJsonFile<DomainManifest>(pathFromRepoRoot(config.MANIFEST_PATH));

  if (!manifest.owner || manifest.inspectorId !== config.INSPECTOR_ID || manifest.entry !== config.INSPECTOR_ENTRY || manifest.capabilityDomain !== config.CAPABILITY_DOMAIN) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.MANIFEST_PATH, message: "Visual Target manifest must declare the canonical owner inspector, domain, and entry." }));
  }
  for (const lawId of ["GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1"] as const) {
    if (!manifest.allowedLawIds.includes(lawId)) {
      findings.push(createViolation({ lawId, file: config.MANIFEST_PATH, message: `Visual Target manifest must include ${lawId} in allowedLawIds.` }));
    }
  }

  return { findings, phase: createAttackPhase("manifest-check", findings, "Visual Target manifest points at the canonical owner inspector and preserves the expected law binding set.", "Visual Target manifest drifted from the canonical owner entry or allowed law binding set.") };
}