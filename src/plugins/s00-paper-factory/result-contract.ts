import { productResultValidation as v, type ProductPluginOutput,
  type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

type JsonObject = Readonly<Record<string, unknown>>;
const invalid = (): never => v.fail("FACTORY_RESULT_CONTRACT_INVALID");
function stringMatches(value: string, type: unknown): boolean {
  if (type === "string") return true;
  if (!value.trim()) return false;
  switch (type) {
    case "non_empty_string": return true;
    case "sha256": return /^sha256:[a-f0-9]{64}$/u.test(value);
    case "uuid": return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
    case "filename": return !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
    default: return false;
  }
}
function scalarMatches(value: unknown, type: unknown): boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "positive_integer") return Number.isSafeInteger(value) && Number(value) > 0;
  if (type === "safe_integer_or_null") return value === null || Number.isSafeInteger(value);
  return typeof value === "string" && stringMatches(value, type);
}
function checkField(value: unknown, rule: JsonObject): void {
  if (value === null && rule.nullable === true) return;
  if (Object.hasOwn(rule, "const")) { if (value !== rule.const) invalid(); return; }
  if (Array.isArray(rule.enum)) { if (!rule.enum.includes(value)) invalid(); return; }
  if (rule.type === "object") { checkObject(v.object(value, "FACTORY_RESULT_OBJECT"), v.object(rule.field_types, "FACTORY_RESULT_FIELDS")); return; }
  if (rule.type === "array") { for (const item of v.array(value, "FACTORY_RESULT_ARRAY")) checkField(item, v.object(rule.items, "FACTORY_RESULT_ITEMS")); return; }
  if (rule.type === "string_array") { v.stringArray(value, "FACTORY_RESULT_STRINGS"); return; }
  if (!scalarMatches(value, rule.type)) invalid();
}
function checkObject(value: JsonObject, fields: JsonObject): void {
  v.exact(value, Object.keys(fields), "FACTORY_RESULT_FIELDS_INVALID");
  for (const [key, rule] of Object.entries(fields)) checkField(value[key], v.object(rule, "FACTORY_FIELD_RULE_INVALID"));
}
export function collectFactoryResult(task: WebsiteAgentTask, context: SharedExecutionContext,
  stages: readonly ProductPluginOutput[]): ProductPluginOutput {
  const contract = v.object(context.routePolicy.result_contract, "FACTORY_RESULT_CONTRACT_MISSING");
  const fields = v.object(contract.field_types, "FACTORY_RESULT_FIELDS_MISSING");
  const payloads = stages.map(stage => v.object(stage.payload, "FACTORY_STAGE_OUTPUT_INVALID"));
  const last = payloads.at(-1);
  if (!last) throw new Error("FACTORY_STAGE_RESULT_MISSING");
  if (task.action_id === "prepare_brief") {
    checkObject(last, fields);
    v.locked(last, task, ["submission_id", "input_version"]);
    if (last.tier !== task.parameters.research_tier) throw new Error("FACTORY_BRIEF_TIER_MISMATCH");
    return { payload: last, evidence_refs: stages.flatMap(stage => [...stage.evidence_refs]) };
  }
  if (!context.producingExecution) throw new Error("FACTORY_PRODUCING_EXECUTION_MISSING");
  const declared = v.stringArray(contract.required_responsibilities, "FACTORY_RESPONSIBILITIES_MISSING");
  const coverage = payloads.flatMap(p => v.array(p.coverage, "FACTORY_COVERAGE_INVALID"));
  const bodyFields = v.object(v.object(fields.body, "FACTORY_BODY_RULE").field_types, "FACTORY_BODY_FIELDS");
  const merged = Object.assign({}, ...payloads.map(p => v.object(p.body, "FACTORY_STAGE_BODY"))) as Record<string, unknown>;
  const body = Object.fromEntries(Object.keys(bodyFields).map(key => [key, merged[key] ?? null]));
  const issues = new Map(payloads.flatMap(p => v.array(p.issues, "FACTORY_ISSUES_INVALID"))
    .map(issue => [v.text(v.object(issue, "FACTORY_ISSUE").id, "FACTORY_ISSUE_ID"), issue]));
  const record: Record<string, unknown> = { schema_version: "astra-production-result.v1", action: task.action_id,
    ...task.parameters, job_id: task.job_id, execution: context.producingExecution, workspace: last.workspace,
    decision: last.decision, issues: [...issues.values()],
    unresolved: last.unresolved,
    outputs: payloads.flatMap(p => v.array(p.outputs, "FACTORY_OUTPUTS_INVALID")), resources: last.resources, body,
    coverage: declared.map(responsibility => coverage.find(c => v.object(c, "FACTORY_COVERAGE_ITEM").responsibility === responsibility)
      ?? { responsibility, input_refs: [], read_scope: "not executed", limitations: "前序工序已返回未完成决定，本工序未执行。", check_ref: null, context_ref: null }) };
  checkObject(record, fields);
  return { payload: record, evidence_refs: stages.flatMap(stage => [...stage.evidence_refs]) };
}
