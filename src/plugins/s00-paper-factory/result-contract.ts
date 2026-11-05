import { productResultValidation as v, type ProductPluginOutput,
  type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

type JsonObject = Readonly<Record<string, unknown>>;
const dialogueIdentityKeys = ["turn_id", "project_id", "dialogue_input_version", "dialogue_order_revision", "dialogue_context_hash"] as const;
export type ResearchIssues = Readonly<{
  history: Map<string, JsonObject>;
  pending: Set<string>;
  authorizedRepairs: ReadonlySet<string>;
}>;

function declaredIssues(payload: JsonObject): Map<string, JsonObject> {
  const issues = new Map<string, JsonObject>();
  for (const item of v.array(payload.issues, "FACTORY_ISSUES")) {
    const issue = v.object(item, "FACTORY_ISSUE");
    const id = v.text(issue.id, "FACTORY_ISSUE_ID");
    if (issues.has(id)) throw new Error("FACTORY_ISSUE_IDENTITY_CONFLICT");
    issues.set(id, issue);
  }
  return issues;
}

function unresolvedIds(payload: JsonObject, issues: ReadonlyMap<string, JsonObject>): readonly string[] {
  const ids = v.stringArray(payload.unresolved, "FACTORY_UNRESOLVED");
  if (new Set(ids).size !== ids.length || ids.some(id => !issues.has(id))) {
    throw new Error("FACTORY_UNRESOLVED_IDENTITY_INVALID");
  }
  return ids;
}

export function initialResearchIssues(action: string, facts: JsonObject): ResearchIssues {
  const controls = v.object(facts.controls, "FACTORY_CONTROLS");
  const previous = v.object(controls.research_context, "FACTORY_RESEARCH_CONTEXT").previous_result;
  if (previous == null) return { history: new Map(), pending: new Set(), authorizedRepairs: new Set() };
  const result = v.object(previous, "FACTORY_PREVIOUS_RESULT");
  const history = declaredIssues(result), pending = new Set(unresolvedIds(result, history));
  const policy = v.object(controls.execution_policy, "FACTORY_EXECUTION_POLICY_MISSING");
  const authorized = policy.authorized_action === action && ["supplement", "rework"].includes(String(result.decision));
  return { history, pending, authorizedRepairs: authorized ? new Set(pending) : new Set() };
}

export function mergeResearchIssues(state: ResearchIssues, payload: JsonObject): readonly string[] {
  const issues = declaredIssues(payload);
  const unresolved = new Set(unresolvedIds(payload, issues));
  for (const [id, issue] of issues) {
    const original = state.history.get(id);
    if (!original) {
      state.history.set(id, issue);
      unresolved.add(id);
    } else if (["object_ref", "object_version", "impact", "target"].some(key => original[key] !== issue[key])) {
      throw new Error("FACTORY_ISSUE_IDENTITY_CONFLICT");
    }
  }
  return [...unresolved];
}

function mechanicalIssues(payload: JsonObject): { issues: readonly JsonObject[]; unresolved: readonly string[] } {
  const issues = new Map(v.array(payload.issues, "FACTORY_ISSUES")
    .map(item => {
      const issue = v.object(item, "FACTORY_ISSUE");
      return [v.text(issue.id, "FACTORY_ISSUE_ID"), issue] as const;
    }));
  const unresolved = unresolvedIds(payload, issues);
  if (payload.decision === "continue" && unresolved.some(id => issues.get(id)?.impact === "critical")) {
    throw new Error("FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES");
  }
  return { issues: [...issues.values()], unresolved };
}

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
  if (type === "nonnegative_integer") return Number.isSafeInteger(value) && Number(value) >= 0;
  if (type === "safe_integer_or_null") return value === null || Number.isSafeInteger(value);
  return typeof value === "string" && stringMatches(value, type);
}
const explanations = new Set(["read_scope", "limitations", "reason", "remaining_constraint"]);

