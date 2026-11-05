import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeUserDialogueFlow } from "./flow.js";
import type { UserDialogueInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeUserDialogue = (task: WebsiteAgentTask, context: SharedExecutionContext, input: UserDialogueInput) =>
  executeUserDialogueFlow(task, context, input, skill);
