import type { Project } from "ts-morph";

import { hasCallExpression } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";

export const TASK_API_HANDLERS = "src/app/task-api-handlers.ts";
export const TASK_START_API_HANDLER = "src/app/task-start-api-handler.ts";
export const TASK_START_FLOW = "src/lib/local-app-shell/task-start-flow.ts";
export const TASK_START_BINDING = "src/lib/local-app-shell/task-start-binding.ts";

export function hasTaskStartDelegation(project: Project): boolean {
  const taskApiSource = getSource(project, TASK_API_HANDLERS);
  const taskStartApiHandlerSource = getSource(project, TASK_START_API_HANDLER);
  return hasCallExpression(taskApiSource, "handleTaskStartRequest")
    && hasCallExpression(taskStartApiHandlerSource, "runTaskStartFlow");
}

export function hasGovernedTaskStartBindingResolution(project: Project): boolean {
  const taskStartFlowSource = getSource(project, TASK_START_FLOW);
  const taskStartBindingSource = getSource(project, TASK_START_BINDING);
  return hasCallExpression(taskStartFlowSource, "resolveMissionStartBinding")
    && hasCallExpression(taskStartBindingSource, "getDefaultMapPluginRegistry");
}