import { createFinding, createPhase } from "../../../core/result.js";
import { loadFrozenBaselineDomains } from "../../../core/frozen-baseline.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { defaultPhaseGatePath } from "../../../core/path-roots.js";
import { toRepoRelativePath } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const ACTIVE_OWNER_KINDS = new Set(["ability-group", "foundation-law", "support-governance"]);

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

  if ((context.phaseGate.localDevelopmentGovernanceDomains ?? []).includes(deletedOwnerDomain)) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: toRepoRelativePath(defaultPhaseGatePath),
        line: 1,
        severity: "fatal",
        message: `Current phase gate must not reactivate deleted owner ${deletedOwnerDomain} through local development governance allowlist.`,
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
      ? `Current phase gate, local development governance allowlist, enforcement matrix owner kinds, and generated plan align with ${baselineFile}.`
      : "The current phase gate, local development governance allowlist, enforcement matrix owner kinds, or generated audit plan drifted away from the frozen owner baseline.",
  );

const collectUnexpectedActiveDomainFindings = (
  context: InspectorContext,
  requiredPhaseDomains: readonly string[],
): Finding[] => {
  return context.phaseGate.activeLawDomains
    .filter((capabilityDomain) => !requiredPhaseDomains.includes(capabilityDomain))
    .map((capabilityDomain) => createFinding({
      lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
      file: toRepoRelativePath(defaultPhaseGatePath),
      line: 1,
      severity: "fatal",
      message: `Current phase gate activeLawDomains must not include baseline-external domain ${capabilityDomain}.`,
    }));
};

const collectMissingGovernanceAllowlistFindings = (
  phaseGateGovernanceDomains: readonly string[],
  frozenBaseline: Awaited<ReturnType<typeof loadFrozenBaselineDomains>>,
): Finding[] => {
  return frozenBaseline.localDevelopmentGovernanceDomains.flatMap((capabilityDomain) =>
    phaseGateGovernanceDomains.includes(capabilityDomain)
      ? []
      : [createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: toRepoRelativePath(defaultPhaseGatePath),
        line: 1,
        severity: "fatal",
        message: `Current phase gate must keep local development governance domain ${capabilityDomain} explicit in localDevelopmentGovernanceDomains.`,
      })],
  );
};

const collectUnexpectedGovernanceAllowlistFindings = (
  context: InspectorContext,
  phaseGateGovernanceDomains: readonly string[],
  frozenBaseline: Awaited<ReturnType<typeof loadFrozenBaselineDomains>>,
): Finding[] => {
  const findings: Finding[] = [];

  for (const capabilityDomain of phaseGateGovernanceDomains) {
    if (!frozenBaseline.localDevelopmentGovernanceDomains.includes(capabilityDomain)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: toRepoRelativePath(defaultPhaseGatePath),
        line: 1,
        severity: "fatal",
        message: `Current phase gate localDevelopmentGovernanceDomains must not include baseline-external domain ${capabilityDomain}.`,
      }));
    }

    if (context.auditPlan.owners.some((owner) => owner.capabilityDomain === capabilityDomain)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: toRepoRelativePath(generatedArtifactPaths.auditPlan),
        line: 1,
        severity: "fatal",
        message: `Generated audit plan must not include local development governance domain ${capabilityDomain}.`,
      }));
    }
  }

  return findings;
};

const collectGovernanceMatrixOwnerKindFindings = (context: InspectorContext): Finding[] => {
  const findings: Finding[] = [];

  for (const [capabilityDomain, owner] of context.matrixOwnersByDomain.entries()) {
    const inAuditPlan = context.auditPlan.owners.some((planOwner) => planOwner.capabilityDomain === capabilityDomain);
    if (!inAuditPlan && !owner.ownerKind) {
      findings.push(createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: owner.manifestPath,
        line: 1,
        severity: "fatal",
        message: `Enforcement matrix owner ${capabilityDomain} must declare ownerKind when it stays outside the generated audit plan.`,
      }));
    }

    if (!inAuditPlan && ACTIVE_OWNER_KINDS.has(owner.ownerKind)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: owner.manifestPath,
        line: 1,
        severity: "fatal",
        message: `Enforcement matrix owner ${capabilityDomain} must not be marked as an active owner kind while it stays outside the generated audit plan.`,
      }));
    }
  }

  return findings;
};

const collectLocalDevelopmentGovernanceFindings = (
  context: InspectorContext,
  frozenBaseline: Awaited<ReturnType<typeof loadFrozenBaselineDomains>>,
): Finding[] => {
  const phaseGateGovernanceDomains = context.phaseGate.localDevelopmentGovernanceDomains ?? [];

  return [
    ...collectMissingGovernanceAllowlistFindings(phaseGateGovernanceDomains, frozenBaseline),
    ...collectUnexpectedGovernanceAllowlistFindings(context, phaseGateGovernanceDomains, frozenBaseline),
    ...collectGovernanceMatrixOwnerKindFindings(context),
  ];
};

export const validateRequiredPhaseDomains = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const frozenBaseline = await loadFrozenBaselineDomains();
  const requiredPhaseDomains = [...new Set(frozenBaseline.activeLawDomains)].sort();

  for (const capabilityDomain of requiredPhaseDomains) {
    findings.push(...collectRequiredDomainFindings(context, capabilityDomain));
  }

  findings.push(...collectUnexpectedActiveDomainFindings(context, requiredPhaseDomains));
  findings.push(...collectLocalDevelopmentGovernanceFindings(context, frozenBaseline));

  for (const deletedOwnerDomain of frozenBaseline.deletedOwnerDomains) {
    findings.push(...collectDeletedOwnerFindings(context, deletedOwnerDomain));
  }

  return { findings, phases: [createRequiredPhaseDomainsPhase(findings, frozenBaseline.baselineFile)] };
};
