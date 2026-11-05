import { readFileSync } from "node:fs";
import { buildGptExecutionProfile, type GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { hashCanonical, sha256, productResultValidation as v, type ProductPluginOutput,
  type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { executeUserDialogue } from "../c01-user-dialogue/index.js";
import { executeResearchBrief } from "../s01-research-brief/index.js";
import { executeResearchPlan } from "../s02-research-plan/index.js";
import { executeMaterialAcquisition } from "../s03-material-acquisition/index.js";
import { executeEvidenceProcessing } from "../s04-evidence-processing/index.js";
import { executeSubtopicResearch } from "../s05-subtopic-research/index.js";
import { executeEvidenceVerification } from "../s06-evidence-verification/index.js";
import { executeManuscriptAuthoring } from "../s07-manuscript-authoring/index.js";
import { executeManuscriptReview } from "../s08-manuscript-review/index.js";
import { executeOriginalityCitationCheck } from "../s09-originality-citation-check/index.js";
import { executeResearchPackage } from "../s10-research-package/index.js";
import { executeWorkspaceFlow } from "./workspace-flow.js";
import { collectFactoryResult, dialogueIdentityKeys, initialResearchIssues, mergeResearchIssues, type ResearchIssues } from "./result-contract.js";

type FactoryInput = Readonly<{ facts: Readonly<Record<string, unknown>>; profile: GptExecutionProfile }>;
type ReviewEvidence = Readonly<{ inputs: readonly unknown[]; check: unknown }>;

function coverageFor(payload: Readonly<Record<string, unknown>>, responsibility: string) {
  return v.object(v.array(payload.coverage, "FACTORY_COVERAGE")
    .find(item => v.object(item, "FACTORY_COVERAGE_ITEM").responsibility === responsibility),
  "FACTORY_RESPONSIBILITY_COVERAGE_MISSING");
}

function checkReview(author: ProductPluginOutput, review: ProductPluginOutput, roles: readonly [string, string],
  sourceKey: string, checkKey: string): ReviewEvidence | undefined {
  const result = v.object(review.payload, "FACTORY_REVIEW");
  if (result.decision !== "continue" && (!Array.isArray(result.resolved_issues) || !result.resolved_issues.length)) return;
  const written = v.object(author.payload, "FACTORY_AUTHOR");
  const source = v.object(v.object(written.body, "FACTORY_AUTHOR_BODY")[sourceKey], "FACTORY_AUTHOR_REFERENCE");
  const check = v.object(v.object(result.body, "FACTORY_REVIEW_BODY")[checkKey], "FACTORY_CHECK_REFERENCE");
  const reviewCoverage = coverageFor(result, roles[1]);
  const inputs = v.array(reviewCoverage.input_refs, "FACTORY_REVIEW_INPUTS");
  if (hashCanonical(reviewCoverage.check_ref) !== hashCanonical(check)
    || !inputs.some(input => hashCanonical(input) === hashCanonical(source))) {
    throw new Error("FACTORY_REVIEW_HANDOFF_IDENTITY_INVALID");
  }
  if (roles[1] !== "S09") {
    const authorContext = v.object(coverageFor(written, roles[0]).context_ref, "FACTORY_AUTHOR_CONTEXT");
    const reviewContext = v.object(reviewCoverage.context_ref, "FACTORY_REVIEW_CONTEXT");
    if (v.text(authorContext.ref, "FACTORY_AUTHOR_CONTEXT_REF") === v.text(reviewContext.ref, "FACTORY_REVIEW_CONTEXT_REF")) {
      throw new Error("FACTORY_REVIEW_HANDOFF_IDENTITY_INVALID");
    }
  }
  return { inputs, check };
}

function closeResearchIssues(state: ResearchIssues, closures: unknown, unresolved: readonly string[],
  review: ReviewEvidence | undefined): void {
  if (closures === undefined) return;
  for (const item of v.array(closures, "FACTORY_RESOLVED_ISSUES")) {
    const closed = v.object(item, "FACTORY_ISSUE_CLOSURE");
    const id = v.text(closed.issue_id, "FACTORY_ISSUE_CLOSURE_ID");
    const original = state.history.get(id);
    if (!review || !state.pending.has(id) || unresolved.includes(id)
      || original?.object_ref !== closed.object_ref || original?.object_version !== closed.object_version
      || hashCanonical(closed.check_ref) !== hashCanonical(review.check)
      || !review.inputs.some(input => hashCanonical(input) === hashCanonical(closed.repaired_ref))) {
      throw new Error("FACTORY_ISSUE_CLOSURE_IDENTITY_INVALID");
    }
    state.pending.delete(id);
  }
}

function recordResearchStage(state: ResearchIssues, output: ProductPluginOutput,
  boundary: "repair-step" | "originality-handoff" | "result",
  review?: ReviewEvidence): boolean {
  const payload = v.object(output.payload, "FACTORY_STAGE_OUTPUT_INVALID");
  const unresolved = mergeResearchIssues(state, payload);
  closeResearchIssues(state, payload.resolved_issues, unresolved, review);
  for (const id of unresolved) state.pending.add(id);
  if (payload.decision !== "continue") return false;
  for (const id of state.pending) {
    const mayCarry = boundary === "repair-step" || (boundary === "originality-handoff" && unresolved.includes(id));
    if (state.history.get(id)?.impact === "critical" && !(mayCarry && state.authorizedRepairs.has(id))) {
      throw new Error("FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES");
    }
  }
  return true;
}

function researchInput(input: FactoryInput, stages: readonly ProductPluginOutput[], state: ResearchIssues): FactoryInput {
  const preceding_results = stages.map(stage => {
    const { resolved_issues: _localClosure, ...payload } = v.object(stage.payload, "FACTORY_STAGE_OUTPUT_INVALID");
    return payload;
  });
  const pending_issues = [...state.pending].map(id => state.history.get(id));
  return { ...input, facts: { ...input.facts, preceding_results, pending_issues } };
}

function factoryContractVersion(task: WebsiteAgentTask): string {
  const reference = task.material_refs.find(material => material.role === "result_contract")?.object_ref;
  const match = /^contract:(astra\.website-agent-task-result):([1-9][0-9]*):/u.exec(reference ?? "");
  if (!match) throw new Error("FACTORY_RESULT_CONTRACT_IDENTITY_INVALID");
  return `${match[1]}.v${match[2]}`;
}

function profileFor(task: WebsiteAgentTask, controls: Readonly<Record<string, unknown>>, dialogue = false): GptExecutionProfile {
  const presale = task.action_id === "prepare_brief";
  const standaloneDialogue = task.action_id === "user_dialogue";
  const chat = presale || standaloneDialogue;
  const policy = chat ? null : v.object(controls.execution_policy, "FACTORY_EXECUTION_POLICY_MISSING");
  const selected = policy ? v.object(policy.profile, "FACTORY_SELECTED_PROFILE_MISSING") : null;
  const model = chat ? "GPT-5.6 Sol" : v.text(selected!.model, "FACTORY_MODEL_MISSING");
  if (model !== "最新" && model !== "GPT-5.6 Sol") throw new Error("FACTORY_MODEL_UNSUPPORTED");
  const requestedReasoningValue = dialogue || standaloneDialogue ? 2 : presale ? 3 : Number(selected!.reasoning);
  if (!chat && selected!.mode !== "work") throw new Error("FACTORY_WORK_MODE_REQUIRED");
  const profileRef = standaloneDialogue ? `paper-dialogue:${task.parameters.turn_id}`
    : presale ? `paper-presale:${task.parameters.research_tier}` : String(selected!.profile_revision);
  return buildGptExecutionProfile({ profileRef,
    startModelDisplayName: model, requestedReasoningValue, executorIdentityRef: task.job_id,
    acceptanceRef: task.business_identity.authorization_ref, acceptanceVersion: factoryContractVersion(task) });
}
function assetIds(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(assetIds);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [...(typeof record.asset_id === "string" ? [record.asset_id] : []), ...Object.values(record).flatMap(assetIds)];
}
function languageFacts(task: WebsiteAgentTask, frozen: Readonly<Record<string, unknown>> | null) {
  const { communication_locale, manuscript_locale } = task.parameters;
  const action = task.action_id;
  if (action === "user_dialogue") {
    if (typeof communication_locale !== "string" || communication_locale !== frozen?.communication_locale) {
      throw new Error("C01_CONTEXT_LANGUAGE_INVALID");
    }
    return { communication_locale };
  }
  const legacy = communication_locale === null && manuscript_locale === null
    && (action === "maintain_workspace" || action === "prepare_delivery" || action === "archive_delivery");
  if (!legacy && (typeof communication_locale !== "string" || !communication_locale.trim()
    || typeof manuscript_locale !== "string" || !manuscript_locale.trim())) {
    throw new Error("FACTORY_INPUT_LANGUAGE_INVALID");
  }
  if (action !== "prepare_brief" && (!frozen || frozen.communication_locale !== communication_locale
    || frozen.manuscript_locale !== manuscript_locale)) throw new Error("FACTORY_CONTEXT_LANGUAGE_INVALID");
  return { communication_locale, manuscript_locale };
}

function prepareInput(task: WebsiteAgentTask, context: SharedExecutionContext): FactoryInput {
  if (task.action_id === "user_dialogue") {
    const material = context.materials.find(item => item.role === "dialogue_context");
    if (material?.object_ref !== `context:astra-dialogue:${task.parameters.turn_id}`) throw new Error("C01_CONTEXT_IDENTITY_INVALID");
    const bytes = readFileSync(material.local_path);
    const contextHash = sha256(bytes);
    if (contextHash !== material.sha256 || contextHash !== task.parameters.dialogue_context_hash) {
      throw new Error("C01_CONTEXT_IDENTITY_INVALID");
    }
    const facts = v.object(JSON.parse(bytes.toString("utf8")), "C01_CONTEXT_INVALID");
    const order = facts.order === null ? null : v.object(facts.order, "C01_CONTEXT_ORDER_INVALID");
    if (facts.project_id !== task.parameters.project_id || facts.input_version !== task.parameters.dialogue_input_version
      || (order?.revision ?? null) !== task.parameters.dialogue_order_revision) throw new Error("C01_CONTEXT_IDENTITY_INVALID");
    const identity = Object.fromEntries(dialogueIdentityKeys.map(key => [key, task.parameters[key]]));
    return { facts: { identity, ...languageFacts(task, facts), question: v.text(task.parameters.question, "C01_QUESTION_INVALID"), context: facts },
      profile: profileFor(task, {}) };
  }
  const controls: Record<string, unknown> = {};
  for (const material of context.materials) {
    if (["project_context", "research_context", "delivery_plan", "execution_policy"].includes(material.role)) {
      controls[material.role] = JSON.parse(readFileSync(material.local_path, "utf8")) as unknown;
    }
  }
  const workRequests: Readonly<{ material_id: string; asset_id?: string }>[] = [];
  for (const material of task.material_refs.filter(m => m.role === "research_input")) {
    workRequests.push({ material_id: material.material_id });
  }
  for (const material of context.materials) {
    const selected = material.role === "project_context" && task.action_id === "prepare_workspace" ? controls.project_context
      : material.role === "delivery_plan" ? controls.delivery_plan
        : material.role === "research_context" ? v.object(controls.research_context, "RESEARCH_CONTEXT_INVALID").public_sources : null;
    for (const assetId of new Set(assetIds(selected))) workRequests.push({ material_id: material.material_id, asset_id: assetId });
  }
  const frozen = task.action_id === "prepare_brief" ? null : v.object(controls.project_context, "FACTORY_PROJECT_CONTEXT_INVALID");
  return { facts: { ...languageFacts(task, frozen), controls, work_access_requests: workRequests }, profile: profileFor(task, controls) };
}
async function brief(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput): Promise<readonly ProductPluginOutput[]> {
  const result = await executeResearchBrief(task, context, input);
  const payload = v.object(result.payload, "S01_RESULT_INVALID");
  if (payload.disposition !== "needs_input") return [result];
  const dialogue = await executeUserDialogue(task, context, {
    facts: { communication_locale: input.facts.communication_locale, missing_items: payload.missing_items },
    profile: profileFor(task, {}, true),
  });
  return [{ payload: { ...payload, missing_items: v.object(dialogue.payload, "C01_RESULT_INVALID").missing_items },
    evidence_refs: [...result.evidence_refs, ...dialogue.evidence_refs] }];
}
async function evidence(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput,
  issues: ResearchIssues): Promise<readonly ProductPluginOutput[]> {
  const plan = await executeResearchPlan(task, context, researchInput(input, [], issues));
  const results = [plan];
  if (!recordResearchStage(issues, plan, "repair-step")) return results;
  const materials = await executeMaterialAcquisition(task, context, researchInput(input, results, issues));
  results.push(materials);
  if (!recordResearchStage(issues, materials, "repair-step")) return results;
  const processed = await executeEvidenceProcessing(task, context, researchInput(input, results, issues));
  results.push(processed);
  if (!recordResearchStage(issues, processed, "repair-step")) return results;
  const research = await executeSubtopicResearch(task, context, researchInput(input, results, issues));
  results.push(research);
  if (!recordResearchStage(issues, research, "repair-step")) return results;
  const verification = await executeEvidenceVerification(task, context, researchInput(input, results, issues));
  results.push(verification);
  recordResearchStage(issues, verification, "result", checkReview(research, verification, ["S05", "S06"], "evidence_ref", "verification_ref"));
  return results;
}
async function manuscript(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput,
  issues: ResearchIssues): Promise<readonly ProductPluginOutput[]> {
  const draft = await executeManuscriptAuthoring(task, context, researchInput(input, [], issues));
  const results = [draft];
  if (!recordResearchStage(issues, draft, "repair-step")) return results;
  const review = await executeManuscriptReview(task, context, researchInput(input, results, issues));
  results.push(review);
  if (!recordResearchStage(issues, review, "originality-handoff",
    checkReview(draft, review, ["S07", "S08"], "manuscript_ref", "review_ref"))) return results;
  const originality = await executeOriginalityCitationCheck(task, context, researchInput(input, results, issues));
  results.push(originality);
  recordResearchStage(issues, originality, "result", checkReview(draft, originality, ["S07", "S09"], "manuscript_ref", "originality_ref"));
  return results;
}
export async function executePaperFactory(task: WebsiteAgentTask, context: SharedExecutionContext) {
  const input = prepareInput(task, context);
  let results: readonly ProductPluginOutput[];
  let issues: ResearchIssues | undefined;
  switch (task.action_id) {
    case "prepare_brief": results = await brief(task, context, input); break;
    case "user_dialogue": results = [await executeUserDialogue(task, context, input)]; break;
    case "prepare_workspace":
    case "maintain_workspace": results = [await executeWorkspaceFlow(task, context, input)]; break;
    case "build_evidence":
      issues = initialResearchIssues(task.action_id, input.facts);
      results = await evidence(task, context, input, issues); break;
    case "compose_manuscript":
      issues = initialResearchIssues(task.action_id, input.facts);
      results = await manuscript(task, context, input, issues); break;
    case "prepare_delivery":
    case "archive_delivery": results = [await executeResearchPackage(task, context, input)]; break;
    default: throw new Error("FACTORY_ACTION_UNSUPPORTED");
  }
  return context.complete(collectFactoryResult(task, context, results, issues));
}
