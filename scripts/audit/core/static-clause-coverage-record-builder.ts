import path from "node:path";

import { type SourceFile } from "ts-morph";

import { createAuditProject } from "../domains/_shared/ast-helpers.js";
import { listFilesRecursive, readJsonFile } from "./filesystem.js";
import { loadDomainManifests } from "./manifests.js";
import { pathFromRepoRoot } from "./paths.js";
import type { AuditPlan, GeneratedLawRegistry } from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import type { StaticClauseCoverageArtifact, StaticClauseCoverageRecord, StaticCoverageStatus } from "./static-clause-coverage-artifact.js";
import {
  loadAuditSummary,
  mergeEvidenceMaps,
  resolveCommandStatuses,
  type AuditSummaryEntry,
  type GlobalChainStatus,
  type SourceEvidence,
} from "./static-clause-coverage-support.js";

export const ABILITY_GROUP_DOMAINS = [
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

type CoverageStatusInput = {
  inspectorMapped: boolean;
  ownerAuditScriptDeclared: boolean;
  ownerAuditPassed: boolean;
  globalChainObserved: boolean;
  globalChainPassed: boolean;
};

type BlockerInput = {
  matrixMapped: boolean;
  auditPlanMapped: boolean;
  inspectorMapped: boolean;
  ownerAuditScriptDeclared: boolean;
  ownerAuditPassed: boolean;
  globalChain: StaticClauseCoverageArtifact["globalChain"];
};

type StaticCoverageBuildContext = {
  manifestsByDomain: Map<string, Awaited<ReturnType<typeof loadDomainManifests>>[number]>;
  matrixOwnersByDomain: Map<string, EnforcementMatrix["owners"][number]>;
  planOwnersByDomain: Map<string, AuditPlan["owners"][number]>;
  evidenceByDomain: Map<string, Map<string, SourceEvidence[]>>;
  packageScripts: Record<string, string>;
  auditSummary: Map<string, AuditSummaryEntry>;
  globalChain: GlobalChainStatus;
};

type StaticCoverageRecordRefs = {
  abilityGroupId: string | null;
  ownerManifestPath: string;
  ownerInspectorEntry: string;
  ownerAuditScript: string | null;
  sourceEvidence: SourceEvidence[];
  matrixMapped: boolean;
  auditPlanMapped: boolean;
};

type StaticCoverageRecordStatus = {
  ownerAuditScriptDeclared: boolean;
  ownerAuditPassed: boolean;
  inspectorMapped: boolean;
  coverageStatus: StaticCoverageStatus;
};

const PACKAGE_JSON_PATH = pathFromRepoRoot("package.json");

const COVERAGE_STATUS_RULES: readonly {
  status: StaticCoverageStatus;
  applies: (input: CoverageStatusInput) => boolean;
}[] = [
  { status: "NOT_COVERED", applies: (input) => !input.inspectorMapped },
  { status: "INSPECTOR_MAPPED", applies: (input) => !input.ownerAuditScriptDeclared || !input.ownerAuditPassed },
  { status: "OWNER_AUDIT_PASS", applies: (input) => !input.globalChainObserved },
  { status: "OWNER_PROOF_COMPLETE_BUT_GLOBAL_CHAIN_BLOCKED", applies: (input) => !input.globalChainPassed },
] as const;

const BLOCKER_RULES: readonly {
  applies: (input: BlockerInput) => boolean;
  message: string;
}[] = [
  { applies: (input) => !input.matrixMapped, message: "Law is missing from the generated enforcement matrix." },
  { applies: (input) => !input.auditPlanMapped, message: "Law is missing from the generated audit plan." },
  { applies: (input) => !input.inspectorMapped, message: "Owner inspector source does not expose concrete law coverage evidence." },
  { applies: (input) => !input.ownerAuditScriptDeclared, message: "Owner audit script is missing from package.json." },
  { applies: (input) => !input.ownerAuditPassed, message: "Owner audit command is failing or missing fresh evidence." },
] as const;

const getAbilityGroupId = (capabilityDomain: string): string | null =>
  capabilityDomain.endsWith("-capability") ? capabilityDomain.slice(0, -"-capability".length) : null;

const getOwnerAuditScript = (capabilityDomain: string): string | null => {
  const abilityGroupId = getAbilityGroupId(capabilityDomain);
  if (!abilityGroupId) {
    return null;
  }
  return abilityGroupId === "text-input" ? "audit:text-input-capability" : `audit:${abilityGroupId}`;
};

const loadPackageScripts = async (): Promise<Record<string, string>> => {
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(PACKAGE_JSON_PATH);
  return packageJson.scripts ?? {};
};

const getOwnerAuditStatus = async (summary: Map<string, AuditSummaryEntry>, auditScript: string | null): Promise<boolean> =>
  auditScript !== null && summary.get(auditScript)?.exitCode === 0;

const getDomainSourceFiles = async (capabilityDomain: string): Promise<string[]> =>
  listFilesRecursive(pathFromRepoRoot(path.join("scripts", "audit", "domains", capabilityDomain)), { extensions: [".ts"] });

const determineCoverageStatus = (input: CoverageStatusInput): StaticCoverageStatus =>
  COVERAGE_STATUS_RULES.find((rule) => rule.applies(input))?.status ?? "ENFORCED";

const collectBlockers = (input: BlockerInput): string[] => [
  ...BLOCKER_RULES.filter((rule) => rule.applies(input)).map((rule) => rule.message),
  ...input.globalChain.blockers,
];

const getActiveAbilityLaws = (lawRegistry: GeneratedLawRegistry): GeneratedLawRegistry["laws"] =>
  lawRegistry.laws.filter((law) => ABILITY_GROUP_DOMAINS.includes(law.capabilityDomain as (typeof ABILITY_GROUP_DOMAINS)[number]));

const buildEvidenceByDomain = async (activeAbilityLaws: GeneratedLawRegistry["laws"]): Promise<Map<string, Map<string, SourceEvidence[]>>> => {
  const project = createAuditProject();
  const evidenceByDomain = new Map<string, Map<string, SourceEvidence[]>>();
  for (const capabilityDomain of new Set(activeAbilityLaws.map((law) => law.capabilityDomain))) {
    const filePaths = await getDomainSourceFiles(capabilityDomain);
    const sourceFiles = filePaths
      .map((filePath) => project.getSourceFile(filePath))
      .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
    evidenceByDomain.set(capabilityDomain, mergeEvidenceMaps(sourceFiles));
  }
  return evidenceByDomain;
};

const buildStaticCoverageContext = async (input: {
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  activeAbilityLaws: GeneratedLawRegistry["laws"];
}): Promise<StaticCoverageBuildContext> => {
  const manifests = await loadDomainManifests();
  return {
    manifestsByDomain: new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest])),
    matrixOwnersByDomain: new Map(input.enforcementMatrix.owners.map((owner) => [owner.capabilityDomain, owner])),
    planOwnersByDomain: new Map(input.auditPlan.owners.map((owner) => [owner.capabilityDomain, owner])),
    evidenceByDomain: await buildEvidenceByDomain(input.activeAbilityLaws),
    packageScripts: await loadPackageScripts(),
    auditSummary: await loadAuditSummary(),
    globalChain: await resolveCommandStatuses(),
  };
};

