import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeOriginalityCitationCheckFlow } from "./flow.js";
import type { OriginalityCitationCheckInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeOriginalityCitationCheck = (task: WebsiteAgentTask, context: SharedExecutionContext, input: OriginalityCitationCheckInput) =>
  executeOriginalityCitationCheckFlow(task, context, input, skill);
