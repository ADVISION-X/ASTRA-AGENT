import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeEvidenceProcessingFlow } from "./flow.js";
import type { EvidenceProcessingInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeEvidenceProcessing = (task: WebsiteAgentTask, context: SharedExecutionContext, input: EvidenceProcessingInput) =>
  executeEvidenceProcessingFlow(task, context, input, skill);