const collectStaticCoverageRecordRefs = (
  law: GeneratedLawRegistry["laws"][number],
  context: StaticCoverageBuildContext,
): StaticCoverageRecordRefs => {
  const abilityGroupId = getAbilityGroupId(law.capabilityDomain);
  const manifest = context.manifestsByDomain.get(law.capabilityDomain);
  const matrixOwner = context.matrixOwnersByDomain.get(law.capabilityDomain);
  const planOwner = context.planOwnersByDomain.get(law.capabilityDomain);
  const domainEvidence = context.evidenceByDomain.get(law.capabilityDomain) ?? new Map();
  return {
    abilityGroupId,
    ownerManifestPath: manifest?.manifestPath ?? `scripts/audit/domains/${law.capabilityDomain}/manifest.json`,
    ownerInspectorEntry: manifest?.entry ?? `scripts/audit/domains/${law.capabilityDomain}/inspector.ts`,
    ownerAuditScript: getOwnerAuditScript(law.capabilityDomain),
    sourceEvidence: domainEvidence.get(law.lawId) ?? [],
    matrixMapped: Boolean(matrixOwner?.lawIds.includes(law.lawId)),
    auditPlanMapped: Boolean(planOwner?.lawIds.includes(law.lawId)),
  };
};

const collectStaticCoverageRecordStatus = async (
  refs: StaticCoverageRecordRefs,
  context: StaticCoverageBuildContext,
): Promise<StaticCoverageRecordStatus> => {
  const ownerAuditScriptDeclared = Boolean(refs.ownerAuditScript && context.packageScripts[refs.ownerAuditScript]);
  const ownerAuditPassed = await getOwnerAuditStatus(context.auditSummary, refs.ownerAuditScript);
  const inspectorMapped = refs.sourceEvidence.length > 0;
  return {
    ownerAuditScriptDeclared,
    ownerAuditPassed,
    inspectorMapped,
    coverageStatus: determineCoverageStatus({ inspectorMapped, ownerAuditScriptDeclared, ownerAuditPassed, globalChainObserved: context.globalChain.observed, globalChainPassed: context.globalChain.passed }),
  };
};

const createStaticCoverageRecord = async (
  law: GeneratedLawRegistry["laws"][number],
  context: StaticCoverageBuildContext,
): Promise<StaticClauseCoverageRecord> => {
  const refs = collectStaticCoverageRecordRefs(law, context);
  const status = await collectStaticCoverageRecordStatus(refs, context);
  return {
    lawId: law.lawId,
    capabilityDomain: law.capabilityDomain,
    abilityGroupId: refs.abilityGroupId,
    ownerManifestPath: refs.ownerManifestPath,
    ownerInspectorEntry: refs.ownerInspectorEntry,
    ownerAuditScript: refs.ownerAuditScript,
    ownerAuditScriptDeclared: status.ownerAuditScriptDeclared,
    coverageStatus: status.coverageStatus,
    matrixMapped: refs.matrixMapped,
    auditPlanMapped: refs.auditPlanMapped,
    inspectorMapped: status.inspectorMapped,
    ownerAuditPassed: status.ownerAuditPassed,
    globalChainPassed: context.globalChain.passed,
    sourceEvidence: refs.sourceEvidence,
    blockers: collectBlockers({ matrixMapped: refs.matrixMapped, auditPlanMapped: refs.auditPlanMapped, inspectorMapped: status.inspectorMapped, ownerAuditScriptDeclared: status.ownerAuditScriptDeclared, ownerAuditPassed: status.ownerAuditPassed, globalChain: context.globalChain }),
  };
};

export const buildStaticCoverageRecords = async (input: {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
}): Promise<{ laws: StaticClauseCoverageRecord[]; globalChain: GlobalChainStatus }> => {
  const activeAbilityLaws = getActiveAbilityLaws(input.lawRegistry);
  const context = await buildStaticCoverageContext({ enforcementMatrix: input.enforcementMatrix, auditPlan: input.auditPlan, activeAbilityLaws });
  return {
    laws: await Promise.all(activeAbilityLaws.map((law) => createStaticCoverageRecord(law, context))),
    globalChain: context.globalChain,
  };
};
