import {
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";
import {
  domLocatorFindings,
  domSnapshotFindings,
} from "./validate-runtime-contracts-basic.js";
import {
  domClickFindings,
  domFillFindings,
  domUploadFindings,
} from "./validate-runtime-contracts-actions.js";
import {
  domVerifyFindings,
  domWaitFindings,
} from "./validate-runtime-contracts-states.js";

export const validateRuntimeContracts = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...domSnapshotFindings(auditProject),
    ...domLocatorFindings(auditProject),
    ...domFillFindings(auditProject),
    ...domClickFindings(auditProject),
    ...domUploadFindings(auditProject),
    ...domVerifyFindings(auditProject),
    ...domWaitFindings(auditProject),
  ];

  return buildValidationResult({
    name: "runtime-contracts",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-002-V1",
      "GRASSEYE-DOM-003-V1",
      "GRASSEYE-DOM-004-V1",
      "GRASSEYE-DOM-005-V1",
      "GRASSEYE-DOM-006-V1",
      "GRASSEYE-DOM-007-V1",
      "BLUEPRINT-04",
    ],
    passSummary: "DOM runtime files enforce schema-validated inputs, governed outputs, evidence refs, and bounded wait behavior.",
    failSummary: "DOM runtime contracts are incomplete or drift from the law.",
  });
};
