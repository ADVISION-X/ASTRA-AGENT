import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  hasIdentifierCall,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";
import { hasPropertyAccess, hasStringLiteral } from "./runtime-contract-support.js";

const phaseFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file,
  line,
  severity: "fatal",
  message,
  hint,
});

export const validatePhaseCoverage = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings: Finding[] = [];
  const flowFile = getSourceFileAtRepoPath(auditProject.project, "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts");
  const flowSupportFile = getSourceFileAtRepoPath(auditProject.project, "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts");
  const uploadFile = getSourceFileAtRepoPath(auditProject.project, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const domSmokeFile = getSourceFileAtRepoPath(auditProject.project, "scripts/acceptance/dom-automation-smoke.ts");

  if (!flowFile || !flowSupportFile || !uploadFile || !domSmokeFile) {
    findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "phase-coverage inputs are missing", "Restore plugin flow, upload runtime, and DOM smoke files before phase validation."));
  } else {
    if (!hasStringLiteral(flowFile, "review_required")) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon flow is missing review_required gates", "Keep login, 2FA, ambiguity, and human-final-submit states gated by review_required."));
    }
    if (!hasIdentifierCall(flowFile, "uploadApprovedFileOnce")) {
      findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon complete flow does not call uploadApprovedFileOnce", "Full upload closure must use the governed DOM upload ability."));
    }
    if (hasStringLiteral(uploadFile, "not_implemented")) {
      findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", 1, "DOM upload still exposes not_implemented", "Complete closure requires a real BrowserController file-input upload call."));
    }
    if (!hasPropertyAccess(uploadFile, "browser", "setFileInputFiles")) {
      findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", 1, "DOM upload does not call BrowserController.setFileInputFiles", "Set approved PDFs through the governed browser controller upload port."));
    }
    if (!hasIdentifierCall(domSmokeFile, "uploadApprovedFileOnce")) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "scripts/acceptance/dom-automation-smoke.ts", 1, "DOM smoke does not exercise real upload", "Use DOM smoke to prove the governed upload ability."));
    }
    for (const phaseOneCall of ["readDomSnapshotOnce", "locateDomElementOnce", "verifyDomStateOnce"]) {
      if (!hasIdentifierCall(flowFile, phaseOneCall) && !hasIdentifierCall(flowSupportFile, phaseOneCall)) {
        findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, `Amazon flow is missing required call: ${phaseOneCall}`, "Keep search, locate, verify, upload, submit, and success verification active."));
      }
    }
  }

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
