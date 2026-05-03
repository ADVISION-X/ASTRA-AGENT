import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import {
  INSPECTOR_PATH,
  MAP_PLUGIN_ACTIVE_LAW_IDS,
  MAP_PLUGIN_LAW_FILE,
  MAP_PLUGIN_LAWS,
  MAP_PLUGIN_REQUIRED_ENFORCEMENT_MODE,
  MAP_PLUGIN_REQUIRED_EVIDENCE_MODE,
  MAP_PLUGIN_REQUIRED_TIER,
} from "./constants.js";
import { REQUIRED_AUDIT_FILES } from "./file-lists.js";

const RUNNER_PATH = "scripts/audit/domains/map-plugin-package/run-inspector.ts";
const AUDIT_PLAN_PATH = "scripts/audit/generated/audit-plan.generated.json";
const ENFORCEMENT_MATRIX_PATH = "scripts/audit/generated/enforcement-matrix.generated.json";

const createEnforcementFinding = (file: string, line: number, message: string): Finding =>
  createFinding({ lawId: MAP_PLUGIN_LAWS.ENFORCEMENT, file, line, severity: "fatal", message });

const hasExactLawSet = (lawIds: readonly string[]): boolean =>
  lawIds.length === MAP_PLUGIN_ACTIVE_LAW_IDS.length && MAP_PLUGIN_ACTIVE_LAW_IDS.every((lawId) => lawIds.includes(lawId));

const inspectAuditFilePresence = async (): Promise<Finding[]> => {
  const missingAuditFiles = await missingFiles(REQUIRED_AUDIT_FILES);
  return missingAuditFiles.map((filePath) =>
    createEnforcementFinding(filePath, 1, "Map package audit support file is missing, so enforcement cannot close through the declared inspector chain."),
  );
};

const inspectInspectorSource = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const inspectorSource = getSource(project, INSPECTOR_PATH);

  if (hasImportModuleSpecifier(inspectorSource, "create-pending-domain-inspector") || inspectorSource.getFullText().includes("pendingSummary")) {
    findings.push(createEnforcementFinding(INSPECTOR_PATH, 1, "Map package inspector must not remain a pending placeholder once the domain is active."));
  }

  for (const requiredCall of ["runRequiredShape", "runForbiddenShape", "runBoundaryAttack", "runAntiEscape", "runNegativeProofHarness", "runScorecardGate"]) {
    if (!hasCallExpression(inspectorSource, requiredCall)) {
      findings.push(createEnforcementFinding(INSPECTOR_PATH, 1, `Map package inspector must execute ${requiredCall} as part of the governed enforcement chain.`));
    }
  }

  return findings;
};

const inspectRunnerSource = (project: Project): Finding[] => {
  const runnerSource = getSource(project, RUNNER_PATH);
  return runnerSource.getFullText().includes('loadInspector("scripts/audit/domains/map-plugin-package/inspector.ts")')
    ? []
    : [createEnforcementFinding(RUNNER_PATH, 1, "Map package runner must load the governed inspector entry directly.")];
};

const inspectManifestShape = (context: InspectorContext): Finding[] => {
  const manifest = context.manifestsByDomain.get("map-plugin-package");
  if (!manifest) {
    return [createEnforcementFinding("scripts/audit/domains/map-plugin-package/manifest.json", 1, "Map package manifest must exist so audit runner ownership can resolve.")];
  }

  return hasExactLawSet(manifest.allowedLawIds)
    ? []
    : [createEnforcementFinding(manifest.manifestPath, 1, "Map package manifest must declare the exact active map-plugin governance set.")];
};

const inspectLawRegistryStrength = (context: InspectorContext): Finding[] => {
  const activeLaws = context.lawRegistry.laws.filter((law) => law.capabilityDomain === "map-plugin-package" && law.status === "active");
  const findings: Finding[] = [];
  const recordsById = new Map(activeLaws.map((law) => [law.lawId, law]));

  if (!hasExactLawSet(activeLaws.map((law) => law.lawId))) {
    findings.push(createEnforcementFinding(MAP_PLUGIN_LAW_FILE, 1, "Generated law registry must include the full active map-plugin law set."));
  }

  for (const lawId of MAP_PLUGIN_ACTIVE_LAW_IDS) {
    const record = recordsById.get(lawId);
    if (!record) {
      continue;
    }
    if (record.tier !== MAP_PLUGIN_REQUIRED_TIER) {
      findings.push(createEnforcementFinding(record.relativeFilePath, record.line, `${lawId} must remain tier ${MAP_PLUGIN_REQUIRED_TIER}.`));
    }
    if (record.enforcementMode !== MAP_PLUGIN_REQUIRED_ENFORCEMENT_MODE) {
      findings.push(createEnforcementFinding(record.relativeFilePath, record.line, `${lawId} must remain ${MAP_PLUGIN_REQUIRED_ENFORCEMENT_MODE}.`));
    }
    if (record.evidenceMode !== MAP_PLUGIN_REQUIRED_EVIDENCE_MODE) {
      findings.push(createEnforcementFinding(record.relativeFilePath, record.line, `${lawId} must remain ${MAP_PLUGIN_REQUIRED_EVIDENCE_MODE}.`));
    }
  }

  return findings;
};

const inspectGeneratedOwnerCoverage = (context: InspectorContext): Finding[] => {
  const findings: Finding[] = [];
  const matrixOwner = context.matrixOwnersByDomain.get("map-plugin-package");
  if (!matrixOwner) {
    findings.push(createEnforcementFinding(ENFORCEMENT_MATRIX_PATH, 1, "Generated enforcement matrix must include map-plugin-package owner coverage."));
  } else if (!hasExactLawSet(matrixOwner.lawIds)) {
    findings.push(createEnforcementFinding(ENFORCEMENT_MATRIX_PATH, 1, "Generated enforcement matrix must declare the exact active map-plugin law set."));
  }

  const planOwner = context.planOwnersByDomain.get("map-plugin-package");
  if (!planOwner) {
    findings.push(createEnforcementFinding(AUDIT_PLAN_PATH, 1, "Generated audit plan must include map-plugin-package runner participation."));
  } else if (!hasExactLawSet(planOwner.lawIds)) {
    findings.push(createEnforcementFinding(AUDIT_PLAN_PATH, 1, "Generated audit plan must declare the exact active map-plugin law set."));
  }

  if (!context.phaseGate.activeCapabilityDomains.includes("map-plugin-package")) {
    findings.push(createEnforcementFinding(context.auditPlan.phaseGateFile, 1, "Current phase gate must keep map-plugin-package active."));
  }

  return findings;
};

export async function runAntiEscape(
  project: Project,
  context: InspectorContext,
): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectAuditFilePresence()),
    ...inspectInspectorSource(project),
    ...inspectRunnerSource(project),
    ...inspectManifestShape(context),
    ...inspectLawRegistryStrength(context),
    ...inspectGeneratedOwnerCoverage(context),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      passed ? "PASS" : "FAKE ENFORCEMENT",
      passed,
      passed
        ? "Map package enforcement closes through a real inspector, full audit support files, and a direct runner entry."
        : "Map package enforcement still has placeholder or owner-chain escape gaps.",
    ),
  };
}
