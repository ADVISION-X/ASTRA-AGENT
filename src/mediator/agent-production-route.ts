import {
  dispatchProductPlugin,
  resolveProductPluginIdentity,
  type ProductPluginIdentity,
} from "./product-plugin-catalog.js";
import type {
  ProductCompletionReceipt,
  ProductDispatchContext,
  WebsiteAgentTask,
} from "./product-plugin-contract.js";

export interface AuthorizedWebsiteAgentTask {
  readonly task: WebsiteAgentTask;
  readonly identity: ProductPluginIdentity;
}

export const authorizeWebsiteAgentTask = (task: WebsiteAgentTask): AuthorizedWebsiteAgentTask => {
  const identity = resolveProductPluginIdentity(task.product_id, task.action_id);
  return Object.freeze({
    task,
    identity,
  });
};

export const dispatchWebsiteAgentTask = async (
  task: WebsiteAgentTask,
  contextFor: (authorized: AuthorizedWebsiteAgentTask) => ProductDispatchContext,
): Promise<ProductCompletionReceipt> => {
  const authorized = authorizeWebsiteAgentTask(task);
  return dispatchProductPlugin(authorized.task, contextFor(authorized));
};
