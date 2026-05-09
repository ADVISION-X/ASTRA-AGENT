import path from "node:path";

import { readJsonFile } from "./json-utils.mjs";
import { getRepoRoot } from "./path-policy.mjs";

const OWNER_DOMAIN_MAP = {
  "commander-console": "commander-console-capability",
  orchestration: "orchestration-capability",
  "nerve-bus": "nerve-bus-capability",
  open: "open-capability",
  "page-state": "page-state-capability",
  screenshot: "screenshot-capability",
  ai: "ai-capability",
  "visual-target": "visual-target-capability",
  "geometry-guard": "geometry-guard-capability",
  "mouse-click": "mouse-click-capability",
  "mouse-scroll": "mouse-scroll-capability",
  "text-input": "text-input-capability",
  "post-action-verification": "post-action-verification-capability",
  "forensics-persistence": "forensics-persistence-capability",
  "map-plugin-package": "map-plugin-package",
  "audit-system": "audit-system",
};

async function readGeneratedArtifact(fileName) {
  return readJsonFile(path.join(getRepoRoot(), "scripts", "audit", "generated", fileName));
}

function resolveOwnerDomain(owner) {
  return OWNER_DOMAIN_MAP[owner] ?? owner ?? null;
}

function resolveOwnerEntry(collection, ownerDomain) {
  if (ownerDomain === null) {
    return null;
  }

  return (collection ?? []).find((entry) => entry.capabilityDomain === ownerDomain || entry.inspectorId === ownerDomain) ?? null;
}

function resolveActiveLaws(lawRegistry, ownerDomain) {
  const laws = Array.isArray(lawRegistry?.laws) ? lawRegistry.laws : [];
  if (ownerDomain === null) {
    return laws.filter((law) => law.status === "active");
  }

  return laws.filter((law) => law.status === "active" && law.capabilityDomain === ownerDomain);
}

function resolveMissingLawIds(activeLaws, ownerEntry) {
  const ownedLawIds = new Set(ownerEntry?.lawIds ?? []);
  return activeLaws
    .filter((law) => !ownedLawIds.has(law.lawId))
    .map((law) => law.lawId);
}

function resolveMissingP0P1Coverage(activeLaws, matrixOwnerEntry) {
  const matrixLawIds = new Set(matrixOwnerEntry?.lawIds ?? []);
  return activeLaws
    .filter((law) => ["P0", "P1"].includes(law.tier ?? "") && !matrixLawIds.has(law.lawId))
    .map((law) => law.lawId);
}

function hasWarningOnlyP0(activeLaws) {
  return activeLaws.some((law) => law.tier === "P0" && law.enforcementMode !== "machine-blocking");
}

function resolveCiFullFailures(ciFullSummary) {
  return (ciFullSummary.layers ?? [])
    .flatMap((layer) => layer.steps ?? [])
    .filter((step) => step.status !== "PASS")
    .map((step) => `${step.name ?? "unknown-step"}:${step.status ?? "unknown"}`);
}

function buildOwnerCoverage(ownerDomain, matrixOwnerEntry, auditPlanOwnerEntry) {
  return {
    hasMatrixEntry: ownerDomain === null ? true : matrixOwnerEntry !== null,
    ownerInAuditPlan: ownerDomain === null ? true : auditPlanOwnerEntry !== null,
  };
}

function resolveLawEnforcementPassed(input) {
  if (input.ownerDomain === null) {
    return true;
  }

  return [
    input.activeLaws.length > 0,
    input.hasMatrixEntry,
    input.ownerInAuditPlan,
    input.missingMatrixLawIds.length === 0,
    input.missingAuditPlanLawIds.length === 0,
    input.missingP0P1LawCoverage.length === 0,
    !input.warningOnlyP0,
    !input.detachedInspector,
  ].every(Boolean);
}

function buildLawEnforcementChecks(input) {
  const missingMatrixLawIds = resolveMissingLawIds(input.activeLaws, input.matrixOwnerEntry);
  const missingAuditPlanLawIds = resolveMissingLawIds(input.activeLaws, input.auditPlanOwnerEntry);
  const missingP0P1LawCoverage = resolveMissingP0P1Coverage(input.activeLaws, input.matrixOwnerEntry);
  const ownerCoverage = buildOwnerCoverage(input.ownerDomain, input.matrixOwnerEntry, input.auditPlanOwnerEntry);
  const warningOnlyP0 = hasWarningOnlyP0(input.activeLaws);
  const detachedInspector = ownerCoverage.hasMatrixEntry && !ownerCoverage.ownerInAuditPlan;

  return {
    ...ownerCoverage,
    missingMatrixLawIds,
    missingAuditPlanLawIds,
    missingP0P1LawCoverage,
    warningOnlyP0,
    detachedInspector,
    lawEnforcementPassed: resolveLawEnforcementPassed({
      ownerDomain: input.ownerDomain,
      activeLaws: input.activeLaws,
      ...ownerCoverage,
      missingMatrixLawIds,
      missingAuditPlanLawIds,
      missingP0P1LawCoverage,
      warningOnlyP0,
      detachedInspector,
    }),
  };
}

export async function readLawEnforcementState(input = {}) {
  const [lawRegistry, enforcementMatrix, auditPlan, ciFullSummary] = await Promise.all([
    readGeneratedArtifact("law-registry.generated.json"),
    readGeneratedArtifact("enforcement-matrix.generated.json"),
    readGeneratedArtifact("audit-plan.generated.json"),
    readGeneratedArtifact("ci-full-summary.generated.json"),
  ]);

  const ownerDomain = resolveOwnerDomain(input.owner);
  const activeLaws = resolveActiveLaws(lawRegistry, ownerDomain);
  const matrixOwnerEntry = resolveOwnerEntry(enforcementMatrix.owners, ownerDomain);
  const auditPlanOwnerEntry = resolveOwnerEntry(auditPlan.owners, ownerDomain);
  const enforcementChecks = buildLawEnforcementChecks({ ownerDomain, activeLaws, matrixOwnerEntry, auditPlanOwnerEntry });

  return {
    lawRegistry,
    enforcementMatrix,
    auditPlan,
    ciFullSummary,
    ownerDomain,
    activeLawIds: activeLaws.map((law) => law.lawId),
    hasActiveLaw: activeLaws.length > 0,
    ...enforcementChecks,
    ciFullFailures: resolveCiFullFailures(ciFullSummary),
  };
}
