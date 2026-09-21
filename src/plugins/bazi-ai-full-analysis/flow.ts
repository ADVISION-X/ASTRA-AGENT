import { readFileSync } from "node:fs";

import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { createOwnedExecution, markerFor, promptFor, receive, runTurn } from "./product-turn.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isExpectedParentReport = (
  report: Record<string, unknown>, task: WebsiteAgentTask,
): boolean => {
  const expectedRef = task.parameters.parent_report_ref;
  const exactRef = typeof report.parent_report_ref === "string" && report.parent_report_ref.length > 0;
  const exactHash = report.parent_raw_output_hash === task.parent_result_hash;
  const requestedRef = typeof expectedRef !== "string" || report.parent_report_ref === expectedRef;
  return exactRef && exactHash && requestedRef && isRecord(report.parent_terminal_output);
};

const requireParentReport = (task: WebsiteAgentTask, context: SharedExecutionContext): void => {
  const materials = context.materials.filter((entry) => entry.role === "bazi_formal_input");
  const fail = (): never => { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID"); };
  if (materials.length !== 1 || !task.parent_result_hash) fail();
  let value: unknown;
  try { value = JSON.parse(readFileSync(materials[0]!.local_path, "utf8")); } catch { fail(); }
  const record = isRecord(value) ? value : fail();
  const parent = record.parent_report;
  if (!isRecord(parent) || !isExpectedParentReport(parent, task)) fail();
};

export const executeOwnedFlow = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  if (task.product_id !== "bazi_ai_full_analysis") {
    throw executionFailure("failed", "PRODUCT_AI_FULL_ANALYSIS_CONTRACT_INVALID");
  }
  if (context.routePolicy.relation_kind !== "review") {
    const roles = context.materials.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => item.role);
    if (roles.join("\0") !== ["bazi_formal_input", "result_contract"].join("\0")) {
      throw executionFailure("failed", "PRODUCT_AI_FULL_ANALYSIS_CONTRACT_INVALID");
    }
    requireParentReport(task, context);
  }
  const flow = createOwnedExecution(task, context);
  const marker = markerFor(task);
  const checkpoint = await runTurn(task, context, flow, promptFor(task, context, marker), marker);
  return context.complete({ payload: receive(task, checkpoint, context), evidence_refs: flow.evidenceRefs() });
};
