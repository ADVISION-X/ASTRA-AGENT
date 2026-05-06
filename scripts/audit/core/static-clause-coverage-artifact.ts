import type { AuditPlan, GeneratedLawRegistry } from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import { ABILITY_GROUP_DOMAINS, buildStaticCoverageRecords } from "./static-clause-coverage-record-builder.js";
import type { GlobalChainStatus, SourceEvidence } from "./static-clause-coverage-support.js";

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

export const buildStaticClauseCoverageArtifact = async (input: {
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
}): Promise<StaticClauseCoverageArtifact> => {
  const { laws, globalChain } = await buildStaticCoverageRecords(input);
  return {
    generatedAt: new Date().toISOString(),
    abilityGroupCount: ABILITY_GROUP_DOMAINS.length,
    abilityGroupDomains: [...ABILITY_GROUP_DOMAINS],
    totalActiveLaws: laws.length,
    globalChain,
    laws,
  };
};
