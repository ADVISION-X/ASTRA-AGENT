import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeResearchPlanFlow } from "./flow.js";
import type { ResearchPlanInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeResearchPlan = (task: WebsiteAgentTask, context: SharedExecutionContext, input: ResearchPlanInput) =>
  executeResearchPlanFlow(task, context, input, skill);