function projectField(value: unknown, rule: JsonObject): unknown {
  if (value === null && rule.nullable === true) return null;
  if (Object.hasOwn(rule, "const")) return value === rule.const ? value : invalid();
  if (Array.isArray(rule.enum)) return rule.enum.includes(value) ? value : invalid();
  if (rule.type === "object") {
    return projectResult(v.object(value, "FACTORY_RESULT_OBJECT"), v.object(rule.field_types, "FACTORY_RESULT_FIELDS"));
  }
  if (rule.type === "array") {
    const itemRule = v.object(rule.items, "FACTORY_RESULT_ITEMS");
    return v.array(value, "FACTORY_RESULT_ARRAY").map(item => projectField(item, itemRule));
  }
  if (rule.type === "string_array") return v.stringArray(value, "FACTORY_RESULT_STRINGS");
  return scalarMatches(value, rule.type) ? value : invalid();
}

function projectResult(value: JsonObject, fields: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(fields).map(([key, descriptor]) => {
    const rule = v.object(descriptor, "FACTORY_FIELD_RULE_INVALID");
    const supplied = value[key];
    return [key, rule.type === "string" && explanations.has(key) && typeof supplied !== "string"
      ? "" : projectField(supplied, rule)];
  }));
}

function researchBody(payload: JsonObject, body: JsonObject): JsonObject {
  switch (payload.schema_version) {
    case "astra-s02-output.v1": return { plan_ref: body.plan_ref };
    case "astra-s04-output.v1":
    case "astra-s05-output.v1": return Object.hasOwn(body, "evidence_ref") ? { evidence_ref: body.evidence_ref } : {};
    case "astra-s06-output.v1": return { verification_ref: body.verification_ref };
    case "astra-s07-output.v1": return { manuscript_ref: body.manuscript_ref };
    case "astra-s08-output.v1": return { review_ref: body.review_ref };
    case "astra-s09-output.v1": return { originality_ref: body.originality_ref };
    default: return {};
  }
}

function resultCoverage(payloads: readonly JsonObject[], responsibility: string, research: boolean): unknown {
  const local = research ? payloads.filter(p => p.schema_version === `astra-${responsibility.toLowerCase()}-output.v1`) : payloads;
  const reported = local.flatMap(p => v.array(p.coverage, "FACTORY_COVERAGE_INVALID"))
    .find(c => v.object(c, "FACTORY_COVERAGE_ITEM").responsibility === responsibility);
  if (reported) return reported;
  const executed = research && local.length > 0;
  if (executed && local.some(p => p.decision === "continue")) throw new Error("FACTORY_RESPONSIBILITY_COVERAGE_MISSING");
  return { responsibility, input_refs: [], read_scope: executed ? "not reported" : "not executed",
    limitations: executed ? "本工序已返回未完成决定，未报告读取覆盖。" : "前序工序已返回未完成决定，本工序未执行。",
    check_ref: null, context_ref: null };
}

function nextBusinessAction(task: WebsiteAgentTask, context: SharedExecutionContext, decision: unknown, body: JsonObject,
  { issues, unresolved }: { issues: readonly JsonObject[]; unresolved: readonly string[] }): string | null {
  const allowed = context.routePolicy.next_business_actions?.[v.text(decision, "FACTORY_DECISION_INVALID")];
  let next: string | null | undefined;
  if (decision === "supplement" || decision === "rework") {
    const targets = new Set(issues.filter(issue => unresolved.includes(String(issue.id))).map(issue => issue.target));
    if (["S02", "S03", "S04", "S05", "S06"].some(target => targets.has(target))) next = "build_evidence";
    else if (["S07", "S08", "S09"].some(target => targets.has(target))) next = "compose_manuscript";
  } else if (task.action_id === "maintain_workspace" && decision === "continue") {
    if (body.purpose !== task.parameters.purpose) invalid();
    next = body.purpose === "repair_files" ? "prepare_delivery" : null;
  } else if (allowed?.length === 1) {
    next = allowed[0];
  }
  if (next === undefined || !allowed?.includes(next)) return invalid();
  return next;
}

function blockedFactoryResult(task: WebsiteAgentTask, context: SharedExecutionContext, workspace: unknown,
  evidence: readonly string[], fields: JsonObject): ProductPluginOutput {
  if (!context.producingExecution) throw new Error("FACTORY_PRODUCING_EXECUTION_MISSING");
  const {communication_locale:_communication,manuscript_locale:_manuscript,...resultIdentity}=task.parameters;
  const bound = workspace && typeof workspace === "object" && typeof Reflect.get(workspace, "directory_ref") === "string"
    ? workspace : null;
  return { payload: {
    ...resultIdentity, schema_version: "astra-production-result.v1", action: task.action_id, job_id: task.job_id,
    execution: context.producingExecution, workspace: projectField(bound, v.object(fields.workspace, "FACTORY_WORKSPACE_RULE")),
    decision: "blocked", next_business_action: null, public_updates: [], issues: [], unresolved: [], outputs: [], coverage: [],
    resources: { observed_profile: null, usage_ref: null, remaining_constraint: "MECHANICAL_FACTS_UNAVAILABLE", progress_refs: [] },
    body: {},
  }, evidence_refs: evidence };
}

