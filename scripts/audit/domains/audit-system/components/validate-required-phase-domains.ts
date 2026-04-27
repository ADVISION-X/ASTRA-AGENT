import { createFinding, createPhase } from "../../../core/result.js";
import { defaultPhaseGatePath, generatedArtifactPaths, toRepoRelativePath } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const REQUIRED_PHASE_DOMAINS = ["code-purity", "agent-browse-flow", "evidence-packet", "multi-frame-evidence", "visual-only-runtime"];

export const validateRequiredPhaseDomains = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];

  for (const capabilityDomain of REQUIRED_PHASE_DOMAINS) {
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

  const phases: InspectorPhase[] = [
    createPhase(
      "required-phase-domains",
      findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
      findings.length === 0,
      findings.length === 0
        ? `Current phase gate and generated plan both include ${REQUIRED_PHASE_DOMAINS.join(", ")}.`
        : "A required capability domain was removed from the current phase gate or generated audit plan.",
    ),
  ];

  return { findings, phases };
};