import { deepResearchClientAttachmentFunctions } from "./workbench-deep-research-client-attachments.js";
import { deepResearchClientBootFunctions } from "./workbench-deep-research-client-boot.js";
import { deepResearchClientDeliverySectionFunctions } from "./workbench-deep-research-client-delivery-sections.js";
import { deepResearchClientReportFunctions } from "./workbench-deep-research-client-report-sections.js";
import { deepResearchClientSharedFunctions } from "./workbench-deep-research-client-shared.js";

const DEEP_RESEARCH_CLIENT_FUNCTIONS = [
  ...deepResearchClientSharedFunctions,
  ...deepResearchClientDeliverySectionFunctions,
  ...deepResearchClientReportFunctions,
  ...deepResearchClientAttachmentFunctions,
  ...deepResearchClientBootFunctions,
] as const;

export const renderWorkbenchDeepResearchClient = (): string => [
  "const __name = (target) => target;",
  ...DEEP_RESEARCH_CLIENT_FUNCTIONS.map((fn) => `${fn.toString()};`),
  "bootWorkbenchDeepResearchClient();",
].join("\n");
