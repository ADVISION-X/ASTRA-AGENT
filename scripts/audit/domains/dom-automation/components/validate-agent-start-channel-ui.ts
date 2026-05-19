import {
  AMAZON_CLIENT_EVENTS_PATH,
  AMAZON_CLIENT_PATH,
  AMAZON_PAGE_PATH,
  agentChannelFinding,
  collectTemplateFragments,
  requireSourceFile,
} from "./agent-channel-support.js";
import type { Finding } from "../../../core/schema.js";
import type { DomAutomationAuditProject } from "./collect-dom-automation-project.js";

export const validateAmazonUiChannel = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const amazonPageOrFinding = requireSourceFile(auditProject, AMAZON_PAGE_PATH, "GRASSEYE-DOM-008-V1", "Restore the dedicated Amazon invoice upload page in the local app shell.");
  if ("severity" in amazonPageOrFinding) {
    findings.push(amazonPageOrFinding);
  } else {
    const fragments = collectTemplateFragments(amazonPageOrFinding);
    if (!fragments.some((fragment) => fragment.includes("data-amazon-admin-open-form"))) {
      findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_PAGE_PATH, 1, "Amazon page is missing data-amazon-admin-open-form", "Keep the admin open action on a dedicated form selector."));
    }
    if (!fragments.some((fragment) => fragment.includes("data-amazon-invoice-upload-form"))) {
      findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_PAGE_PATH, 1, "Amazon page is missing data-amazon-invoice-upload-form", "Keep the phase-one mission start on a dedicated form selector."));
    }
    if (fragments.some((fragment) => fragment.includes("data-start-mission-form"))) {
      findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_PAGE_PATH, 1, "Amazon page reuses data-start-mission-form from the visual mission start page", "Do not mix the Amazon channel into the visual mission form chain."));
    }
  }

  const clientSourceOrFinding = requireSourceFile(auditProject, AMAZON_CLIENT_PATH, "GRASSEYE-DOM-008-V1", "Restore the commander shell client bindings for the Amazon page.");
  if ("severity" in clientSourceOrFinding) {
    findings.push(clientSourceOrFinding);
  } else {
    const fragments = collectTemplateFragments(clientSourceOrFinding);
    for (const endpoint of ["/api/plugins/amazon-invoice-upload/open-admin", "/api/plugins/amazon-invoice-upload/start"]) {
      if (!fragments.some((fragment) => fragment.includes(endpoint))) {
        findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_CLIENT_PATH, 1, `commander shell client is missing Amazon endpoint binding: ${endpoint}`, "Post Amazon form submissions to the dedicated plugin endpoints."));
      }
    }
  }

  const eventsSourceOrFinding = requireSourceFile(auditProject, AMAZON_CLIENT_EVENTS_PATH, "GRASSEYE-DOM-008-V1", "Restore the commander shell event bindings for the Amazon page.");
  if ("severity" in eventsSourceOrFinding) {
    findings.push(eventsSourceOrFinding);
  } else {
    const fragments = collectTemplateFragments(eventsSourceOrFinding);
    for (const selector of ["[data-amazon-admin-open-form]", "[data-amazon-invoice-upload-form]"]) {
      if (!fragments.some((fragment) => fragment.includes(selector))) {
        findings.push(agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_CLIENT_EVENTS_PATH, 1, `commander shell events are missing Amazon selector binding: ${selector}`, "Bind Amazon form submission with dedicated selectors instead of the visual mission form."));
      }
    }
  }
  return findings;
};
