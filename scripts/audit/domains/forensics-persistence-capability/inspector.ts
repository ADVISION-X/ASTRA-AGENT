import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { runForensicsBoundaryChecks } from "./run-forensics-boundary-checks.js";
import { runForensicsRequiredShapeChecks } from "./run-forensics-required-shape-checks.js";
import { runForensicsRuntimeChecks } from "./run-forensics-runtime-checks.js";
import { runForensicsStructuredLoggingChecks } from "./run-forensics-structured-logging-checks.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";

const {
  INSPECTOR_PATH,
  LAW_BOUNDARY,
  LAW_CHILDREN,
  LAW_CONTRACT,
  LAW_ENFORCEMENT,
  LAW_OWNER,
  LAW_RETIRED_ROOT,
  LAW_RUNTIME,
  LAW_STORAGE,
  ROOT,
  SKIP_NEGATIVE_PROOF_ENV,
  STORAGE_ADAPTER_PATH,
  STRUCTURED_LOGGING_LAW_IDS,
} = forensicsPersistenceInspectionConstants;

const createRequiredPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.every((finding) => finding.lawId !== LAW_OWNER && finding.lawId !== LAW_CHILDREN && finding.lawId !== LAW_CONTRACT);
  return createPhase(
    "required-shape",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Forensics Persistence exposes the required root, runtime modules, schemas, ports, and child topology."
      : "Forensics Persistence is missing required root, runtime modules, schemas, ports, or child topology.",
  );
};

const createForbiddenPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.every((finding) => finding.lawId !== LAW_RETIRED_ROOT && finding.lawId !== LAW_STORAGE && finding.lawId !== LAW_RUNTIME);
  return createPhase(
    "forbidden-shape",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Legacy roots, direct hash shortcuts, public barrel leaks, and wrong snapshot paths are absent."
      : "Legacy roots, direct hash shortcuts, public barrel leaks, or wrong snapshot paths still survive.",
  );
};

const createBoundaryPhase = (findings: Finding[]): InspectorPhase => {
  const passed = findings.every((finding) => finding.lawId !== LAW_BOUNDARY);
  return createPhase(
    "boundary-attack",
    passed ? "PASS" : "CODE VIOLATION",
    passed,
    passed
      ? "Forensics stays inside its persistence boundary and upstream wiring goes through governed ports."
      : "Forensics still crosses capability boundaries or upstream wiring bypasses governed ports.",
  );
};

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

const createForensicsPhases = (findings: Finding[], negativeProofPhase: InspectorPhase): InspectorPhase[] => {
  return [
    createRequiredPhase(findings),
    createForbiddenPhase(findings),
    createBoundaryPhase(findings),
    createAntiEscapePhase(findings),
    createStructuredLoggingPhase(findings),
    negativeProofPhase,
  ];
};

const runConfiguredNegativeProof = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
    ? {
        findings: [],
        phase: createPhase("negative-proof-harness", "PASS", true, "Forensics negative-proof harness was skipped for nested inspector execution."),
      }
    : runNegativeProofHarness();
};

const runForensicsExtraChecks = async () => {
  const project = createAuditProject();
  const negativeProof = await runConfiguredNegativeProof();
  const findings = [
    ...(await runForensicsRequiredShapeChecks(project)),
    ...(await runForensicsRuntimeChecks(project)),
    ...runForensicsStructuredLoggingChecks(project),
    ...runForensicsBoundaryChecks(project),
    ...negativeProof.findings,
  ];

  return {
    findings,
    phases: createForensicsPhases(findings, negativeProof.phase),
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