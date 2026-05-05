import path from "node:path";

import { type SourceFile } from "ts-morph";

import { createAuditProject } from "../domains/_shared/ast-helpers.js";
import { fileExists, listFilesRecursive, readJsonFile, readTextFile } from "./filesystem.js";
import { loadDomainManifests } from "./manifests.js";
import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";
import type { AuditPlan, GeneratedLawRegistry } from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import {
  loadAuditSummary,
  mergeEvidenceMaps,
  resolveCommandStatuses,
  type AuditSummaryEntry,
  type GlobalChainStatus,
  type SourceEvidence,
} from "./static-clause-coverage-support.js";

export const STATIC_COVERAGE_STATUSES = [
  "NOT_COVERED",
  "INSPECTOR_MAPPED",
  "NEGATIVE_PROOF_MAPPED",
  "MUTATION_PROOF_CAPTURED",
  "OWNER_BINDING_PROOF_CAPTURED",
  "OWNER_AUDIT_PASS",
  "OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED",
  "ENFORCED",
] as const;

export type StaticCoverageStatus = (typeof STATIC_COVERAGE_STATUSES)[number];

export type StaticClauseCoverageRecord = {
  lawId: string;
  capabilityDomain: string;
  abilityGroupId: string | null;
  ownerManifestPath: string;
  ownerInspectorEntry: string;
  negativeProofPath: string;
  ownerAuditScript: string | null;
  ownerAuditScriptDeclared: boolean;
  coverageStatus: StaticCoverageStatus;
  matrixMapped: boolean;
  auditPlanMapped: boolean;
  inspectorMapped: boolean;
  negativeProofMapped: boolean;
  mutationProofPresent: boolean;
  ownerBindingProofPresent: boolean;
  ownerAuditPassed: boolean;
  globalChainPassed: boolean;
  sourceEvidence: SourceEvidence[];
  blockers: string[];
  mutationProofPath: string | null;
  ownerBindingProofPath: string | null;
};

export type StaticClauseCoverageArtifact = {
  generatedAt: string;
  abilityGroupCount: number;
  abilityGroupDomains: string[];
  totalActiveLaws: number;
  globalChain: GlobalChainStatus;
  laws: StaticClauseCoverageRecord[];
};

const ABILITY_GROUP_DOMAINS = [
  "commander-console-capability",
  "orchestration-capability",
  "nerve-bus-capability",
  "ai-capability",
  "open-capability",
  "screenshot-capability",
  "visual-target-capability",
  "geometry-guard-capability",
  "mouse-click-capability",
  "text-input-capability",
  "mouse-scroll-capability",
  "post-action-verification-capability",
  "forensics-persistence-capability",
  "page-state-capability",
] as const;

const PACKAGE_JSON_PATH = pathFromRepoRoot("package.json");

const getAbilityGroupId = (capabilityDomain: string): string | null =>
  capabilityDomain.endsWith("-capability") ? capabilityDomain.slice(0, -"-capability".length) : null;

const getOwnerAuditScript = (capabilityDomain: string): string | null => {
  const abilityGroupId = getAbilityGroupId(capabilityDomain);
  if (!abilityGroupId) {
    return null;
  }

  if (abilityGroupId === "text-input") {
    return "audit:text-input-capability";
  }

  return `audit:${abilityGroupId}`;
};

const loadPackageScripts = async (): Promise<Record<string, string>> => {
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(PACKAGE_JSON_PATH);
  return packageJson.scripts ?? {};
};

const getOwnerAuditStatus = async (summary: Map<string, AuditSummaryEntry>, auditScript: string | null): Promise<boolean> => {
  return auditScript !== null && summary.get(auditScript)?.exitCode === 0;
};

const getDomainSourceFiles = async (capabilityDomain: string): Promise<string[]> => {
  const domainDir = pathFromRepoRoot(path.join("scripts", "audit", "domains", capabilityDomain));
  return listFilesRecursive(domainDir, { extensions: [".ts"] });
};

const getMutationProofPath = (abilityGroupId: string | null, lawId: string): string | null => {
  if (!abilityGroupId) {
    return null;
  }

  return `tmp/audit/ability-law-census/regression-proofs/${abilityGroupId}/${lawId}/proof-summary.md`;
};

