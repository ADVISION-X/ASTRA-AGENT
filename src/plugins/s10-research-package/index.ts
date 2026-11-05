import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeResearchPackageFlow } from "./flow.js";
import type { ResearchPackageInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeResearchPackage = (task: WebsiteAgentTask, context: SharedExecutionContext, input: ResearchPackageInput) =>
  executeResearchPackageFlow(task, context, input, skill);
