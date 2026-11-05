import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeResearchBriefFlow } from "./flow.js";
import type { ResearchBriefInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeResearchBrief = (task: WebsiteAgentTask, context: SharedExecutionContext, input: ResearchBriefInput) =>
  executeResearchBriefFlow(task, context, input, skill);
