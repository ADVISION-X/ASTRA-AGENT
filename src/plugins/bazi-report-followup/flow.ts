import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { createOwnedExecution, markerFor, promptFor, receive, runTurn } from "./product-turn.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasFollowupIdentity = (task: WebsiteAgentTask, context: SharedExecutionContext): boolean => {
  const roles = context.materials.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => item.role);
  return context.routePolicy.relation_kind === "followup" && task.action_id === "followup"
    && Boolean(task.parent_task_ref) && Boolean(task.parent_result_ref) && Boolean(task.parent_result_hash)
    && roles.join("\0") === ["bazi_input_bundle", "result_contract"].join("\0");
};

const readParentReport = (context: SharedExecutionContext): Record<string, unknown> | null => {
  const material = context.materials.find((entry) => entry.role === "bazi_input_bundle");
  let value: unknown;
  try { value = material && JSON.parse(readFileSync(material.local_path, "utf8")); }
  catch { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID"); }
  return isRecord(value) && isRecord(value.parent_report) ? value.parent_report : null;
};

const isExpectedParentReport = (report: Record<string, unknown>, task: WebsiteAgentTask): boolean => {
  const expectedRef = task.parameters.parent_report_ref;
  return typeof report.parent_report_ref === "string" && report.parent_report_ref.length > 0
    && report.parent_raw_output_hash === task.parent_result_hash
    && (typeof expectedRef !== "string" || report.parent_report_ref === expectedRef)
    && isRecord(report.parent_terminal_output);
};

const validate = (task: WebsiteAgentTask, context: SharedExecutionContext): void => {
  if (task.product_id !== "bazi_report_followup") {
    throw executionFailure("failed", "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  }
  if (context.routePolicy.relation_kind === "review") return;
  if (!hasFollowupIdentity(task, context)) {
    throw executionFailure("failed", "PRODUCT_FOLLOWUP_CONTRACT_INVALID");
  }
  const report = readParentReport(context);
  if (!report || !isExpectedParentReport(report, task)) {
    throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID");
  }
};

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  validate(task, context);
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const checkpoint = await runTurn(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
import { readFileSync } from "node:fs";
