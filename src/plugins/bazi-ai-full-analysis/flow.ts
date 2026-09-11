import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { requireBaziParentReportMaterial } from "../bazi-parent-report-material.js";
import { createOwnedExecution, markerFor, promptFor, receive, runTurn } from "./product-turn.js";

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  if (context.routePolicy.relation_kind !== "review") {
    requireBaziParentReportMaterial(task, context, "bazi_formal_input");
  }
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const checkpoint = await runTurn(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
