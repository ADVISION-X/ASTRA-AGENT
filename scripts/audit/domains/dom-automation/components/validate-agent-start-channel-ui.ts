import {
  agentChannelFinding,
  collectTemplateFragments,
  requireSourceFile,
} from "./agent-channel-support.js";
import { AMAZON_CLIENT_EVENTS_PATH, AMAZON_CLIENT_PATH, AMAZON_PAGE_PATH } from "./agent-channel-ui-paths.js";
import type { Finding } from "../../../core/schema.js";
import type { DomAutomationAuditProject } from "./dom-automation-project-types.js";

type ExpectedFragment = { token: string; message: string; hint: string };
type MissingFragmentInput = {
  lawId: string,
  filePath: string,
  fragments: string[],
  expected: readonly ExpectedFragment[],
};

const missingFragmentFinding = (
  input: MissingFragmentInput,
  item: ExpectedFragment,
): Finding[] => input.fragments.some((fragment) => fragment.includes(item.token))
  ? []
  : [agentChannelFinding(input.lawId, input.filePath, 1, item.message, item.hint)];

const collectMissingFragmentFindings = (input: MissingFragmentInput): Finding[] =>
  input.expected.flatMap((item) => missingFragmentFinding(input, item));

const collectAmazonPageFindings = (fragments: string[]): Finding[] => [
  ...collectMissingFragmentFindings({ lawId: "GRASSEYE-DOM-008-V1", filePath: AMAZON_PAGE_PATH, fragments, expected: [
    { token: "data-amazon-admin-open-form", message: "Amazon page is missing data-amazon-admin-open-form", hint: "Keep the admin open action on a dedicated form selector." },
    { token: "data-amazon-invoice-upload-form", message: "Amazon page is missing data-amazon-invoice-upload-form", hint: "Keep the phase-one mission start on a dedicated form selector." },
  ] }),
  ...(fragments.some((fragment) => fragment.includes("data-start-mission-form"))
    ? [agentChannelFinding("GRASSEYE-DOM-008-V1", AMAZON_PAGE_PATH, 1, "Amazon page reuses data-start-mission-form from the visual mission start page", "Do not mix the Amazon channel into the visual mission form chain.")]
    : []),
];

const collectAmazonClientFindings = (fragments: string[]): Finding[] => collectMissingFragmentFindings({
  lawId: "GRASSEYE-DOM-008-V1",
  filePath: AMAZON_CLIENT_PATH,
  fragments,
  expected: [
    { token: "/api/plugins/amazon-invoice-upload/open-admin", message: "commander shell client is missing Amazon endpoint binding: /api/plugins/amazon-invoice-upload/open-admin", hint: "Post Amazon form submissions to the dedicated plugin endpoints." },
    { token: "/api/plugins/amazon-invoice-upload/start", message: "commander shell client is missing Amazon endpoint binding: /api/plugins/amazon-invoice-upload/start", hint: "Post Amazon form submissions to the dedicated plugin endpoints." },
  ],
});

const collectAmazonEventFindings = (fragments: string[]): Finding[] => collectMissingFragmentFindings({
  lawId: "GRASSEYE-DOM-008-V1",
  filePath: AMAZON_CLIENT_EVENTS_PATH,
  fragments,
  expected: [
    { token: "[data-amazon-admin-open-form]", message: "commander shell events are missing Amazon selector binding: [data-amazon-admin-open-form]", hint: "Bind Amazon form submission with dedicated selectors instead of the visual mission form." },
    { token: "[data-amazon-invoice-upload-form]", message: "commander shell events are missing Amazon selector binding: [data-amazon-invoice-upload-form]", hint: "Bind Amazon form submission with dedicated selectors instead of the visual mission form." },
  ],
});

export const validateAmazonUiChannel = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const amazonPageOrFinding = requireSourceFile(auditProject, AMAZON_PAGE_PATH, "GRASSEYE-DOM-008-V1", "Restore the dedicated Amazon invoice upload page in the local app shell.");
  if ("severity" in amazonPageOrFinding) {
    findings.push(amazonPageOrFinding);
  } else {
    findings.push(...collectAmazonPageFindings(collectTemplateFragments(amazonPageOrFinding)));
  }

  const clientSourceOrFinding = requireSourceFile(auditProject, AMAZON_CLIENT_PATH, "GRASSEYE-DOM-008-V1", "Restore the commander shell client bindings for the Amazon page.");
  if ("severity" in clientSourceOrFinding) {
    findings.push(clientSourceOrFinding);
  } else {
    findings.push(...collectAmazonClientFindings(collectTemplateFragments(clientSourceOrFinding)));
  }

  const eventsSourceOrFinding = requireSourceFile(auditProject, AMAZON_CLIENT_EVENTS_PATH, "GRASSEYE-DOM-008-V1", "Restore the commander shell event bindings for the Amazon page.");
  if ("severity" in eventsSourceOrFinding) {
    findings.push(eventsSourceOrFinding);
  } else {
    findings.push(...collectAmazonEventFindings(collectTemplateFragments(eventsSourceOrFinding)));
  }
  return findings;
};
