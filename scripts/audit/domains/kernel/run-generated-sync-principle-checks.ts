import { readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type AuditPlanOwner = {
  capabilityDomain?: string;
};

type AuditPlan = {
  generatedAt?: string;
  phaseGateFile?: string;
  owners?: AuditPlanOwner[];
};

type EnforcementMatrixOwner = {
  capabilityDomain?: string;
};

type EnforcementMatrix = {
  generatedAt?: string;
  owners?: EnforcementMatrixOwner[];
};

type GeneratedSyncState = {
  packageJsonText: string;
  runInspectorText: string;
  auditPlan: AuditPlan;
  enforcementMatrix: EnforcementMatrix;
  auditPlanDomains: Set<string>;
  enforcementMatrixDomains: Set<string>;
};

const DELETED_OWNER_DOMAINS = [
  "local-data",
  "localization",
  "platform-action",
  "local-ai-runtime",
  "local-browser-session",
  "local-app-shell",
  "startup-entrypoint",
  "structured-logging",
  "local-persistence-schema",
  "multi-frame-evidence",
  "code-topology",
] as const;

const createRequirementFinding = (input: {
  requirementId: string;
  file: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.requirementId,
  file: input.file,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const collectDeletedOwnerReintroductionFindings = (input: {
  requirementId: string;
  file: string;
  domains: Set<string>;
  message: string;
}): Finding[] => DELETED_OWNER_DOMAINS
  .filter((domain) => input.domains.has(domain))
  .map((domain) => createRequirementFinding({
    requirementId: input.requirementId,
    file: input.file,
    message: input.message,
    detail: domain,
  }));

const loadGeneratedSyncState = async (): Promise<GeneratedSyncState> => {
  const [packageJsonText, runInspectorText, auditPlan, enforcementMatrix] = await Promise.all([
    readTextFile(pathFromRepoRoot("package.json")),
    readTextFile(pathFromRepoRoot(kernelInspectionConstants.RUN_INSPECTOR_FILE)),
    readJsonFile<AuditPlan>(pathFromRepoRoot("scripts/audit/generated/audit-plan.generated.json")),
    readJsonFile<EnforcementMatrix>(pathFromRepoRoot("scripts/audit/generated/enforcement-matrix.generated.json")),
  ]);

  return {
    packageJsonText,
    runInspectorText,
    auditPlan,
    enforcementMatrix,
    auditPlanDomains: new Set((auditPlan.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : [])),
    enforcementMatrixDomains: new Set((enforcementMatrix.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : [])),
  };
};

const countFindingsByLawIds = (findings: Finding[], lawIds: string[]): number => {
  return findings.filter((finding) => lawIds.includes(finding.lawId)).length;
};

const buildGeneratedSyncPhases = (findings: Finding[]): InspectorPhase[] => {
  const sourceOfTruthFindings = countFindingsByLawIds(findings, [
    "K01-BLUEPRINT-01-SECTION-009-REQ-001",
    "K01-BLUEPRINT-01-SECTION-009-REQ-004",
  ]);
  const deletedOwnerRevivalFindings = countFindingsByLawIds(findings, [
    "K01-BLUEPRINT-01-SECTION-009-REQ-002",
    "K01-BLUEPRINT-01-SECTION-009-REQ-003",
  ]);
  const runnerBaselineFindings = countFindingsByLawIds(findings, ["K01-BLUEPRINT-01-SECTION-009-REQ-005"]);

  return [
    createPhase(
      "generated-artifact-source-of-truth",
      sourceOfTruthFindings === 0 ? "PASS" : "CODE VIOLATION",
      sourceOfTruthFindings === 0,
      sourceOfTruthFindings === 0
        ? "Generated audit artifacts are rebuilt through the governed build chain and keep machine-owned metadata."
        : "Generated audit artifacts drifted away from the governed build chain or lost machine-owned metadata.",
    ),
    createPhase(
      "deleted-owner-ci-revival-ban",
      deletedOwnerRevivalFindings === 0 ? "PASS" : "CODE VIOLATION",
      deletedOwnerRevivalFindings === 0,
      deletedOwnerRevivalFindings === 0
        ? "Generated artifacts do not revive deleted owners to satisfy CI."
        : "Generated artifacts still revive deleted owners to satisfy CI.",
    ),
    createPhase(
      "runner-frozen-baseline-owners",
      runnerBaselineFindings === 0 ? "PASS" : "CODE VIOLATION",
      runnerBaselineFindings === 0,
      runnerBaselineFindings === 0
        ? "Runner audit plan executes only owners allowed by the frozen baseline."
        : "Runner audit plan still includes owners outside the frozen baseline.",
    ),
  ];
};

const collectGeneratedArtifactSourceFindings = (state: GeneratedSyncState): Finding[] => {
  const findings: Finding[] = [];

  if (!state.packageJsonText.includes('"ci:full"')) {
    findings.push(createRequirementFinding({
      requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-001",
      file: "package.json",
      message: "package.json must expose ci:full as the single complete quality entrypoint.",
    }));
  }

  if (state.runInspectorText.includes("buildAuditArtifacts")) {
    findings.push(createRequirementFinding({
      requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-001",
      file: kernelInspectionConstants.RUN_INSPECTOR_FILE,
      message: "Owner run-inspector must not rebuild generated audit artifacts outside CI-FULL.",
    }));
  }

  return findings;
};

const collectGeneratedArtifactMetadataFindings = (state: GeneratedSyncState): Finding[] => {
  return !state.auditPlan.generatedAt || !state.enforcementMatrix.generatedAt || state.auditPlan.phaseGateFile !== "scripts/audit/phase-gates/phase-05-final-delivery-debug.json"
    ? [createRequirementFinding({
        requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-004",
        file: "scripts/audit/generated/audit-plan.generated.json",
        message: "Generated audit artifacts must keep machine-owned metadata instead of hand-written fake pass content.",
        detail: `auditPlan.generatedAt=${String(state.auditPlan.generatedAt)}, enforcementMatrix.generatedAt=${String(state.enforcementMatrix.generatedAt)}, phaseGateFile=${String(state.auditPlan.phaseGateFile)}`,
      })]
    : [];
};

const collectGeneratedSyncFindings = (state: GeneratedSyncState): Finding[] => {
  return [
    ...collectGeneratedArtifactSourceFindings(state),
    ...collectDeletedOwnerReintroductionFindings({
      requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-002",
      file: "scripts/audit/generated/audit-plan.generated.json",
      domains: state.auditPlanDomains,
      message: "Generated audit-plan must not revive old owners to make CI pass.",
    }),
    ...collectDeletedOwnerReintroductionFindings({
      requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-003",
      file: "scripts/audit/generated/enforcement-matrix.generated.json",
      domains: state.enforcementMatrixDomains,
      message: "Generated enforcement matrix must not restore deleted owners for CI convenience.",
    }),
    ...collectGeneratedArtifactMetadataFindings(state),
    ...collectDeletedOwnerReintroductionFindings({
      requirementId: "K01-BLUEPRINT-01-SECTION-009-REQ-005",
      file: "scripts/audit/generated/audit-plan.generated.json",
      domains: state.auditPlanDomains,
      message: "Generated runner audit plan must not execute owners outside the frozen baseline.",
    }),
  ];
};

export async function runGeneratedSyncPrincipleChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const state = await loadGeneratedSyncState();
  const findings = collectGeneratedSyncFindings(state);

  return {
    findings,
    phases: buildGeneratedSyncPhases(findings),
  };
}
