import { readFileSync } from "node:fs";

import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { createOwnedExecution, markerFor, promptFor, receive, runTurn } from "./product-turn.js";

const requireParentReport = (task: WebsiteAgentTask, context: SharedExecutionContext): void => {
  const materials = context.materials.filter((entry) => entry.role === "bazi_formal_input");
  const fail = (): never => { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID"); };
  if (materials.length !== 1 || !task.parent_result_hash) fail();
  let value: unknown;
  try { value = JSON.parse(readFileSync(materials[0]!.local_path, "utf8")); } catch { fail(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const parent = (value as Record<string, unknown>).parent_report;
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) fail();
  const report = parent as Record<string, unknown>;
  const expectedRef = task.parameters.parent_report_ref;
  if (typeof report.parent_report_ref !== "string" || !report.parent_report_ref
    || report.parent_raw_output_hash !== task.parent_result_hash
    || (typeof expectedRef === "string" && report.parent_report_ref !== expectedRef)
    || !report.parent_terminal_output || typeof report.parent_terminal_output !== "object"
    || Array.isArray(report.parent_terminal_output)) fail();
};

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  if (context.routePolicy.relation_kind !== "review") {
    requireParentReport(task, context);
  }
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const checkpoint = await runTurn(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
