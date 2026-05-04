import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createPhase } from "../../core/result.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { runCommanderBoundaryChecks } from "./run-commander-boundary-checks.js";
import { runCommanderChildChecks } from "./run-commander-child-checks.js";
import { runCommanderRuntimeChecks } from "./run-commander-runtime-checks.js";
import { runStartupReadinessGateChecks } from "./run-startup-readiness-gate-checks.js";
import { runCommanderStructureChecks } from "./run-commander-structure-checks.js";

const { ROOT } = commanderConsoleInspectionConstants;

const createRequiredPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "commander-required-shape",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Required Commander production shape passed: package, child modules, strict gates, proof, and harness all exist."
      : "Required Commander production shape is incomplete or structurally invalid.",
  );

const createForbiddenPhase = (input: {
  exportStarPresent: boolean;
  registryThrows: boolean;
  readGatePassthrough: boolean;
  childExecutorReceiptCount: number;
}): InspectorPhase => {
  const forbiddenPassed = !input.exportStarPresent
    && !input.registryThrows
    && !input.readGatePassthrough
    && input.childExecutorReceiptCount >= 3;

  return createPhase(
    "commander-forbidden-shape",
    forbiddenPassed ? "PASS" : "CODE VIOLATION",
    forbiddenPassed,
    forbiddenPassed ? "Forbidden residue checks passed." : "Forbidden residue still exists inside Commander surfaces.",
  );
};

const createBoundaryPhase = (boundaryViolation: boolean): InspectorPhase =>
  createPhase(
    "commander-boundary-attack",
    boundaryViolation ? "CODE VIOLATION" : "PASS",
    !boundaryViolation,
    boundaryViolation
      ? "Boundary attack checks failed: direct imports or bypass paths still exist."
      : "Boundary checks passed: shell stays render-only and startup stays bootstrap-only.",
  );

const createAntiEscapePhase = (antiEscapeViolation: boolean): InspectorPhase =>
  createPhase(
    "commander-anti-escape",
    antiEscapeViolation ? "CODE VIOLATION" : "PASS",
    !antiEscapeViolation,
    antiEscapeViolation ? "Anti-escape violations were detected inside Commander sources." : "Anti-escape checks passed.",
  );

const createStartupGatePhase = (startupGateViolation: boolean): InspectorPhase =>
  createPhase(
    "commander-startup-readiness-gate",
    startupGateViolation ? "CODE VIOLATION" : "PASS",
    !startupGateViolation,
    startupGateViolation
      ? "Startup local-AI readiness gate drifted: update/preflight, fail-closed ordering, or bootstrap boundaries are no longer enforced."
      : "Startup local-AI readiness gate remains enforced through Commander owner audit.",
  );

function createCommanderPhases(input: {
  findings: Finding[];
  exportStarPresent: boolean;
  registryThrows: boolean;
  readGatePassthrough: boolean;
  childExecutorReceiptCount: number;
  boundaryViolation: boolean;
  antiEscapeViolation: boolean;
  startupGateViolation: boolean;
}): InspectorPhase[] {
  return [
    createRequiredPhase(input.findings),
    createForbiddenPhase(input),
    createBoundaryPhase(input.boundaryViolation),
    createAntiEscapePhase(input.antiEscapeViolation),
    createStartupGatePhase(input.startupGateViolation),
  ];
}

export const commanderConsoleCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Commander Console Capability Owner Inspector",
  inspectorId: "commander-console-capability-owner",
  capabilityDomain: "commander-console-capability",
  inspectorEntry: "scripts/audit/domains/commander-console-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "commander-console-capability requires hard production enforcement for execute-only routing, child privacy, strict gates, and negative proof",
  implementedSummary: "commander-console-capability is enforced as the execute-only human command and command-facing read-console owner",
  extraChecks: async () => {
    const project = createAuditProject();
    const structure = await runCommanderStructureChecks(project);
    const childFindings = runCommanderChildChecks(project);
    const runtime = runCommanderRuntimeChecks(project);
    const boundary = await runCommanderBoundaryChecks(project);
    const startupGateFindings = await runStartupReadinessGateChecks();
    const findings: Finding[] = [...structure.findings, ...childFindings, ...runtime.findings, ...boundary.findings, ...startupGateFindings];

    return {
      findings,
      phases: createCommanderPhases({
        findings,
        exportStarPresent: structure.exportStarPresent,
        registryThrows: structure.registryThrows,
        readGatePassthrough: runtime.readGatePassthrough,
        childExecutorReceiptCount: runtime.childExecutorReceiptCount,
        boundaryViolation: boundary.boundaryViolation,
        antiEscapeViolation: boundary.antiEscapeViolation,
        startupGateViolation: startupGateFindings.length > 0,
      }),
    };
  },
});