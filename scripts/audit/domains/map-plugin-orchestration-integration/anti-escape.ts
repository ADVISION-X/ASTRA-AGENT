import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";
import { INSPECTOR_PATH, REQUIRED_AUDIT_FILES, getSource, missingFiles } from "./ast-utils.js";

const RUNNER_PATH = "scripts/audit/domains/map-plugin-orchestration-integration/run-inspector.ts";

export async function runAntiEscape(project: Project, context: InspectorContext): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];

  for (const filePath of await missingFiles(REQUIRED_AUDIT_FILES)) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: filePath,
      line: 1,
      severity: "fatal",
      message: "Integration audit support file is missing, so enforcement cannot close through the declared inspector chain.",
    }));
  }

  const inspectorSource = getSource(project, INSPECTOR_PATH);
  if (hasImportModuleSpecifier(inspectorSource, "create-pending-domain-inspector") || inspectorSource.getFullText().includes("pendingSummary")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: INSPECTOR_PATH,
      line: 1,
      severity: "fatal",
      message: "Integration inspector must not remain a pending placeholder.",
    }));
  }

  for (const requiredCall of ["runRequiredShape", "runForbiddenShape", "runBoundaryAttack", "runAntiEscape", "runNegativeProofHarness"]) {
    if (!hasCallExpression(inspectorSource, requiredCall)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
        file: INSPECTOR_PATH,
        line: 1,
        severity: "fatal",
        message: `Integration inspector must execute ${requiredCall} as part of the governed enforcement chain.`,
      }));
    }
  }

  const runnerSource = getSource(project, RUNNER_PATH);
  if (!runnerSource.getFullText().includes('loadInspector("scripts/audit/domains/map-plugin-orchestration-integration/inspector.ts")')) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: RUNNER_PATH,
      line: 1,
      severity: "fatal",
      message: "Integration runner must load the governed inspector entry directly.",
    }));
  }

  const manifest = context.manifestsByDomain.get("map-plugin-orchestration-integration");
  if (!manifest) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: "scripts/audit/domains/map-plugin-orchestration-integration/manifest.json",
      line: 1,
      severity: "fatal",
      message: "Integration manifest must exist so audit-runner ownership can resolve.",
    }));
  } else if (manifest.allowedLawIds.length !== 0) {
    findings.push(createFinding({
      lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
      file: manifest.manifestPath,
      line: 1,
      severity: "fatal",
      message: "Integration manifest must not declare cross-domain active law ids; governance is carried through referenced law files.",
    }));
  }

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