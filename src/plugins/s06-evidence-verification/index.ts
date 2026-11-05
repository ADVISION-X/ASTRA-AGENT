import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeEvidenceVerificationFlow } from "./flow.js";
import type { EvidenceVerificationInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeEvidenceVerification = (task: WebsiteAgentTask, context: SharedExecutionContext, input: EvidenceVerificationInput) =>
  executeEvidenceVerificationFlow(task, context, input, skill);
