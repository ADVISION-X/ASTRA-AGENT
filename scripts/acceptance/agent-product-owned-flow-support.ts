import assert from "node:assert/strict";

import {
  gptAttachmentProviderDisplayName,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import type {
  ProductPlugin,
  ProductPluginOutput,
  SharedExecutionContext,
} from "../../src/lib/local-runtime/production/plugin.js";
import type { ProductionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";

const HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
const dual = Object.freeze({ professional_markdown: "专业层", reader_explanation_markdown: "读者层" });
const common = Object.freeze({ citations: [], uncertainties: [], limitations: [], safety_notes: [] });
type ProductCall = Parameters<SharedExecutionContext["gpt"]["execute"]>[0];

const parameterValue = (key: string, route: ProductionRoutePolicy): unknown => {
  const fixed: Readonly<Record<string, unknown>> = {
    evidence_ref_catalog: ["receipt:1"], analysis_kind: "chart_interpretation",
    article_package_contract_version: "public-knowledge-article-package.v1",
    observation_schema_version: "payment-screenshot-observation-v1",
    reflection_contract_version: "scheduled-quality-reflection.v1",
    target_locale: "en-US", locale: "zh-CN", thread_ref: "continuation:1",
  };
  if (key === "result_schema_version") return route.result_schema_version;
  if (Object.hasOwn(fixed, key)) return fixed[key];
  if (key === "resource_kind") {
    return route.product_id === "localization_report_translation" ? "report" : "article";
  }
  if (key.endsWith("_hash") || key.endsWith("_sha256")) return HASH;
  return `${key}:1`;
};

const taskFor = (route: ProductionRoutePolicy): WebsiteAgentTask => ({
  schema_version: "website-agent-task.v1",
  protocol_version: "xuanxue-ai-production-v6",
  job_id: `job:${route.product_id}:${route.action_id}`,
  source_task_id: `source:${route.product_id}:${route.action_id}`,
  product_id: route.product_id,
  action_id: route.action_id,
  idempotency_key: `idempotency:${route.product_id}:${route.action_id}`,
  request_hash: HASH,
  task_contract_id: "website-agent-task",
  task_contract_version: 1,
  business_identity: {
    owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1",
  },
  business_context_ref: "context:1",
  business_context_hash: HASH,
  parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, parameterValue(key, route)])),
  material_refs: route.material_roles.map((material, ordinal) => ({
    material_id: `material:${ordinal}`,
    ordinal,
    role: material.role,
    display_name: `material-${ordinal}.json`,
    object_ref: material.role === "subject_result" ? "result:subject" : `object:${ordinal}`,
    sha256: HASH,
    bytes: 10,
    media_type: material.media_types[0]!,
    storage_class: material.storage_class,
    owner_scope_hash: material.owner_scope_policy === "required" ? HASH_B : null,
    trust_class: material.trust_class,
    may_issue_instruction: material.may_issue_instruction,
  })),
  result_contract_id: "website-agent-result",
  result_contract_version: 1,
  ...(route.relation_kind === "continuation" ? {
    continuation_ref: "continuation:1",
    parent_task_ref: "task:parent",
    parent_result_ref: "result:parent",
    parent_result_hash: HASH,
  } : {}),
  ...(route.relation_kind === "review" ? {
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject",
    subject_result_hash: HASH,
    review_policy: route.action_id === "accuracy_challenge"
      ? "manual-accuracy-challenge.v1" as const
      : "scheduled-quality-reflection.v1" as const,
  } : {}),
});

const report = (schema_version: string, summary: string, blocks: string): Record<string, unknown> => ({
  schema_version, [summary]: dual, [blocks]: [{ section: "one" }], ...common,
});

const coreOutputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> | null => {
  switch (task.product_id) {
    case "bazi_chart_interpretation": return {
      ...report(route.result_schema_version, "report_summary", "interpretation_blocks"),
      chart_ref: task.parameters.chart_ref, chart_version: task.parameters.chart_version,
      chart_hash: task.parameters.chart_hash, bazi_pdf_semantic_manifest_ref: "manifest:1",
      manifest_hash: HASH, covered_semantic_anchor_refs: ["anchor:1"],
    };
    case "bazi_ai_full_analysis": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "bazi_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.parameters.thread_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "qimen_professional_answer": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      question_snapshot: "question", index_review_receipts: [{ index: "one" }],
      covered_question_unit_refs: ["question:1"], covered_candidate_refs: ["candidate:1"],
    };
    case "qimen_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.continuation_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      continuation_relation: "same_conversation_followup", new_question_snapshot: "question",
      index_review_receipts: [{ index: "one" }], covered_question_unit_refs: ["question:1"],
      covered_candidate_refs: ["candidate:1"],
    };
    case "hehun_ai_analysis": return {
      ...report(route.result_schema_version, "relationship_summary", "relationship_blocks"),
      case_manifest_ref: task.parameters.case_manifest_ref,
      case_manifest_hash: task.parameters.case_manifest_hash,
      question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "hehun_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.parameters.thread_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    default: return null;
  }
};

const specializedOutputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> => {
  switch (task.product_id) {
    case "naming_from_existing_bazi_report": return {
      schema_version: route.result_schema_version,
      requirement_manifest_ref: task.parameters.requirement_manifest_ref,
      requirement_manifest_hash: task.parameters.requirement_manifest_hash,
      naming_rationale: dual, candidates: [{ name: "one" }],
      comparison_or_selection_rationale: dual,
      uncertainties: [], limitations: [], safety_notes: [], covered_requirement_anchor_refs: ["requirement:1"],
    };
    case "naming_bazi_analysis_and_naming": return {
      schema_version: route.result_schema_version,
      bazi_analysis: {
        ...report("bazi-naming-basis-report-output.v1", "report_summary", "interpretation_blocks"),
        chart_ref: task.parameters.chart_ref, chart_version: task.parameters.chart_version,
        chart_hash: task.parameters.chart_hash, bazi_pdf_semantic_manifest_ref: "manifest:1",
        manifest_hash: HASH, naming_requirement_manifest_ref: "requirement:1",
        naming_requirement_manifest_hash: HASH_B, covered_semantic_anchor_refs: ["anchor:1"],
        covered_requirement_anchor_refs: ["requirement:1"],
      },
      naming: {
        schema_version: "naming-report-output.v2", requirement_manifest_ref: "requirement:1",
        requirement_manifest_hash: HASH_B, naming_rationale: dual, candidates: [{ name: "one" }],
        comparison_or_selection_rationale: dual, uncertainties: [], limitations: [], safety_notes: [],
        covered_requirement_anchor_refs: ["requirement:1"],
      },
    };
    case "localization_report_translation":
    case "localization_article_translation": return {
      schema_version: route.result_schema_version, action_id: task.product_id,
      source_resource_id: task.parameters.source_resource_id,
      source_version: task.parameters.source_version,
      source_sha256: task.parameters.source_sha256,
      target_locale: task.parameters.target_locale,
      localized_structured_payload: { title: "localized" },
    };
    case "payment_screenshot_observation": return {
      schema_version: route.result_schema_version, page_kind: "payment_success", payment_app: "alipay",
      success_visible: true, visible_amount_minor_units: 100, reason_code: "VISIBLE_SUCCESS",
    };
    default: throw new Error(`PRODUCT_FLOW_OUTPUT_MISSING:${task.product_id}`);
  }
};

const outputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> => {
  if (route.relation_kind === "review") return { decision: "no_issue", issues: [] };
  return coreOutputFor(task, route) ?? specializedOutputFor(task, route);
};

type Harness = {
  calls: ProductCall[];
  completed: ProductPluginOutput | null;
  facts: Map<string, Readonly<{ evidenceRef: string; mutation: boolean }>>;
  provider: GptProviderContinuation | null;
  laneOwned: boolean;
  physicalSubmitDispatches: number;
};

const callKey = (call: Omit<ProductCall, "sessionKey">): string => hashCanonical({
  productStepId: call.productStepId, callId: call.callId, child: call.child,
  actionOrdinal: call.actionOrdinal, input: call.input,
});

const initialProvider = (): GptProviderContinuation => Object.freeze({
  provider_page_url: "https://chatgpt.com/c/parent",
  prior_task_id: "task:parent",
  prior_prompt_hash: HASH,
  prior_raw_output_hash: HASH,
  prior_turn_marker: `[GRASSEYE:${"b".repeat(24)}]`,
});

