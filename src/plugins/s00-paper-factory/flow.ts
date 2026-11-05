import { readFileSync } from "node:fs";
import { buildGptExecutionProfile, type GptExecutionProfile } from "../../capabilities/gpt/index.js";
import { hashCanonical, productResultValidation as v, type ProductPluginOutput,
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
import { collectFactoryResult } from "./result-contract.js";

type FactoryInput = Readonly<{ facts: Readonly<Record<string, unknown>>; profile: GptExecutionProfile }>;
function continues(output: ProductPluginOutput): boolean {
  const payload = v.object(output.payload, "FACTORY_OUTPUT");
  const issues = v.array(payload.issues, "FACTORY_ISSUES").map(item => v.object(item, "FACTORY_ISSUE"));
  const unresolved = v.stringArray(payload.unresolved, "FACTORY_UNRESOLVED");
  if (new Set(unresolved).size !== unresolved.length || unresolved.some(id => !issues.some(issue => issue.id === id))) {
    throw new Error("FACTORY_UNRESOLVED_IDENTITY_INVALID");
  }
  if (payload.decision === "continue" && issues.some(issue => issue.impact === "critical" && unresolved.includes(String(issue.id)))) {
    throw new Error("FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES");
  }
  return payload.decision === "continue";
}
function checkHandoff(author: ProductPluginOutput, review: ProductPluginOutput, roles: readonly [string, string],
  sourceKey: string, checkKey: string): void {
  if (!continues(review)) return;
  const a = v.object(author.payload, "FACTORY_AUTHOR"), r = v.object(review.payload, "FACTORY_REVIEW");
  const source = v.object(v.object(a.body, "FACTORY_AUTHOR_BODY")[sourceKey], "FACTORY_AUTHOR_REFERENCE");
  const checked = v.object(v.object(r.body, "FACTORY_REVIEW_BODY")[checkKey], "FACTORY_CHECK_REFERENCE");
  const coverage = (payload: Readonly<Record<string, unknown>>, role: string) => v.object(
    v.array(payload.coverage, "FACTORY_COVERAGE").find(item => v.object(item, "FACTORY_COVERAGE_ITEM").responsibility === role),
    "FACTORY_RESPONSIBILITY_COVERAGE_MISSING");
  const authorCoverage = coverage(a, roles[0]), reviewCoverage = coverage(r, roles[1]);
  if (!authorCoverage.context_ref || !reviewCoverage.context_ref
    || hashCanonical(authorCoverage.context_ref) === hashCanonical(reviewCoverage.context_ref)
    || hashCanonical(reviewCoverage.check_ref) !== hashCanonical(checked)
    || !v.array(reviewCoverage.input_refs, "FACTORY_REVIEW_INPUTS").some(ref => hashCanonical(ref) === hashCanonical(source))) {
    throw new Error("FACTORY_REVIEW_HANDOFF_IDENTITY_INVALID");
  }
}
const after = (input: FactoryInput, results: readonly ProductPluginOutput[]): FactoryInput => ({
  ...input, facts: { ...input.facts, preceding_results: results.map(r => r.payload) },
});
function profileFor(task: WebsiteAgentTask, controls: Readonly<Record<string, unknown>>, dialogue = false): GptExecutionProfile {
  const presale = task.action_id === "prepare_brief";
  const policy = presale ? null : v.object(controls.execution_policy, "FACTORY_EXECUTION_POLICY_MISSING");
  const selected = policy ? v.object(policy.profile, "FACTORY_SELECTED_PROFILE_MISSING") : null;
  const model = dialogue || presale ? "GPT-5.6 Sol" : v.text(selected!.model, "FACTORY_MODEL_MISSING");
  if (model !== "最新" && model !== "GPT-5.6 Sol") throw new Error("FACTORY_MODEL_UNSUPPORTED");
  const requestedReasoningValue = dialogue ? 2 : presale ? 3 : Number(selected!.reasoning);
  if (!presale && selected!.mode !== "work") throw new Error("FACTORY_WORK_MODE_REQUIRED");
  return buildGptExecutionProfile({ profileRef: presale ? `paper-presale:${task.parameters.research_tier}` : String(selected!.profile_revision),
    startModelDisplayName: model, requestedReasoningValue, executorIdentityRef: task.job_id,
    acceptanceRef: task.business_identity.authorization_ref, acceptanceVersion: "astra.website-agent-task-result.v2" });
}
function assetIds(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(assetIds);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [...(typeof record.asset_id === "string" ? [record.asset_id] : []), ...Object.values(record).flatMap(assetIds)];
}
function prepareInput(task: WebsiteAgentTask, context: SharedExecutionContext): FactoryInput {
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
  return { facts: { controls, work_access_requests: workRequests }, profile: profileFor(task, controls) };
}
async function brief(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput): Promise<readonly ProductPluginOutput[]> {
  const result = await executeResearchBrief(task, context, input);
  const payload = v.object(result.payload, "S01_RESULT_INVALID");
  if (payload.disposition !== "needs_input") return [result];
  const dialogue = await executeUserDialogue(task, context, { facts: { missing_items: payload.missing_items },
    profile: profileFor(task, {}, true) });
  return [{ payload: { ...payload, missing_items: v.object(dialogue.payload, "C01_RESULT_INVALID").missing_items },
    evidence_refs: [...result.evidence_refs, ...dialogue.evidence_refs] }];
}
async function evidence(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput): Promise<readonly ProductPluginOutput[]> {
  const results = [await executeResearchPlan(task, context, input)];
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeMaterialAcquisition(task, context, after(input, results)));
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeEvidenceProcessing(task, context, after(input, results)));
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeSubtopicResearch(task, context, after(input, results)));
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeEvidenceVerification(task, context, after(input, results)));
  checkHandoff(results.at(-2)!, results.at(-1)!, ["S05", "S06"], "evidence_ref", "verification_ref");
  return results;
}
async function manuscript(task: WebsiteAgentTask, context: SharedExecutionContext, input: FactoryInput): Promise<readonly ProductPluginOutput[]> {
  const results = [await executeManuscriptAuthoring(task, context, input)];
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeManuscriptReview(task, context, after(input, results)));
  checkHandoff(results.at(-2)!, results.at(-1)!, ["S07", "S08"], "manuscript_ref", "review_ref");
  if (!continues(results.at(-1)!)) return results;
  results.push(await executeOriginalityCitationCheck(task, context, after(input, results)));
  return results;
}
export async function executePaperFactory(task: WebsiteAgentTask, context: SharedExecutionContext) {
  const input = prepareInput(task, context);
  let results: readonly ProductPluginOutput[];
  switch (task.action_id) {
    case "prepare_brief": results = await brief(task, context, input); break;
    case "prepare_workspace":
    case "maintain_workspace": results = [await executeWorkspaceFlow(task, context, input)]; break;
    case "build_evidence": results = await evidence(task, context, input); break;
    case "compose_manuscript": results = await manuscript(task, context, input); break;
    case "prepare_delivery":
    case "archive_delivery": results = [await executeResearchPackage(task, context, input)]; break;
    default: throw new Error("FACTORY_ACTION_UNSUPPORTED");
  }
  if (task.action_id !== "prepare_brief") continues(results.at(-1)!);
  return context.complete(collectFactoryResult(task, context, results));
}