export function collectFactoryResult(task: WebsiteAgentTask, context: SharedExecutionContext,
  stages: readonly ProductPluginOutput[], research?: ResearchIssues, workspace?: unknown): ProductPluginOutput {
  const contract = v.object(context.routePolicy.result_contract, "FACTORY_RESULT_CONTRACT_MISSING");
  const fields = v.object(contract.field_types, "FACTORY_RESULT_FIELDS_MISSING");
  const evidence = stages.flatMap(stage => [...stage.evidence_refs]);
  if (contract.blocked_mechanical_facts === true) {
    const result = v.settleMechanicalOutput(evidence, () => collectFactoryPayload(task, context, stages, contract, fields, research));
    return result.payload === null ? blockedFactoryResult(task, context, workspace, evidence, fields) : result;
  }
  return { payload: collectFactoryPayload(task, context, stages, contract, fields, research), evidence_refs: evidence };
}

function collectFactoryPayload(task: WebsiteAgentTask, context: SharedExecutionContext,
  stages: readonly ProductPluginOutput[], contract: JsonObject, fields: JsonObject, research?: ResearchIssues): unknown {
  const payloads = stages.map(stage => v.object(stage.payload, "FACTORY_STAGE_OUTPUT_INVALID"));
  const last = payloads.at(-1);
  if (!last) throw new Error("FACTORY_STAGE_RESULT_MISSING");
  if (task.action_id === "prepare_brief" || task.action_id === "user_dialogue") {
    const result = projectResult(last, fields);
    if (task.action_id === "user_dialogue") {
      v.locked(last, task, dialogueIdentityKeys);
    } else {
      v.locked(last, task, ["submission_id", "input_version"]);
      if (last.tier !== task.parameters.research_tier) throw new Error("FACTORY_BRIEF_TIER_MISMATCH");
    }
    return result;
  }
  if (!context.producingExecution) throw new Error("FACTORY_PRODUCING_EXECUTION_MISSING");
  const declared = v.stringArray(contract.required_responsibilities, "FACTORY_RESPONSIBILITIES_MISSING");
  const bodyFields = v.object(v.object(fields.body, "FACTORY_BODY_RULE").field_types, "FACTORY_BODY_FIELDS");
  const merged = Object.assign({}, ...payloads.map(p => {
    const body = v.object(p.body, "FACTORY_STAGE_BODY");
    return research ? researchBody(p, body) : body;
  })) as Record<string, unknown>;
  const body = Object.fromEntries(Object.keys(bodyFields).map(key => [key, merged[key] ?? null]));
  const issueResult = research ? { issues: [...research.history.values()], unresolved: [...research.pending] } : mechanicalIssues(last);
  const pendingIssues = issueResult.issues.filter(issue => issueResult.unresolved.includes(String(issue.id)));
  const assemblyOnly = task.action_id === "prepare_delivery" && pendingIssues.length > 0
    && pendingIssues.every(issue => issue.target === "assembly");
  // A package fault must reach Website for the original operator repair, without a content suggestion.
  const decision = assemblyOnly && (last.decision === "rework" || last.decision === "supplement") ? "blocked" : last.decision;
  const {communication_locale:_communication,manuscript_locale:_manuscript,...resultIdentity}=task.parameters;
  const record: Record<string, unknown> = { schema_version: "astra-production-result.v1", action: task.action_id,
    ...resultIdentity, job_id: task.job_id, execution: context.producingExecution, workspace: last.workspace,
    decision, ...issueResult,
    next_business_action: nextBusinessAction(task, context, decision, body, issueResult), public_updates: [],
    outputs: payloads.flatMap(p => v.array(p.outputs, "FACTORY_OUTPUTS_INVALID")), resources: last.resources, body,
    coverage: declared.map(responsibility => resultCoverage(payloads, responsibility, Boolean(research))) };
  return projectResult(record, fields);
}