const getOwnerBindingProofPath = (abilityGroupId: string | null): string | null => {
  if (!abilityGroupId) {
    return null;
  }

  return `tmp/audit/ability-law-census/regression-proofs/${abilityGroupId}/owner-binding/owner-binding-proof-summary.md`;
};

const hasRequiredProofMarkers = async (
  proofPath: string | null,
  requiredMarkers: readonly string[],
): Promise<boolean> => {
  if (!proofPath || !(await fileExists(pathFromRepoRoot(proofPath)))) {
    return false;
  }

  const content = await readTextFile(pathFromRepoRoot(proofPath));
  return requiredMarkers.every((marker) => content.includes(marker));
};

const determineCoverageStatus = (input: {
  inspectorMapped: boolean;
  negativeProofMapped: boolean;
  mutationProofPresent: boolean;
  ownerBindingProofPresent: boolean;
  ownerAuditScriptDeclared: boolean;
  ownerAuditPassed: boolean;
  globalChainObserved: boolean;
  globalChainPassed: boolean;
}): StaticCoverageStatus => {
  if (!input.inspectorMapped) {
    return "NOT_COVERED";
  }
  if (!input.negativeProofMapped) {
    return "INSPECTOR_MAPPED";
  }
  if (!input.mutationProofPresent) {
    return "NEGATIVE_PROOF_MAPPED";
  }
  if (!input.ownerBindingProofPresent) {
    return "MUTATION_PROOF_CAPTURED";
  }
  if (!input.ownerAuditScriptDeclared || !input.ownerAuditPassed) {
    return "OWNER_BINDING_PROOF_CAPTURED";
  }
  if (!input.globalChainObserved) {
    return "OWNER_AUDIT_PASS";
  }
  if (!input.globalChainPassed) {
    return "OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED";
  }

  return "ENFORCED";
};

const collectBlockers = (input: {
  matrixMapped: boolean;
  auditPlanMapped: boolean;
  inspectorMapped: boolean;
  negativeProofMapped: boolean;
  mutationProofPresent: boolean;
  ownerBindingProofPresent: boolean;
  ownerAuditScriptDeclared: boolean;
  ownerAuditPassed: boolean;
  globalChain: StaticClauseCoverageArtifact["globalChain"];
}): string[] => {
  const blockers: string[] = [];
  if (!input.matrixMapped) {
    blockers.push("Law is missing from the generated enforcement matrix.");
  }
  if (!input.auditPlanMapped) {
    blockers.push("Law is missing from the generated audit plan.");
  }
  if (!input.inspectorMapped) {
    blockers.push("Owner inspector source does not expose concrete law coverage evidence.");
  }
  if (!input.negativeProofMapped) {
    blockers.push("Owner negative-proof harness is missing.");
  }
  if (!input.mutationProofPresent) {
    blockers.push("Production mutation proof bundle is missing.");
  }
  if (!input.ownerBindingProofPresent) {
    blockers.push("Owner-binding proof bundle is missing.");
  }
  if (!input.ownerAuditScriptDeclared) {
    blockers.push("Owner audit script is missing from package.json.");
  }
  if (!input.ownerAuditPassed) {
    blockers.push("Owner audit command is failing or missing fresh evidence.");
  }
  blockers.push(...input.globalChain.blockers);
  return blockers;
};

