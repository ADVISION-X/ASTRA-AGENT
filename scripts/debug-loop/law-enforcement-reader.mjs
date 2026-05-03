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

function resolveRemainingP0(runnerSummary) {
  return (runnerSummary.results ?? [])
    .flatMap((result) => result.findings ?? [])
    .filter((finding) => String(finding.severity ?? "").toLowerCase() === "error")
    .map((finding) => `${finding.lawId ?? "unknown-law"}:${finding.message ?? "error"}`);
}

function resolveNegativeProofPhase(runnerOwnerEntry) {
  return (runnerOwnerEntry?.phases ?? []).find((phase) => /negative[- ]proof/i.test(phase.name ?? "")) ?? null;
}

function resolveNegativeProofStatus(runnerOwnerEntry) {
  const negativeProofPhase = resolveNegativeProofPhase(runnerOwnerEntry);
  if (!negativeProofPhase) {
    return "FAIL";
  }

  return negativeProofPhase.passed === true ? "PASS" : "FAIL";
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

function hasEmptyNegativeProof(runnerOwnerEntry) {
  const negativeProofPhase = resolveNegativeProofPhase(runnerOwnerEntry);
  if (!negativeProofPhase) {
    return true;
  }

  return typeof negativeProofPhase.summary !== "string" || negativeProofPhase.summary.trim().length === 0;
}

function buildOwnerCoverage(ownerDomain, matrixOwnerEntry, auditPlanOwnerEntry, runnerOwnerEntry) {
  return {
    hasMatrixEntry: ownerDomain === null ? true : matrixOwnerEntry !== null,
    ownerInAuditPlan: ownerDomain === null ? true : auditPlanOwnerEntry !== null,
    runnerSummaryIncludesOwner: ownerDomain === null ? true : runnerOwnerEntry !== null,
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
    input.runnerSummaryIncludesOwner,
    input.missingMatrixLawIds.length === 0,
    input.missingAuditPlanLawIds.length === 0,
    input.missingP0P1LawCoverage.length === 0,
    input.negativeProof === "PASS",
    !input.warningOnlyP0,
    !input.detachedInspector,
    !input.emptyNegativeProof,
  ].every(Boolean);
}

function buildLawEnforcementChecks(input) {
  const missingMatrixLawIds = resolveMissingLawIds(input.activeLaws, input.matrixOwnerEntry);
  const missingAuditPlanLawIds = resolveMissingLawIds(input.activeLaws, input.auditPlanOwnerEntry);
  const missingP0P1LawCoverage = resolveMissingP0P1Coverage(input.activeLaws, input.matrixOwnerEntry);
  const ownerCoverage = buildOwnerCoverage(input.ownerDomain, input.matrixOwnerEntry, input.auditPlanOwnerEntry, input.runnerOwnerEntry);
  const negativeProof = resolveNegativeProofStatus(input.runnerOwnerEntry);
  const warningOnlyP0 = hasWarningOnlyP0(input.activeLaws);
  const detachedInspector = ownerCoverage.hasMatrixEntry && !ownerCoverage.ownerInAuditPlan;
  const emptyNegativeProof = hasEmptyNegativeProof(input.runnerOwnerEntry);

  return {
    ...ownerCoverage,
    missingMatrixLawIds,
    missingAuditPlanLawIds,
    missingP0P1LawCoverage,
    negativeProof,
    warningOnlyP0,
    detachedInspector,
    emptyNegativeProof,
    lawEnforcementPassed: resolveLawEnforcementPassed({
      ownerDomain: input.ownerDomain,
      activeLaws: input.activeLaws,
      ...ownerCoverage,
      missingMatrixLawIds,
      missingAuditPlanLawIds,
      missingP0P1LawCoverage,
      negativeProof,
      warningOnlyP0,
      detachedInspector,
      emptyNegativeProof,
    }),
  };
}

export async function readLawEnforcementState(input = {}) {
  const [lawRegistry, enforcementMatrix, auditPlan, runnerSummary] = await Promise.all([
    readGeneratedArtifact("law-registry.generated.json"),
    readGeneratedArtifact("enforcement-matrix.generated.json"),
    readGeneratedArtifact("audit-plan.generated.json"),
    readGeneratedArtifact("runner-summary.json"),
  ]);

  const ownerDomain = resolveOwnerDomain(input.owner);
  const activeLaws = resolveActiveLaws(lawRegistry, ownerDomain);
  const matrixOwnerEntry = resolveOwnerEntry(enforcementMatrix.owners, ownerDomain);
  const auditPlanOwnerEntry = resolveOwnerEntry(auditPlan.owners, ownerDomain);
  const runnerOwnerEntry = resolveOwnerEntry(runnerSummary.results, ownerDomain);
  const enforcementChecks = buildLawEnforcementChecks({ ownerDomain, activeLaws, matrixOwnerEntry, auditPlanOwnerEntry, runnerOwnerEntry });

  return {
    lawRegistry,
    enforcementMatrix,
    auditPlan,
    runnerSummary,
    ownerDomain,
    activeLawIds: activeLaws.map((law) => law.lawId),
    hasActiveLaw: activeLaws.length > 0,
    ...enforcementChecks,
    remainingP0: resolveRemainingP0(runnerSummary),
  };
}