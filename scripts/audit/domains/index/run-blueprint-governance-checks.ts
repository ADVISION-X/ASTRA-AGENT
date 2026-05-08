import { readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { indexInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

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

type PhaseGate = {
  activeLawDomains?: string[];
};

type DeletedOwnerRequirement = {
  requirementId: string;
  label: string;
  deletedDomain?: string;
  expectedRehomedDomain?: string;
};

const { BLUEPRINT_FILE, RUN_INSPECTOR_FILE } = indexInspectionConstants;

const DELETED_OWNER_REQUIREMENTS: DeletedOwnerRequirement[] = [
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-001", label: "local-data", deletedDomain: "local-data" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-002", label: "localization", deletedDomain: "localization" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-003", label: "platform-action as action owner", deletedDomain: "platform-action", expectedRehomedDomain: "open-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-004", label: "local-ai-runtime as independent owner", deletedDomain: "local-ai-runtime", expectedRehomedDomain: "ai-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-005", label: "local-browser-session as independent owner", deletedDomain: "local-browser-session", expectedRehomedDomain: "open-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-006", label: "local-app-shell as independent owner", deletedDomain: "local-app-shell", expectedRehomedDomain: "commander-console-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-007", label: "startup-entrypoint as independent owner", deletedDomain: "startup-entrypoint", expectedRehomedDomain: "commander-console-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-008", label: "structured-logging as independent owner", deletedDomain: "structured-logging", expectedRehomedDomain: "forensics-persistence-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-009", label: "local-persistence-schema as independent owner", deletedDomain: "local-persistence-schema", expectedRehomedDomain: "forensics-persistence-capability" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-010", label: "multi-frame-evidence as independent owner", deletedDomain: "multi-frame-evidence" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-011", label: "code-topology as independent owner", deletedDomain: "code-topology", expectedRehomedDomain: "capability-group-governance" },
  { requirementId: "K02-BLUEPRINT-01-SECTION-008-REQ-012", label: "code-purity as independent owner", deletedDomain: "code-purity", expectedRehomedDomain: "audit-system" },
] as const;

const LEGACY_OWNER_DOMAINS = [
  "agent-runtime",
  "agent-browse-flow",
  "agent-mechanical-skills",
  "operator-control",
  "visual-action",
  "visual-only-runtime",
  "evidence-packet",
  "product-signal",
  "comment-intelligence",
  "vision-boundary",
] as const;

const MACHINE_MARKERS = ["required", "forbidden", "ready"] as const;

const createBlueprintFinding = (input: {
  lawId: string;
  file?: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: input.file ?? BLUEPRINT_FILE,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

const parseBulletSection = (content: string, heading: string): string[] => {
  const lines = content.split(/\r?\n/);
  return extractSectionLines(lines, heading)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
};

const containsMachineMarkers = (sectionLines: string[]): boolean =>
  sectionLines.some((line) => {
    const normalized = line.toLowerCase();
    return MACHINE_MARKERS.some((marker) => normalized.includes(marker));
  });

const collectDeletedOwnerReintroductionFindings = (input: {
  requirementId: string;
  file: string;
  domains: Set<string>;
  message: string;
}): Finding[] => DELETED_OWNER_REQUIREMENTS.flatMap((requirement) => {
  const deletedDomain = requirement.deletedDomain;
  if (!deletedDomain || !input.domains.has(deletedDomain)) {
    return [];
  }

  return [createBlueprintFinding({
    lawId: input.requirementId,
    file: input.file,
    message: input.message,
    detail: deletedDomain,
  })];
});

const loadBlueprintGovernanceState = async () => {
  const [blueprintContent, packageJson, runInspectorText, auditPlan, enforcementMatrix, phaseGate] = await Promise.all([
    readTextFile(pathFromRepoRoot(BLUEPRINT_FILE)),
    readJsonFile<PackageJson>(pathFromRepoRoot("package.json")),
    readTextFile(pathFromRepoRoot(RUN_INSPECTOR_FILE)),
    readJsonFile<AuditPlan>(pathFromRepoRoot("scripts/audit/generated/audit-plan.generated.json")),
    readJsonFile<EnforcementMatrix>(pathFromRepoRoot("scripts/audit/generated/enforcement-matrix.generated.json")),
    readJsonFile<PhaseGate>(pathFromRepoRoot("scripts/audit/phase-gates/phase-05-final-delivery-debug.json")),
  ]);

  const blueprintLines = blueprintContent.split(/\r?\n/);

  return {
    childContractSection: extractSectionLines(blueprintLines, "## 子契约归属表"),
    deletedOwnerLines: parseBulletSection(blueprintContent, "## 已删除 active owner"),
    syncSection: extractSectionLines(blueprintLines, "## 后续执法系统同步原则"),
    auditPlan,
    enforcementMatrix,
    runInspectorText,
    packageScripts: packageJson.scripts ?? {},
    auditPlanDomains: new Set((auditPlan.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : [])),
    enforcementMatrixDomains: new Set((enforcementMatrix.owners ?? []).flatMap((owner) => owner.capabilityDomain ? [owner.capabilityDomain] : [])),
    phaseGateDomains: new Set(phaseGate.activeLawDomains ?? []),
  };
};

const collectChildContractMachineizationFindings = (childContractSection: string[]): Finding[] => {
  return containsMachineMarkers(childContractSection)
    ? [createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-007-REQ-001", message: "Index blueprint child-contract table must not contain extra required/forbidden/READY machine markers." })]
    : [];
};

const collectDeletedOwnerBaselineFindings = (input: {
  deletedOwnerLines: string[];
  auditPlanDomains: Set<string>;
  enforcementMatrixDomains: Set<string>;
}): Finding[] => {
  return [
    ...collectDeletedOwnerRequirementFindings(input),
    ...collectUnexpectedDeletedOwnerLineFindings(input.deletedOwnerLines),
  ];
};

const collectDeletedOwnerRequirementFindings = (input: {
  deletedOwnerLines: string[];
  auditPlanDomains: Set<string>;
  enforcementMatrixDomains: Set<string>;
}): Finding[] => {
  const findings: Finding[] = [];

  for (const requirement of DELETED_OWNER_REQUIREMENTS) {
    if (!input.deletedOwnerLines.includes(requirement.label)) {
      findings.push(createBlueprintFinding({ lawId: requirement.requirementId, message: "Index blueprint deleted active owner baseline drifted away from the governed list.", detail: `missing line: ${requirement.label}` }));
      continue;
    }
    if (requirement.deletedDomain && (input.auditPlanDomains.has(requirement.deletedDomain) || input.enforcementMatrixDomains.has(requirement.deletedDomain))) {
      findings.push(createBlueprintFinding({ lawId: requirement.requirementId, message: "Deleted active owner must not reappear in generated audit owners.", detail: requirement.deletedDomain }));
    }
    if (requirement.expectedRehomedDomain && !input.auditPlanDomains.has(requirement.expectedRehomedDomain)) {
      findings.push(createBlueprintFinding({ lawId: requirement.requirementId, message: "Deleted independent owner must re-home under its governed current owner.", detail: requirement.expectedRehomedDomain }));
    }
  }

  return findings;
};

const collectUnexpectedDeletedOwnerLineFindings = (deletedOwnerLines: string[]): Finding[] => {
  const unexpectedDeletedOwnerLines = deletedOwnerLines.filter((line) => !DELETED_OWNER_REQUIREMENTS.some((requirement) => requirement.label === line));

  return unexpectedDeletedOwnerLines.length === 0
    ? []
    : [createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-008-REQ-001", message: "Index blueprint deleted active owner list contains unexpected entries.", detail: unexpectedDeletedOwnerLines.join(", ") })];
};

const collectGeneratedBuildChainFindings = (input: {
  syncSection: string[];
  packageScripts: Record<string, string>;
  runInspectorText: string;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.syncSection.includes("后续 audit/generated registry、matrix、audit-plan、phase-gate、manifest、inspector 必须以本冻结基线为唯一源头。")
    || input.packageScripts["audit:build"] !== "node --import tsx scripts/audit/build-audit-artifacts-cli.ts"
    || !input.runInspectorText.includes("await buildAuditArtifacts();")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-001", message: "Index blueprint sync principle requires the governed build chain and index run-inspector rebuild step." }));
  }
  if (LEGACY_OWNER_DOMAINS.some((owner) => `audit:${owner}` in input.packageScripts) || !input.syncSection.includes("- 不得用旧 owner 恢复 CI。")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-002", file: "package.json", message: "Index blueprint sync principle must not revive legacy owners for CI." }));
  }

  return findings;
};

const collectGeneratedDeletedOwnerFindings = (input: {
  syncSection: string[];
  auditPlanDomains: Set<string>;
  enforcementMatrixDomains: Set<string>;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.syncSection.includes("- 不得为了 CI 恢复 deleted owner。")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-003", message: "Index blueprint sync principle must keep the deleted-owner CI revival ban intact." }));
  }
  findings.push(...collectDeletedOwnerReintroductionFindings({ requirementId: "K02-BLUEPRINT-01-SECTION-009-REQ-003", file: "scripts/audit/generated/audit-plan.generated.json", domains: input.auditPlanDomains, message: "Generated audit plan must not revive deleted owners for CI." }));
  findings.push(...collectDeletedOwnerReintroductionFindings({ requirementId: "K02-BLUEPRINT-01-SECTION-009-REQ-003", file: "scripts/audit/generated/enforcement-matrix.generated.json", domains: input.enforcementMatrixDomains, message: "Generated enforcement matrix must not revive deleted owners for CI." }));

  return findings;
};

const collectGeneratedMetadataAndRunnerFindings = (input: {
  syncSection: string[];
  auditPlan: AuditPlan;
  enforcementMatrix: EnforcementMatrix;
  auditPlanDomains: Set<string>;
  phaseGateDomains: Set<string>;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.syncSection.includes("- 不得手写 generated 文件伪造通过。")
    || !input.auditPlan.generatedAt
    || !input.enforcementMatrix.generatedAt
    || input.auditPlan.phaseGateFile !== "scripts/audit/phase-gates/phase-05-final-delivery-debug.json") {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-004", file: "scripts/audit/generated/audit-plan.generated.json", message: "Index blueprint generated artifacts must keep machine-owned metadata and phase-gate binding." }));
  }
  if (!input.syncSection.includes("- 不得让 runner 执行不在冻结基线中的独立 owner。")) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-005", message: "Index blueprint sync principle must keep the runner frozen-baseline owner ban intact." }));
  }

  const outOfBaselineOwners = [...input.auditPlanDomains].filter((domain) => !input.phaseGateDomains.has(domain));
  if (outOfBaselineOwners.length > 0) {
    findings.push(createBlueprintFinding({ lawId: "K02-BLUEPRINT-01-SECTION-009-REQ-005", file: "scripts/audit/generated/audit-plan.generated.json", message: "Generated runner audit plan must not execute owners outside the frozen baseline.", detail: outOfBaselineOwners.join(", ") }));
  }

  return findings;
};

const buildBlueprintGovernancePhases = (input: {
  childContractFindings: Finding[];
  deletedOwnerFindings: Finding[];
  generatedSyncFindings: Finding[];
}): InspectorPhase[] => [
  createPhase("blueprint-child-contract-machineization", input.childContractFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT", input.childContractFindings.length === 0, input.childContractFindings.length === 0 ? "Index blueprint child-contract table contains no unmachineized required/forbidden/READY markers." : "Index blueprint child-contract table still contains unmachineized markers."),
  createPhase("blueprint-deleted-active-owner-baseline", input.deletedOwnerFindings.length === 0 ? "PASS" : "CODE VIOLATION", input.deletedOwnerFindings.length === 0, input.deletedOwnerFindings.length === 0 ? "Index blueprint deleted active owners stay deleted and re-home only under governed current owners." : "Index blueprint deleted active owner baseline drifted or a deleted owner reappeared."),
  createPhase("blueprint-generated-sync-principles", input.generatedSyncFindings.length === 0 ? "PASS" : "CODE VIOLATION", input.generatedSyncFindings.length === 0, input.generatedSyncFindings.length === 0 ? "Index blueprint generated sync principles keep build-chain, deleted-owner, metadata, and runner-baseline boundaries intact." : "Index blueprint generated sync principles drifted away from the governed baseline."),
];

export async function runBlueprintGovernanceChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const state = await loadBlueprintGovernanceState();

  const childContractFindings = collectChildContractMachineizationFindings(state.childContractSection);
  const deletedOwnerFindings = collectDeletedOwnerBaselineFindings({
    deletedOwnerLines: state.deletedOwnerLines,
    auditPlanDomains: state.auditPlanDomains,
    enforcementMatrixDomains: state.enforcementMatrixDomains,
  });
  const generatedSyncFindings = [
    ...collectGeneratedBuildChainFindings({ syncSection: state.syncSection, packageScripts: state.packageScripts, runInspectorText: state.runInspectorText }),
    ...collectGeneratedDeletedOwnerFindings({ syncSection: state.syncSection, auditPlanDomains: state.auditPlanDomains, enforcementMatrixDomains: state.enforcementMatrixDomains }),
    ...collectGeneratedMetadataAndRunnerFindings({ syncSection: state.syncSection, auditPlan: state.auditPlan, enforcementMatrix: state.enforcementMatrix, auditPlanDomains: state.auditPlanDomains, phaseGateDomains: state.phaseGateDomains }),
  ];

  const findings = [
    ...childContractFindings,
    ...deletedOwnerFindings,
    ...generatedSyncFindings,
  ];

  return {
    findings,
    phases: buildBlueprintGovernancePhases({ childContractFindings, deletedOwnerFindings, generatedSyncFindings }),
  };
}