export const buildStaticClauseCoverageArtifact = async (input: {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
}): Promise<StaticClauseCoverageArtifact> => {
  const manifests = await loadDomainManifests();
  const auditSummary = await loadAuditSummary();
  const packageScripts = await loadPackageScripts();
  const manifestsByDomain = new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest]));
  const matrixOwnersByDomain = new Map(input.enforcementMatrix.owners.map((owner) => [owner.capabilityDomain, owner]));
  const planOwnersByDomain = new Map(input.auditPlan.owners.map((owner) => [owner.capabilityDomain, owner]));
  const globalChain = await resolveCommandStatuses();
  const project = createAuditProject();
  const evidenceByDomain = new Map<string, Map<string, SourceEvidence[]>>();
  const activeAbilityLaws = input.lawRegistry.laws.filter((law) => ABILITY_GROUP_DOMAINS.includes(law.capabilityDomain as (typeof ABILITY_GROUP_DOMAINS)[number]));

  for (const capabilityDomain of new Set(activeAbilityLaws.map((law) => law.capabilityDomain))) {
    const filePaths = await getDomainSourceFiles(capabilityDomain);
    const sourceFiles = filePaths
      .map((filePath) => project.getSourceFile(filePath))
      .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
    evidenceByDomain.set(capabilityDomain, mergeEvidenceMaps(sourceFiles));
  }

  const laws = await Promise.all(activeAbilityLaws.map(async (law) => {
    const abilityGroupId = getAbilityGroupId(law.capabilityDomain);
    const manifest = manifestsByDomain.get(law.capabilityDomain);
    const matrixOwner = matrixOwnersByDomain.get(law.capabilityDomain);
    const planOwner = planOwnersByDomain.get(law.capabilityDomain);
    const domainEvidence = evidenceByDomain.get(law.capabilityDomain) ?? new Map();
    const sourceEvidence = domainEvidence.get(law.lawId) ?? [];
    const mutationProofPath = getMutationProofPath(abilityGroupId, law.lawId);
    const ownerBindingProofPath = getOwnerBindingProofPath(abilityGroupId);
    const ownerAuditScript = getOwnerAuditScript(law.capabilityDomain);
    const ownerAuditScriptDeclared = Boolean(ownerAuditScript && packageScripts[ownerAuditScript]);
    const ownerAuditPassed = await getOwnerAuditStatus(auditSummary, ownerAuditScript);
    const negativeProofPath = `scripts/audit/domains/${law.capabilityDomain}/negative-proof-harness.ts`;
    const negativeProofMapped = await fileExists(pathFromRepoRoot(negativeProofPath));
    const mutationProofPresent = await hasRequiredProofMarkers(mutationProofPath, [
      "coveredLawIds:",
      "Mutated production file caused",
      "Rollback restored the production file",
    ]);
    const ownerBindingProofPresent = await hasRequiredProofMarkers(ownerBindingProofPath, [
      "FAIL observed",
      "rollback:",
    ]);
    const matrixMapped = Boolean(matrixOwner?.lawIds.includes(law.lawId));
    const auditPlanMapped = Boolean(planOwner?.lawIds.includes(law.lawId));
    const inspectorMapped = sourceEvidence.length > 0;
    const coverageStatus = determineCoverageStatus({
      inspectorMapped,
      negativeProofMapped,
      mutationProofPresent,
      ownerBindingProofPresent,
      ownerAuditScriptDeclared,
      ownerAuditPassed,
      globalChainObserved: globalChain.observed,
      globalChainPassed: globalChain.passed,
    });

    return {
      lawId: law.lawId,
      capabilityDomain: law.capabilityDomain,
      abilityGroupId,
      ownerManifestPath: manifest?.manifestPath ?? `scripts/audit/domains/${law.capabilityDomain}/manifest.json`,
      ownerInspectorEntry: manifest?.entry ?? `scripts/audit/domains/${law.capabilityDomain}/inspector.ts`,
      negativeProofPath,
      ownerAuditScript,
      ownerAuditScriptDeclared,
      coverageStatus,
      matrixMapped,
      auditPlanMapped,
      inspectorMapped,
      negativeProofMapped,
      mutationProofPresent,
      ownerBindingProofPresent,
      ownerAuditPassed,
      globalChainPassed: globalChain.passed,
      sourceEvidence,
      blockers: collectBlockers({
        matrixMapped,
        auditPlanMapped,
        inspectorMapped,
        negativeProofMapped,
        mutationProofPresent,
        ownerBindingProofPresent,
        ownerAuditScriptDeclared,
        ownerAuditPassed,
        globalChain,
      }),
      mutationProofPath,
      ownerBindingProofPath,
    } satisfies StaticClauseCoverageRecord;
  }));

  return {
    generatedAt: new Date().toISOString(),
    abilityGroupCount: ABILITY_GROUP_DOMAINS.length,
    abilityGroupDomains: [...ABILITY_GROUP_DOMAINS],
    totalActiveLaws: laws.length,
    globalChain,
    laws,
  };
};