const valueForCall = (
  state: Harness,
  task: WebsiteAgentTask,
  expected: Readonly<Record<string, unknown>>,
  uploaded: readonly Readonly<Record<string, unknown>>[],
  call: ProductCall,
): unknown => {
  if (call.child === "reconcile_gpt_attachment_set") return { files: uploaded };
  if (call.child === "reconcile_gpt_turn_submission") {
    return { canonicalConversationUrl: "https://chatgpt.com/c/current" };
  }
  if (call.child === "wait_for_stable_gpt_text") {
    return { assistantTurnId: "assistant:1", responseHash: HASH };
  }
  if (call.child === "checkpoint_gpt_text_response") {
    return { rawDomHash: HASH, semanticText: JSON.stringify(expected), semanticTextHash: HASH };
  }
  if (call.child === "persist_gpt_continuation") {
    state.provider = call.input.provider as GptProviderContinuation;
    return { continuationRef: "continuation:created" };
  }
  if (call.child === "acquire_gpt_continuation_lane") {
    assert.equal(state.laneOwned, false);
    state.laneOwned = true;
    return { continuation_ref: task.continuation_ref, lane_version: 1, provider: state.provider };
  }
  if (call.child === "advance_gpt_continuation_lane") {
    assert.equal(state.laneOwned, true);
    state.provider = call.input.provider as GptProviderContinuation;
    state.laneOwned = false;
  }
  if (call.child === "release_gpt_continuation_lane") state.laneOwned = false;
  return {};
};

const contextFor = (
  state: Harness,
  task: WebsiteAgentTask,
  route: ProductionRoutePolicy,
): SharedExecutionContext => {
  const expected = outputFor(task, route);
  const uploaded = task.material_refs.map((material) => ({
    artifactRef: material.material_id,
    displayName: material.display_name,
    providerDisplayName: gptAttachmentProviderDisplayName(
      material.display_name, "attempt-1", material.material_id,
    ),
    sha256: material.sha256,
    bytes: material.bytes,
  }));
  return {
    materials: task.material_refs.map((material) => ({
      ...material, local_path: `/tmp/${material.display_name}`,
    })),
    gpt: {
      attemptId: "attempt-1",
      readContinuationForTurn: () => null,
      readCallFacts: async (call) => {
        const fact = state.facts.get(callKey(call));
        return {
          exactCallIdentityHash: HASH,
          mutation: fact?.mutation ? {
            owner: "browser" as const, effectScope: "provider_effect" as const,
            outcome: "CONFIRMED" as const, terminalAt: "2020-01-01T00:00:00.000Z",
          } : null,
          evidence: fact ? {
            owner: "forensics-persistence" as const, evidenceRef: fact.evidenceRef,
            evidenceHash: HASH, readbackVerified: true as const,
            artifactRefs: call.child === "checkpoint_gpt_text_response" ? ["artifact:checkpoint"] : [],
          } : null,
          continuation: null,
        };
      },
      execute: async (call) => {
        state.calls.push(call);
        const key = callKey(call);
        const prior = state.facts.get(key);
        if (call.child === "submit_exact_gpt_turn_once" && !prior) state.physicalSubmitDispatches += 1;
        const evidenceRef = prior?.evidenceRef ?? `evidence:${state.calls.length}`;
        state.facts.set(key, { evidenceRef, mutation: call.child === "submit_exact_gpt_turn_once" });
        return { value: valueForCall(state, task, expected, uploaded, call), evidenceRef, evidenceHash: HASH };
      },
    },
    complete: async (output) => {
      state.completed = output;
      return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
    },
  };
};

export const exerciseProductOwnedFlow = async (
  plugin: ProductPlugin,
  route: ProductionRoutePolicy,
) => {
  const task = taskFor(route);
  const state: Harness = {
    calls: [], completed: null, facts: new Map(),
    provider: route.relation_kind === "continuation" ? initialProvider() : null,
    laneOwned: false, physicalSubmitDispatches: 0,
  };
  await plugin.execute(task, contextFor(state, task, route));
  assert(state.completed);
  assert.equal(state.physicalSubmitDispatches, 1);
  assert.equal(state.laneOwned, false);
  assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(state.calls.every((call) => call.sessionKey.includes(plugin.pluginId)));
  assert.deepEqual(state.calls.map((call) => call.actionOrdinal),
    state.calls.map((_call, index) => index + 1));
  const prompt = state.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt;
  assert.equal(typeof prompt, "string");
  assert.match(String(prompt), new RegExp(`当前 Product Plugin：${plugin.pluginId}`, "u"));
  for (const material of task.material_refs) {
    assert.match(String(prompt), new RegExp(gptAttachmentProviderDisplayName(
      material.display_name, "attempt-1", material.material_id,
    ).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  return { calls: state.calls, completed: state.completed, task };
};
