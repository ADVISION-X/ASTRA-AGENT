import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { createOwnedExecution, markerFor, promptFor, receive, runFreshTurn } from "./product-turn.js";

const validate = (task: WebsiteAgentTask, context: SharedExecutionContext): void => {
  if (task.product_id !== "bazi_report_followup") {
    throw executionFailure("failed", "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  }
  if (context.routePolicy.relation_kind === "review") return;
  const roles = context.materials.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => item.role);
  if (context.routePolicy.relation_kind !== "followup" || task.action_id !== "followup"
    || !task.parent_task_ref || !task.parent_result_ref || !task.parent_result_hash
    || roles.join("\0") !== ["bazi_input_bundle", "result_contract"].join("\0")) {
    throw executionFailure("failed", "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  }
};

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  validate(task, context);
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const checkpoint = await runFreshTurn(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
