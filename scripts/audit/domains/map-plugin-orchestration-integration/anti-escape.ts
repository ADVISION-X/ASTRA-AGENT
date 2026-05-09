import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { missingFiles } from "./audit-files.js";
import { INSPECTOR_PATH } from "./constants.js";
import { REQUIRED_AUDIT_FILES } from "./file-lists.js";

const RUNNER_PATH = "scripts/audit/domains/map-plugin-orchestration-integration/run-inspector.ts";

const inspectAuditSupportFiles = async (): Promise<Finding[]> => {
  const missingAuditFiles = await missingFiles(REQUIRED_AUDIT_FILES);
  return missingAuditFiles.map((filePath) =>
    createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: filePath, line: 1, severity: "fatal", message: "Integration audit support file is missing, so enforcement cannot close through the declared inspector chain." }),
  );
};

const inspectInspectorSource = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const inspectorSource = getSource(project, INSPECTOR_PATH);

  if (hasImportModuleSpecifier(inspectorSource, "create-pending-domain-inspector") || inspectorSource.getFullText().includes("pendingSummary")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: INSPECTOR_PATH, line: 1, severity: "fatal", message: "Integration inspector must not remain a pending placeholder." }));
  }

  for (const requiredCall of ["runRequiredShape", "runForbiddenShape", "runBoundaryAttack", "runAntiEscape"]) {
    if (!hasCallExpression(inspectorSource, requiredCall)) {
      findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: INSPECTOR_PATH, line: 1, severity: "fatal", message: `Integration inspector must execute ${requiredCall} as part of the governed enforcement chain.` }));
    }
  }

  return findings;
};

const inspectRunnerSource = (project: Project): Finding[] => {
  const runnerSource = getSource(project, RUNNER_PATH);
  return runnerSource.getFullText().includes('loadInspector("scripts/audit/domains/map-plugin-orchestration-integration/inspector.ts")')
    ? []
    : [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Integration runner must load the governed inspector entry directly." })];
};

const inspectManifest = (context: InspectorContext): Finding[] => {
  const manifest = context.manifestsByDomain.get("map-plugin-orchestration-integration");
  if (!manifest) {
    return [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: "scripts/audit/domains/map-plugin-orchestration-integration/manifest.json", line: 1, severity: "fatal", message: "Integration manifest must exist so audit-runner ownership can resolve." })];
  }

  return manifest.allowedLawIds.length === 0
    ? []
    : [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Integration manifest must not declare cross-domain active law ids; governance is carried through referenced law files." })];
};

export async function runAntiEscape(project: Project, context: InspectorContext): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectAuditSupportFiles()),
    ...inspectInspectorSource(project),
    ...inspectRunnerSource(project),
    ...inspectManifest(context),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      passed ? "PASS" : "FAKE ENFORCEMENT",
      passed,
      passed
        ? "Integration enforcement closes through a real inspector, complete support files, and a direct runner entry."
        : "Integration enforcement still has placeholder or owner-chain escape gaps.",
    ),
  };
}