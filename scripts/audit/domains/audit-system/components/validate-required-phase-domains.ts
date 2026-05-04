import { createFinding, createPhase } from "../../../core/result.js";
import { loadFrozenBaselineDomains } from "../../../core/frozen-baseline.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { defaultPhaseGatePath } from "../../../core/path-roots.js";
import { toRepoRelativePath } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const collectRequiredDomainFindings = (
  context: InspectorContext,
  capabilityDomain: string,
): Finding[] => {
  const findings: Finding[] = [];

  if (!context.phaseGate.activeLawDomains.includes(capabilityDomain)) {
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

  return findings;
};

const collectDeletedOwnerFindings = (
  context: InspectorContext,
  deletedOwnerDomain: string,
): Finding[] => {
  const findings: Finding[] = [];

  if (context.phaseGate.activeLawDomains.includes(deletedOwnerDomain)) {
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

  return findings;
};

const createRequiredPhaseDomainsPhase = (findings: Finding[], baselineFile: string): InspectorPhase =>
  createPhase(
    "required-phase-domains",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? `Current phase gate and generated plan include every frozen owner and every active law domain from ${baselineFile}.`
      : "The current phase gate or generated audit plan drifted away from the frozen owner baseline or active law registry.",
  );

export const validateRequiredPhaseDomains = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const frozenBaseline = await loadFrozenBaselineDomains();
  const lawDomains = [...new Set(context.lawRegistry.laws.map((law) => law.capabilityDomain))].sort();
  const requiredPhaseDomains = [...new Set([...frozenBaseline.activeLawDomains, ...lawDomains])].sort();

  for (const capabilityDomain of requiredPhaseDomains) {
    findings.push(...collectRequiredDomainFindings(context, capabilityDomain));
  }

  for (const deletedOwnerDomain of frozenBaseline.deletedOwnerDomains) {
    findings.push(...collectDeletedOwnerFindings(context, deletedOwnerDomain));
  }

  return { findings, phases: [createRequiredPhaseDomainsPhase(findings, frozenBaseline.baselineFile)] };
};
