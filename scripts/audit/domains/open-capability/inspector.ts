import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { runOpenEnforcementCoverage } from "./enforcement-coverage.js";
import { runOpenBoundaryChecks } from "./run-open-boundary-checks.js";
import { runOpenExternalBoundaryChecks } from "./run-open-external-boundary-checks.js";
import { runOpenRequiredShapeChecks } from "./run-open-required-shape-checks.js";
import { runOpenRuntimeChecks } from "./run-open-runtime-checks.js";

const {
  INSPECTOR_ENTRY,
  OPEN_ROOT,
} = openInspectionConstants;

const createRequiredPhase = (input: { findings: Finding[]; openRootBound: boolean }): InspectorPhase => {
  const passed = input.openRootBound && input.findings.length === 0;
  return createPhase(
    "open-required-shape-attack",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Open standard package shape, metadata registry, child-local contracts, and negative proof harness are present."
      : "Open required shape is incomplete.",
  );
};

const createForbiddenPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(
    "open-forbidden-shape-attack",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Open forbids fake allow decisions, fake target profiles, export-star barrels, forbidden imports, and cookie access."
      : "Open still contains forbidden execution or export shapes.",
  );
};

const createBoundaryPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(
    "open-boundary-attack",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Open child implementations stay private and workbench wiring stays on the public surface."
      : "Open boundary leaks private children or runtime internals.",
  );
};

const createAntiEscapePhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(
    "open-anti-escape-attack",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Open avoids any, unknown-as, comment directives, dynamic import, require, and unmanaged time APIs."
      : "Open still contains anti-escape violations.",
  );
};

const runOpenExtraChecks = async (context: import("../../core/schema.js").InspectorContext) => {
  const project = createAuditProject();
  const requiredShape = await runOpenRequiredShapeChecks(project);
  const runtimeFindings = runOpenRuntimeChecks(project);
  const boundary = runOpenBoundaryChecks(project);
  const { platformBoundary, browserBoundary } = await runOpenExternalBoundaryChecks();
  const enforcementCoverage = await runOpenEnforcementCoverage(context);
  const findings = [
    ...requiredShape.findings,
    ...runtimeFindings,
    ...boundary.boundaryFindings,
    ...boundary.antiEscapeFindings,
    ...platformBoundary.findings,
    ...browserBoundary.findings,
    ...enforcementCoverage.findings,
  ];

  return {
    findings,
    phases: [
      createRequiredPhase(requiredShape),
      createForbiddenPhase(runtimeFindings),
      createBoundaryPhase(boundary.boundaryFindings),
      createAntiEscapePhase(boundary.antiEscapeFindings),
      ...platformBoundary.phases,
      ...browserBoundary.phases,
      enforcementCoverage.phase,
    ],
  };
};

export const openCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Open Capability Owner Inspector",
  inspectorId: "open-capability-owner",
  capabilityDomain: "open-capability",
  inspectorEntry: INSPECTOR_ENTRY,
  ownedPaths: [OPEN_ROOT],
  pendingSummary: "open-capability must close through the owner inspector, standard package, and negative proof harness",
  implementedSummary: "open-capability exposes one governed package with metadata registry, runtime gates, child-local contracts, and negative proof enforcement",
  extraChecks: runOpenExtraChecks,
});