import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { createOwnedExecution, markerFor, promptFor, receive, runConsultationTurn, runReviewTurn } from "./product-turn.js";

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const run = context.routePolicy.relation_kind === "review" ? runReviewTurn : runConsultationTurn;
  const checkpoint = await run(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
