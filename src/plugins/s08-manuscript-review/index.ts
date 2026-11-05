import { readFileSync } from "node:fs";
import type { SharedExecutionContext, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeManuscriptReviewFlow } from "./flow.js";
import type { ManuscriptReviewInput } from "./result-contract.js";

const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
export const executeManuscriptReview = (task: WebsiteAgentTask, context: SharedExecutionContext, input: ManuscriptReviewInput) =>
  executeManuscriptReviewFlow(task, context, input, skill);
