import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeMaterialAcquisitionFlow } from "./flow.js";
import type { MaterialAcquisitionInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeMaterialAcquisition = (task: WebsiteAgentTask, context: SharedExecutionContext, input: MaterialAcquisitionInput) =>
  executeMaterialAcquisitionFlow(task, context, input, skill);
