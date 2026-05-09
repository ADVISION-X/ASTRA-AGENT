import { defaultPhaseGatePath } from "./path-roots.js";
import { toRepoRelativePath } from "./paths.js";
import type { AuditConflict, LawRecord, PhaseGate } from "./schema-generated-artifacts.js";

export type PhaseGateConflictContext = {
  lawsByDomain: ReadonlyMap<string, LawRecord[]>;
  manifestsByDomain: ReadonlyMap<string, unknown>;
  phaseGate: PhaseGate;
  requiredPhaseDomains: string[];
  localDevelopmentGovernanceDomains: string[];
  deletedOwnerDomains: string[];
};

const createPhaseGateConflict = (capabilityDomain: string, message: string): AuditConflict => ({
  kind: "PHASE_GATE",
  message,
  capabilityDomain,
  file: toRepoRelativePath(defaultPhaseGatePath),
});

const appendActiveDomainPlanConflicts = (
  capabilityDomain: string,
  context: PhaseGateConflictContext,
  conflicts: AuditConflict[],
): void => {
  if (!context.manifestsByDomain.has(capabilityDomain)) {
    conflicts.push({ kind: "PLAN", message: "Phase gate references a law domain without a manifest.", capabilityDomain });
  }

  if (!context.lawsByDomain.has(capabilityDomain)) {
    conflicts.push({ kind: "PLAN", message: "Phase gate references a law domain without an active law.", capabilityDomain });
  }
};

const appendActiveDomainBoundaryConflicts = (
  capabilityDomain: string,
  context: PhaseGateConflictContext,
  localDevelopmentGovernanceDomains: string[],
  conflicts: AuditConflict[],
): void => {
  if (!context.requiredPhaseDomains.includes(capabilityDomain)) {
    conflicts.push(createPhaseGateConflict(capabilityDomain, "Phase gate activeLawDomains must stay inside frozen baseline activeLawDomains."));
  }

  if (localDevelopmentGovernanceDomains.includes(capabilityDomain)) {
    conflicts.push(createPhaseGateConflict(capabilityDomain, "A phase-gate domain must not appear in both activeLawDomains and localDevelopmentGovernanceDomains."));
  }
};

const appendActiveDomainConflicts = (
  context: PhaseGateConflictContext,
  localDevelopmentGovernanceDomains: string[],
  conflicts: AuditConflict[],
): void => {
  for (const capabilityDomain of context.phaseGate.activeLawDomains) {
    appendActiveDomainPlanConflicts(capabilityDomain, context, conflicts);
    appendActiveDomainBoundaryConflicts(capabilityDomain, context, localDevelopmentGovernanceDomains, conflicts);
  }
};

const appendGovernanceDomainConflicts = (
  context: PhaseGateConflictContext,
  localDevelopmentGovernanceDomains: string[],
  conflicts: AuditConflict[],
): void => {
  for (const capabilityDomain of localDevelopmentGovernanceDomains) {
    if (!context.localDevelopmentGovernanceDomains.includes(capabilityDomain)) {
      conflicts.push(createPhaseGateConflict(capabilityDomain, "Phase gate localDevelopmentGovernanceDomains drifted away from the frozen baseline allowlist."));
    }

    if (!context.manifestsByDomain.has(capabilityDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate local development governance domain has no manifest.", capabilityDomain });
    }

    if (!context.lawsByDomain.has(capabilityDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate local development governance domain has no active law.", capabilityDomain });
    }
  }
};

const appendRequiredDomainConflicts = (context: PhaseGateConflictContext, conflicts: AuditConflict[]): void => {
  for (const capabilityDomain of context.requiredPhaseDomains) {
    if (!context.phaseGate.activeLawDomains.includes(capabilityDomain)) {
      conflicts.push(createPhaseGateConflict(capabilityDomain, "Current frozen phase gate is missing a required law domain."));
    }
  }
};

const appendAllowlistConflicts = (
  context: PhaseGateConflictContext,
  localDevelopmentGovernanceDomains: string[],
  conflicts: AuditConflict[],
): void => {
  for (const capabilityDomain of context.localDevelopmentGovernanceDomains) {
    if (!localDevelopmentGovernanceDomains.includes(capabilityDomain)) {
      conflicts.push(createPhaseGateConflict(capabilityDomain, "Current phase gate must keep frozen local development governance allowlist domains explicit."));
    }
  }
};

const appendDeletedOwnerConflicts = (
  context: PhaseGateConflictContext,
  localDevelopmentGovernanceDomains: string[],
  conflicts: AuditConflict[],
): void => {
  for (const capabilityDomain of context.deletedOwnerDomains) {
    if (context.phaseGate.activeLawDomains.includes(capabilityDomain)) {
      conflicts.push(createPhaseGateConflict(capabilityDomain, "Current frozen phase gate must not reactivate a deleted owner domain."));
    }

    if (localDevelopmentGovernanceDomains.includes(capabilityDomain)) {
      conflicts.push(createPhaseGateConflict(capabilityDomain, "Current phase gate must not reactivate a deleted owner domain through local development governance allowlist."));
    }
  }
};

export const collectPhaseGateConflicts = (context: PhaseGateConflictContext): AuditConflict[] => {
  const conflicts: AuditConflict[] = [];
  const localDevelopmentGovernanceDomains = context.phaseGate.localDevelopmentGovernanceDomains ?? [];

  appendActiveDomainConflicts(context, localDevelopmentGovernanceDomains, conflicts);
  appendGovernanceDomainConflicts(context, localDevelopmentGovernanceDomains, conflicts);
  appendRequiredDomainConflicts(context, conflicts);
  appendAllowlistConflicts(context, localDevelopmentGovernanceDomains, conflicts);
  appendDeletedOwnerConflicts(context, localDevelopmentGovernanceDomains, conflicts);

  return conflicts;
};