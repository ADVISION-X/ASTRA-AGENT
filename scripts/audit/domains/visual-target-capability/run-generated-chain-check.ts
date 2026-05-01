import type { InspectorContext } from "./inspection-core.js";

import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, type AttackOutcome } from "./inspection-helpers.js";

export async function runGeneratedChainCheck(context: InspectorContext): Promise<AttackOutcome> {
  const findings = [];
  const matrixOwner = context.matrixOwnersByDomain.get(config.CAPABILITY_DOMAIN);
  const planOwner = context.planOwnersByDomain.get(config.CAPABILITY_DOMAIN);
  const manifestOwner = context.manifestsByDomain.get(config.CAPABILITY_DOMAIN);

  if (!matrixOwner || matrixOwner.inspectorId !== config.INSPECTOR_ID || matrixOwner.entry !== config.INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.MANIFEST_PATH, message: "Generated enforcement matrix must resolve visual-target-capability to this inspector entry." }));
  }
  if (!planOwner || planOwner.inspectorId !== config.INSPECTOR_ID) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.MANIFEST_PATH, message: "Generated audit plan must retain visual-target-capability ownership for this inspector." }));
  }
  if (!manifestOwner || manifestOwner.entry !== config.INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: config.MANIFEST_PATH, message: "Resolved manifest ownership drifted away from this inspector entry." }));
  }

  return { findings, phase: createAttackPhase("generated-chain-check", findings, "Visual Target stays connected to the generated audit chain through manifest, enforcement matrix, and audit plan ownership.", "Visual Target manifest or generated audit ownership chain drifted away from this inspector.") };
}