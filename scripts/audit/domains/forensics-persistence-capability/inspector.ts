import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { runForensicsP0Checks } from "./run-forensics-p0-checks.js";
import { runForensicsStructuredLoggingChecks } from "./run-forensics-structured-logging-checks.js";

const {
  INSPECTOR_PATH,
  LAW_ENFORCEMENT,
  ROOT,
  STORAGE_ADAPTER_PATH,
  STRUCTURED_LOGGING_LAW_IDS,
} = forensicsPersistenceInspectionConstants;

const createAntiEscapePhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.every((finding) => finding.lawId !== LAW_ENFORCEMENT);
  return createPhase(
    "anti-escape",
    passed ? "PASS" : "FAKE ENFORCEMENT",
    passed,
    passed
      ? "Forensics source and inspector are free of comment escapes, casts, dynamic imports, and test-path laundering."
      : "Forensics source or inspector still exposes comment escapes, casts, dynamic imports, or test-path laundering.",
  );
};

const createStructuredLoggingPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.every((finding) => !STRUCTURED_LOGGING_LAW_IDS.has(finding.lawId));
  return createPhase(
    "structured-debug-transparency",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Structured logging DEBUG transparency, AI I/O debug, command flow, health layering, and service exit classification are wired through Forensics-owned runtime events."
      : "Structured logging DEBUG transparency, AI I/O debug, command flow, health layering, or service exit classification is incomplete.",
  );
};

const createForensicsPhases = (p0Phases: InspectorPhase[], findings: Finding[]): InspectorPhase[] => {
  return [
    ...p0Phases,
    createAntiEscapePhase(findings),
    createStructuredLoggingPhase(findings),
  ];
};

const runForensicsExtraChecks = async (context: import("../../core/schema.js").InspectorContext) => {
  const p0Checks = await runForensicsP0Checks(context);
  const project = p0Checks.project;
  const findings = [
    ...p0Checks.findings,
    ...runForensicsStructuredLoggingChecks(project),
  ];

  return {
    findings,
    phases: createForensicsPhases(p0Checks.phases, findings),
  };
};

export const forensicsPersistenceCapabilityInspector = createPendingDomainInspector({
  inspector: "forensics-persistence-owner",
  inspectorId: "forensics-persistence-owner",
  capabilityDomain: "forensics-persistence-capability",
  inspectorEntry: INSPECTOR_PATH,
  ownedPaths: [ROOT, STORAGE_ADAPTER_PATH],
  pendingSummary: "forensics-persistence capability is not implemented",
  extraChecks: runForensicsExtraChecks,
});