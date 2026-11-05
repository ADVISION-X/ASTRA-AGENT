import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeSubtopicResearchFlow } from "./flow.js";
import type { SubtopicResearchInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeSubtopicResearch = (task: WebsiteAgentTask, context: SharedExecutionContext, input: SubtopicResearchInput) =>
  executeSubtopicResearchFlow(task, context, input, skill);
