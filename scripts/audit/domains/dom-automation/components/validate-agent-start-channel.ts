import {
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";
import {
  validatePluginRouteContract,
  validateTaskServiceChannel,
  validateVisualTaskStartIsolation,
  validateWorkbenchFacadeChannel,
} from "./validate-agent-start-channel-runtime.js";
import { validateAmazonUiChannel } from "./validate-agent-start-channel-ui.js";

export const validateAgentStartChannel = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateVisualTaskStartIsolation(auditProject),
    ...validatePluginRouteContract(auditProject),
    ...validateWorkbenchFacadeChannel(auditProject),
    ...validateAmazonUiChannel(auditProject),
    ...validateTaskServiceChannel(auditProject),
  ];

  return buildValidationResult({
    name: "agent-start-channel",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "GRASSEYE-DOM-008-V1",
      "GRASSEYE-DOM-009-V1",
      "BLUEPRINT-01",
      "BLUEPRINT-02",
      "BLUEPRINT-05",
      "BLUEPRINT-09",
      "BLUEPRINT-12",
    ],
    passSummary: "Amazon agent start channel stays on independent routes, facade seams, dedicated UI selectors, and allowlisted admin launch.",
    failSummary: "Amazon agent start channel leaks into forbidden task-start, browser-owner, or UI seams.",
  });
};
