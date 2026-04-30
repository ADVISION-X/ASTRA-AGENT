import { createFinding, createPhase } from "../../../core/result.js";
import { loadFrozenBaselineDomains } from "../../../core/frozen-baseline.js";
import { defaultPhaseGatePath, generatedArtifactPaths, toRepoRelativePath } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

export const validateRequiredPhaseDomains = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const frozenBaseline = await loadFrozenBaselineDomains();
  const lawDomains = [...new Set(context.lawRegistry.laws.map((law) => law.capabilityDomain))].sort();
  const requiredPhaseDomains = [...new Set([...frozenBaseline.activeCapabilityDomains, ...lawDomains])].sort();

  for (const capabilityDomain of requiredPhaseDomains) {
    if (!context.phaseGate.activeCapabilityDomains.includes(capabilityDomain)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: toRepoRelativePath(defaultPhaseGatePath),
          line: 1,
          severity: "fatal",
          message: `Current phase gate must keep ${capabilityDomain} active.`,
        }),
      );
    }

    if (!context.auditPlan.owners.some((owner) => owner.capabilityDomain === capabilityDomain)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: toRepoRelativePath(generatedArtifactPaths.auditPlan),
          line: 1,
          severity: "fatal",
          message: `Generated audit plan must include ${capabilityDomain} when the current phase requires it.`,
        }),
      );
    }
  }

  for (const deletedOwnerDomain of frozenBaseline.deletedOwnerDomains) {
    if (context.phaseGate.activeCapabilityDomains.includes(deletedOwnerDomain)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: toRepoRelativePath(defaultPhaseGatePath),
          line: 1,
          severity: "fatal",
          message: `Current phase gate must not reactivate deleted owner ${deletedOwnerDomain}.`,
        }),
      );
    }

    if (context.auditPlan.owners.some((owner) => owner.capabilityDomain === deletedOwnerDomain)) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: toRepoRelativePath(generatedArtifactPaths.auditPlan),
          line: 1,
          severity: "fatal",
          message: `Generated audit plan must not reactivate deleted owner ${deletedOwnerDomain}.`,
        }),
      );
    }
  }

  const phases: InspectorPhase[] = [
    createPhase(
      "required-phase-domains",
      findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
      findings.length === 0,
      findings.length === 0
        ? `Current phase gate and generated plan include every frozen owner and every active law domain from ${frozenBaseline.baselineFile}.`
        : "The current phase gate or generated audit plan drifted away from the frozen owner baseline or active law registry.",
    ),
  ];

  return { findings, phases };
};
