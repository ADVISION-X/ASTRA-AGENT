import { resolveProductionPlugin } from "../lib/local-runtime/production/catalog.js";
import {
  WebsiteAgentTaskSchema,
  type WebsiteAgentResult,
  type WebsiteAgentTask,
} from "../lib/local-runtime/production/contracts.js";
import type { ProductPlugin, SharedExecutionContext } from "../lib/local-runtime/production/plugin.js";

export interface AuthorizedWebsiteAgentTask {
  readonly task: WebsiteAgentTask;
  readonly plugin: ProductPlugin;
  readonly skillText: string;
  readonly skillHash: `sha256:${string}`;
}

export const authorizeWebsiteAgentTask = (rawTask: unknown): AuthorizedWebsiteAgentTask => {
  const task = WebsiteAgentTaskSchema.parse(rawTask);
  const resolved = resolveProductionPlugin(task.product_id, task.action_id);
  return Object.freeze({
    task,
    plugin: resolved.plugin,
    skillText: resolved.skill_text,
    skillHash: resolved.skill_hash,
  });
};

export const dispatchWebsiteAgentTask = async (
  rawTask: unknown,
  contextFor: (authorized: AuthorizedWebsiteAgentTask) => SharedExecutionContext,
): Promise<WebsiteAgentResult> => {
  const authorized = authorizeWebsiteAgentTask(rawTask);
  return authorized.plugin.execute(authorized.task, contextFor(authorized));
};
