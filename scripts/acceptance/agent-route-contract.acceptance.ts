import assert from "node:assert/strict";

import type { ProductionHash, WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import { resolveProductionPlugin } from "../../src/lib/local-runtime/production/catalog.js";
import {
  assertProductionTaskRoutePolicy,
  productionRoutePolicies,
  type ProductionRoutePolicy,
} from "../../src/lib/local-runtime/production/route-policy.js";

const assertRouteResultPayload = (
  task: WebsiteAgentTask,
  value: unknown,
  phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> =>
  resolveProductionPlugin(task.product_id, task.action_id).plugin.parseResult(task, value, phase);

const HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
const dual = Object.freeze({ professional_markdown: "专业层", reader_explanation_markdown: "读者层" });
const common = Object.freeze({
  citations: [], uncertainties: [], limitations: [], safety_notes: [],
});

const parameterValue = (key: string, route: ProductionRoutePolicy): unknown => {
  if (key === "result_schema_version") return route.result_schema_version;
  if (key === "evidence_ref_catalog") return ["rec-a"];
  if (key === "analysis_kind") return "chart_interpretation";
  if (key === "article_package_contract_version") return "public-knowledge-article-package.v1";
  if (key === "observation_schema_version") return "payment-screenshot-observation-v1";
  if (key === "reflection_contract_version") return "scheduled-quality-reflection.v1";
  if (key === "target_locale") return "en-US";
  if (key === "locale") return "zh-CN";
  if (key === "resource_kind") return route.product_id === "localization_report_translation" ? "report" : "article";
  if (key.endsWith("_hash") || key.endsWith("_sha256")) return HASH;
  if (key === "thread_ref") return "continuation:1";
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
  business_identity: { owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1" },
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
  schema_version,
  [summary]: dual,
  [blocks]: [{ section: "one" }],
  ...common,
});

const publicResearch = Object.freeze({
  schema_version: "public-knowledge-research-output.v3",
  decision: "proceed",
  topic_manifest: { topic: "one" },
  editorial_intent: "intent",
  catalog_comparison_note: "comparison",
  research_markdown: "research",
  citations: [],
  uncertainties: [],
  research_claim_units: [],
  closest_existing_article_ids: [],
  relation_assertions: [],
  novelty_basis: "novel",
});

const outputFor = (task: WebsiteAgentTask, route: ProductionRoutePolicy): Record<string, unknown> => {
  if (route.relation_kind === "review") return { decision: "no_issue", issues: [] };
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
      case_manifest_ref: task.parameters.case_manifest_ref, case_manifest_hash: task.parameters.case_manifest_hash,
      question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
    case "hehun_report_followup": return {
      ...report(route.result_schema_version, "answer_summary", "answer_blocks"),
      thread_ref: task.parameters.thread_ref, parent_report_ref: task.parameters.parent_report_ref,
      parent_raw_output_hash: task.parameters.parent_raw_output_hash,
      new_question_snapshot: "question", covered_question_unit_refs: ["question:1"],
    };
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
    case "public_knowledge_article_pipeline": return {
      schema_version: route.result_schema_version,
      research: publicResearch,
      article: {
        schema_version: "public-knowledge-article-output.v3", title: "title", editor_note: "note",
        article_markdown: "article", citations: [], claim_coverage: [], safety_notes: [],
      },
      image: {
        schema_version: "public-knowledge-agent-hero-image.v1", artifact_id: "artifact:1",
        object_ref: "object:image", sha256: HASH, receipt_hash: HASH_B, bytes: 10,
        mime_type: "image/webp", width: 1200, height: 630,
      },
    };
    case "localization_report_translation":
    case "localization_article_translation": return {
      schema_version: route.result_schema_version, action_id: task.product_id,
      source_resource_id: task.parameters.source_resource_id, source_version: task.parameters.source_version,
      source_sha256: task.parameters.source_sha256, target_locale: task.parameters.target_locale,
      localized_structured_payload: { title: "localized" },
    };
    case "payment_screenshot_observation": return {
      schema_version: route.result_schema_version, page_kind: "payment_success", payment_app: "alipay",
      success_visible: true, visible_amount_minor_units: 100, reason_code: "VISIBLE_SUCCESS",
    };
  }
};

assert.equal(productionRoutePolicies.length, 39);
const tested = new Set<string>();
for (const route of productionRoutePolicies) {
  const task = taskFor(route);
  assertProductionTaskRoutePolicy(task);
  assertRouteResultPayload(task, outputFor(task, route));
  const firstParameter = route.required_parameter_keys[0]!;
  const invalidValue = Array.isArray(task.parameters[firstParameter]) ? []
    : firstParameter.endsWith("_hash") || firstParameter.endsWith("_sha256") ? "not-a-hash" : "";
  assert.throws(() => assertProductionTaskRoutePolicy({
    ...task,
    parameters: { ...task.parameters, [firstParameter]: invalidValue },
  }), /AGENT_ROUTE_PARAMETER_VALUE_INVALID/u);
  if (route.relation_kind === "review") {
    assert.throws(() => assertProductionTaskRoutePolicy({
      ...task,
      material_refs: task.material_refs.map((material) => material.role === "subject_result"
        ? { ...material, sha256: HASH_B } : material),
    }), /AGENT_REVIEW_SUBJECT_MATERIAL_INVALID/u);
  }
  tested.add(`${route.product_id}\0${route.action_id}`);
}
assert.equal(tested.size, 39);

const paymentRoute = productionRoutePolicies.find((route) => route.product_id === "payment_screenshot_observation"
  && route.action_id === "observe")!;
const paymentTask = taskFor(paymentRoute);
assert.throws(() => assertProductionTaskRoutePolicy({
  ...paymentTask,
  parameters: { ...paymentTask.parameters, forbidden_extra: true },
}), /AGENT_ROUTE_PARAMETER_SET_INVALID/u);
assert.throws(() => assertProductionTaskRoutePolicy({
  ...paymentTask,
  material_refs: paymentTask.material_refs.map((material, index) => index === 0
    ? { ...material, media_type: "application/json" }
    : material),
}), /AGENT_ROUTE_MATERIAL_SET_INVALID/u);
assert.throws(() => assertRouteResultPayload(paymentTask, {
  ...outputFor(paymentTask, paymentRoute), forbidden_extra: true,
}), /PAYMENT_OBSERVATION_FIELDS_INVALID/u);

const publicRoute = productionRoutePolicies.find((route) => route.product_id === "public_knowledge_article_pipeline"
  && route.action_id === "produce_article")!;
const publicTask = taskFor(publicRoute);
assert.throws(() => assertRouteResultPayload(publicTask, {
  ...outputFor(publicTask, publicRoute), image: null,
}), /PUBLIC_KNOWLEDGE_PACKAGE_COMPLETENESS_INVALID/u);

const reviewRoute = productionRoutePolicies.find((route) => route.action_id === "accuracy_challenge")!;
const reviewTask = taskFor(reviewRoute);
assert.throws(() => assertRouteResultPayload(reviewTask, {
  decision: "issues",
  issues: [{ category: "missing_input", target_type: "task", target_ref: "task:1", observation: "missing",
    evidence_refs: [], impact: "high", confidence: "high", suggested_inspection: "inspect" }],
}), /AGENT_REVIEW_EVIDENCE_REQUIRED/u);

process.stdout.write("[ACCEPTANCE][agent-route-contract] PASS 39/39\n");
