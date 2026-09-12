import {
  assertProductRouteSupported,
  dispatchProductPlugin,
} from "./product-plugin-catalog.js";
import type {
  ProductCompletionReceipt,
  ProductDispatchContext,
  WebsiteAgentTask,
} from "./product-plugin-contract.js";

export interface AuthorizedWebsiteAgentTask {
  readonly task: WebsiteAgentTask;
}

export const authorizeWebsiteAgentTask = (task: WebsiteAgentTask): AuthorizedWebsiteAgentTask => {
  assertProductRouteSupported(task.product_id, task.action_id);
  return Object.freeze({ task });
};

export const dispatchWebsiteAgentTask = async (
  task: WebsiteAgentTask,
  contextFor: (authorized: AuthorizedWebsiteAgentTask) => ProductDispatchContext,
): Promise<ProductCompletionReceipt> => {
  const authorized = authorizeWebsiteAgentTask(task);
  return dispatchProductPlugin(authorized.task, contextFor(authorized));
};
