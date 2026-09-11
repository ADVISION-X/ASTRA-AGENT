import { readFileSync } from "node:fs";

import { executionFailure } from "../lib/execution-failure.js";
import type { SharedExecutionContext, WebsiteAgentTask } from "../mediator/product-plugin-contract.js";

const fail = (): never => { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID"); };

export const requireBaziParentReportMaterial = (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  role: "bazi_formal_input" | "bazi_input_bundle",
): void => {
  const material = context.materials.filter((entry) => entry.role === role);
  if (material.length !== 1 || !task.parent_result_hash) fail();
  const parentMaterial = material[0] ?? fail();
  let value: unknown;
  try { value = JSON.parse(readFileSync(parentMaterial.local_path, "utf8")); } catch { fail(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const parent = (value as Record<string, unknown>).parent_report;
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) fail();
  const report = parent as Record<string, unknown>;
  const expectedReportRef = task.parameters.parent_report_ref;
  if (typeof report.parent_report_ref !== "string" || !report.parent_report_ref
    || report.parent_raw_output_hash !== task.parent_result_hash
    || (typeof expectedReportRef === "string" && report.parent_report_ref !== expectedReportRef)
    || !report.parent_terminal_output || typeof report.parent_terminal_output !== "object"
    || Array.isArray(report.parent_terminal_output)) fail();
};
