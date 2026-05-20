import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject, DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { hasIdentifierCall } from "./dom-automation-static-strings.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";
import { hasPropertyAccess, hasStringLiteral } from "./runtime-contract-support.js";

const phaseFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

type PhaseCoverageFiles = {
  flowFile: NonNullable<ReturnType<typeof getSourceFileAtRepoPath>>;
  flowSupportFile: NonNullable<ReturnType<typeof getSourceFileAtRepoPath>>;
  uploadFile: NonNullable<ReturnType<typeof getSourceFileAtRepoPath>>;
  domSmokeFile: NonNullable<ReturnType<typeof getSourceFileAtRepoPath>>;
};

const loadPhaseCoverageFiles = (auditProject: DomAutomationAuditProject): PhaseCoverageFiles | null => {
  const flowFile = getSourceFileAtRepoPath(auditProject.project, "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts");
  const flowSupportFile = getSourceFileAtRepoPath(auditProject.project, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts");
  const uploadFile = getSourceFileAtRepoPath(auditProject.project, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const domSmokeFile = getSourceFileAtRepoPath(auditProject.project, "scripts/acceptance/dom-automation-smoke.ts");
  return flowFile && flowSupportFile && uploadFile && domSmokeFile
    ? { flowFile, flowSupportFile, uploadFile, domSmokeFile }
    : null;
};

const collectPhaseCoverageFindings = (files: PhaseCoverageFiles): Finding[] => {
  const findings: Finding[] = [];
  if (!hasStringLiteral(files.flowFile, "review_required")) {
    findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon flow is missing review_required gates", "Keep login, 2FA, ambiguity, and human-final-submit states gated by review_required."));
  }
  if (!hasIdentifierCall(files.flowFile, "uploadApprovedFileOnce")) {
    findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon complete flow does not call uploadApprovedFileOnce", "Full upload closure must use the governed DOM upload ability."));
  }
  if (hasStringLiteral(files.uploadFile, "not_implemented")) {
    findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", 1, "DOM upload still exposes not_implemented", "Complete closure requires a real BrowserController file-input upload call."));
  }
  if (!hasPropertyAccess(files.uploadFile, "browser", "setFileInputFiles")) {
    findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", 1, "DOM upload does not call BrowserController.setFileInputFiles", "Set approved PDFs through the governed browser controller upload port."));
  }
  if (!hasIdentifierCall(files.domSmokeFile, "uploadApprovedFileOnce")) {
    findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "scripts/acceptance/dom-automation-smoke.ts", 1, "DOM smoke does not exercise real upload", "Use DOM smoke to prove the governed upload ability."));
  }
  for (const phaseOneCall of ["readDomSnapshotOnce", "locateDomElementOnce", "verifyDomStateOnce"]) {
    if (!hasIdentifierCall(files.flowFile, phaseOneCall) && !hasIdentifierCall(files.flowSupportFile, phaseOneCall)) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, `Amazon flow is missing required call: ${phaseOneCall}`, "Keep search, locate, verify, upload, submit, and success verification active."));
    }
  }
  return findings;
};

const validatePhaseCoverage = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const files = loadPhaseCoverageFiles(auditProject);
  const findings = files
    ? collectPhaseCoverageFindings(files)
    : [phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "phase-coverage inputs are missing", "Restore plugin flow, upload runtime, and DOM smoke files before phase validation.")];

  return buildValidationResult({
    name: "phase-coverage",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-006-V1",
      "GRASSEYE-DOM-009-V1",
      "BLUEPRINT-09",
      "BLUEPRINT-11",
    ],
    passSummary: "complete Amazon invoice upload flow uses governed DOM search, upload, submit, and review gates.",
    failSummary: "phase coverage drifts from the blueprint or law-mandated review gates.",
  });
};
