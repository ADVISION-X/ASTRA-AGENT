import type { WebsiteAgentTask, SharedExecutionContext } from "../../mediator/product-plugin-contract.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { createOwnedExecution, markerFor, promptFor, receive, runTurn } from "./product-turn.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasFollowupIdentity = (task: WebsiteAgentTask, context: SharedExecutionContext): boolean => {
  const roles = context.materials.slice().sort((a, b) => a.ordinal - b.ordinal).map((item) => item.role);
  return context.routePolicy.relation_kind === "followup" && task.action_id === "followup"
    && Boolean(task.parent_task_ref) && Boolean(task.parent_result_ref) && Boolean(task.parent_result_hash)
    && roles.join("\0") === ["ready_corpus_archive", "bazi_input_bundle"].join("\0");
};

const parentArchiveReport = (context: SharedExecutionContext, role: string): Record<string, unknown> => {
  const fail = (): never => { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID"); };
  const materials = context.materials.filter(entry => entry.role === role);
  if (materials.length !== 1 || materials[0]!.media_type !== "application/zip") fail();
  const material = materials[0]!;
  const bytes = readFileSync(material.local_path);
  if (bytes.length !== material.bytes || sha256(bytes) !== material.sha256) fail();
  const root = "八字命盘资料/06_父报告";
  const seen = new Set<string>();
  const files = unzipSync(bytes, { filter: entry => {
    if (seen.has(entry.name)) fail();
    seen.add(entry.name);
    return entry.name.startsWith(`${root}/`);
  } });
  const used = new Set<string>();
  const read = (path: string): Record<string, unknown> => {
    const data = files[path];
    if (!data || used.has(path)) fail();
    used.add(path);
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data!));
    return isRecord(value) ? value : fail();
  };
  const readPages = (path: string, key: string, spec: Record<string, unknown>): unknown[] => {
      const records: unknown[] = [];
      for (const page of spec.pages as unknown[]) {
        if (!isRecord(page)) fail();
        const p = page as Record<string, unknown>;
        const entry = `${path}/${key}/P_${String(records.length).padStart(6, "0")}.json`;
        if (p.path !== entry || p.start !== records.length || !Number.isSafeInteger(p.count)
          || Number(p.count) <= 0 || !files[entry] || used.has(entry)) fail();
        const values: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(files[entry]!));
        if (!Array.isArray(values) || values.length !== p.count) fail();
        used.add(entry); records.push(...values as unknown[]);
      }
      if (records.length !== spec.original_count) fail();
      return records;
  };
  const readReport = (path: string): Record<string, unknown> => {
    const identity = read(`${path}/身份.json`);
    const { record_pages: pages, ...report } = identity;
    if (!isRecord(pages)) fail();
    const allowed = path.endsWith("/语义注册表") ? ["anchors"] : ["interpretation_blocks", "answer_blocks",
      "everyday_answer_blocks", "relationship_blocks", "citations", "covered_semantic_anchor_refs",
      "covered_question_unit_refs", "covered_requirement_anchor_refs"];
    for (const [key, spec] of Object.entries(pages as Record<string, unknown>)) {
      if (!allowed.includes(key) || Object.hasOwn(report, key) || !isRecord(spec)
        || !Number.isSafeInteger(spec.original_count) || Number(spec.original_count) < 0
        || !Array.isArray(spec.pages)) fail();
      report[key] = readPages(path, key, spec as Record<string, unknown>);
    }
    if (files[`${path}/正式正文/身份.json`]) report.terminal_output = readReport(`${path}/正式正文`);
    if (files[`${path}/语义注册表/身份.json`]) report.anchor_registry = readReport(`${path}/语义注册表`);
    return report;
  };
  const identity = read(`${root}/来源身份.json`);
  const output = readReport(`${root}/正文`);
  if (Object.hasOwn(identity, "parent_terminal_output")
    || Object.keys(files).some(path => !used.has(path))) fail();
  return { ...identity, parent_terminal_output: output };
};

const readParentReport = (context: SharedExecutionContext): Record<string, unknown> => {
  try { return parentArchiveReport(context, "bazi_input_bundle"); }
  catch (error) { throw executionFailure("failed", "PRODUCT_PARENT_REPORT_MATERIAL_INVALID", { cause: error }); }
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
import { unzipSync } from "fflate";
import { sha256 } from "../../mediator/product-plugin-contract.js";
