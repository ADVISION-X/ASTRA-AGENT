import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeManuscriptAuthoringFlow } from "./flow.js";
import type { ManuscriptAuthoringInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeManuscriptAuthoring = (task: WebsiteAgentTask, context: SharedExecutionContext, input: ManuscriptAuthoringInput) =>
  executeManuscriptAuthoringFlow(task, context, input, skill);
