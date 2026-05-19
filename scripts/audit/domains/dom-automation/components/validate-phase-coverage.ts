import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  hasIdentifierCall,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

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
  const uploadFile = getSourceFileAtRepoPath(auditProject.project, "src/capabilities/dom-automation/runtime/dom-upload.ts");
  const domSmokeFile = getSourceFileAtRepoPath(auditProject.project, "scripts/acceptance/dom-automation-smoke.ts");

  if (!flowFile || !uploadFile || !domSmokeFile) {
    findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "phase-coverage inputs are missing", "Restore plugin flow, upload runtime, and DOM smoke files before phase validation."));
  } else {
    const flowText = flowFile.getFullText();
    if (!flowText.includes('status: "review_required"')) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon phase one does not stop in review_required", "Phase one must stop at the review-required upload-entry boundary."));
    }
    if (hasIdentifierCall(flowFile, "uploadApprovedFileOnce")) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, "Amazon phase one already performs upload instead of governed pending stop", "Keep phase one at the review-required boundary until phase two is explicitly implemented."));
    }
    const uploadText = uploadFile.getFullText();
    if (!uploadText.includes('status: "not_implemented"') && !uploadText.includes('status: "review_required"')) {
      findings.push(phaseFinding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", 1, "Phase-four upload runtime is neither implemented nor explicitly pending-governed", "Return not_implemented or review_required until real file-input upload exists."));
    }
    if (!hasIdentifierCall(domSmokeFile, "uploadApprovedFileOnce")) {
      findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "scripts/acceptance/dom-automation-smoke.ts", 1, "DOM smoke does not exercise the phase-four upload boundary", "Use DOM smoke to prove the pending-governed upload boundary."));
    }
    for (const phaseOneCall of ["readDomSnapshotOnce", "locateDomElementOnce", "verifyDomStateOnce"]) {
      if (!hasIdentifierCall(flowFile, phaseOneCall)) {
        findings.push(phaseFinding("GRASSEYE-DOM-009-V1", "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts", 1, `Amazon phase one is missing required phase call: ${phaseOneCall}`, "Keep phase one active through snapshot, locate, and verify execution."));
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
    passSummary: "phase 1-3 are active and phase 4-5 stay governed pending behind review-required or not_implemented boundaries.",
    failSummary: "phase coverage drifts from the blueprint or law-mandated review gates.",
  });
};