import type { WebsiteAgentTask } from "../lib/local-runtime/production/contracts.js";
import { productionRoutePolicy } from "../lib/local-runtime/production/route-policy.js";
import { parsePluginJsonObject } from "../lib/local-runtime/production/plugin.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

const object = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
};

const exact = (value: Record<string, unknown>, keys: readonly string[], code: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(code);
  }
};

const text = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim() || value.includes("\uFFFD")) throw new Error(code);
  return value;
};

const stringArray = (value: unknown, code: string, nonempty = false): readonly string[] => {
  if (!Array.isArray(value) || (nonempty && value.length === 0)
    || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(code);
  return value as string[];
};

const array = (value: unknown, code: string, nonempty = false): readonly unknown[] => {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) throw new Error(code);
  return value;
};

const dual = (value: unknown, code: string): void => {
  const row = object(value, code);
  exact(row, ["professional_markdown", "reader_explanation_markdown"], code);
  text(row.professional_markdown, code);
  text(row.reader_explanation_markdown, code);
};

const hash = (value: unknown, code: string): void => {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(code);
};

const commonReport = (output: Record<string, unknown>, summary: string, blocks: string): void => {
  dual(output[summary], "AGENT_RESULT_DUAL_LAYER_INVALID");
  array(output[blocks], "AGENT_RESULT_BLOCKS_INVALID", true);
  array(output.citations, "AGENT_RESULT_CITATIONS_INVALID");
  stringArray(output.uncertainties, "AGENT_RESULT_UNCERTAINTIES_INVALID");
  stringArray(output.limitations, "AGENT_RESULT_LIMITATIONS_INVALID");
  stringArray(output.safety_notes, "AGENT_RESULT_SAFETY_NOTES_INVALID");
};

const assertLocked = (output: Record<string, unknown>, task: WebsiteAgentTask, fields: readonly string[]): void => {
  for (const field of fields) {
    if (output[field] !== task.parameters[field]) throw new Error(`AGENT_RESULT_LOCKED_IDENTITY_INVALID:${field}`);
  }
};

export function parseReviewOutput(raw: string): Readonly<Record<string, unknown>> {
  const output = parsePluginJsonObject(raw, "AGENT_REVIEW_OUTPUT");
  exact(output as Record<string, unknown>, ["decision", "issues"], "AGENT_REVIEW_OUTPUT_FIELDS_INVALID");
  const decision = output.decision;
  const issues = array(output.issues, "AGENT_REVIEW_ISSUES_INVALID");
  if ((decision === "no_issue" && issues.length !== 0)
    || (decision === "issues" && (issues.length < 1 || issues.length > 50))
    || (decision !== "no_issue" && decision !== "issues")) throw new Error("AGENT_REVIEW_DECISION_INVALID");
  const categories = new Set([
    "source_text_possible_error", "index_navigation_friction", "missing_condition_or_exception",
    "citation_locator_problem", "prompt_ambiguity", "missing_input", "output_contract_friction",
    "reasoning_depth_gap", "safety_boundary_conflict", "conversation_context_loss",
    "provider_or_tooling_issue",
  ]);
  for (const rawIssue of issues) {
    const issue = object(rawIssue, "AGENT_REVIEW_ISSUE_INVALID");
    exact(issue, ["category", "target_type", "target_ref", "observation", "evidence_refs", "impact", "confidence", "suggested_inspection"], "AGENT_REVIEW_ISSUE_FIELDS_INVALID");
    if (!categories.has(text(issue.category, "AGENT_REVIEW_CATEGORY_INVALID"))
      || !["low", "medium", "high"].includes(String(issue.confidence))) throw new Error("AGENT_REVIEW_ISSUE_INVALID");
    for (const field of ["target_type", "target_ref", "observation", "impact", "suggested_inspection"] as const) {
      text(issue[field], "AGENT_REVIEW_ISSUE_INVALID");
    }
    stringArray(issue.evidence_refs, "AGENT_REVIEW_EVIDENCE_REQUIRED", true);
  }
  return Object.freeze(output);
}

export function parsePublicKnowledgeResearch(raw: string): Readonly<Record<string, unknown>> {
  const output = parsePluginJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH");
  exact(output as Record<string, unknown>, ["schema_version", "decision", "topic_manifest", "editorial_intent", "catalog_comparison_note", "research_markdown", "citations", "uncertainties", "research_claim_units", "closest_existing_article_ids", "relation_assertions", "novelty_basis"], "PUBLIC_KNOWLEDGE_RESEARCH_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-research-output.v3"
    || (output.decision !== "proceed" && output.decision !== "decline")) throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  for (const field of ["editorial_intent", "catalog_comparison_note", "research_markdown", "novelty_basis"] as const) {
    text(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  for (const field of ["citations", "uncertainties", "research_claim_units", "closest_existing_article_ids", "relation_assertions"] as const) {
    array(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  object(output.topic_manifest, "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  return Object.freeze(output);
}

export function parsePublicKnowledgeArticle(raw: string): Readonly<Record<string, unknown>> {
  const output = parsePluginJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE");
  exact(output as Record<string, unknown>, ["schema_version", "title", "editor_note", "article_markdown", "citations", "claim_coverage", "safety_notes"], "PUBLIC_KNOWLEDGE_ARTICLE_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-article-output.v3") throw new Error("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const field of ["title", "editor_note", "article_markdown"] as const) text(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const field of ["citations", "claim_coverage", "safety_notes"] as const) array(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  return Object.freeze(output);
}

export function assertRouteResultPayload(
  task: WebsiteAgentTask,
  value: unknown,
  phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> {
  const output = object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") {
    return parseReviewOutput(JSON.stringify(value));
  }
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  switch (task.product_id) {
    case "bazi_chart_interpretation":
      exact(output, ["schema_version", "chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref", "manifest_hash", "report_summary", "interpretation_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs"], "BAZI_CHART_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["chart_ref", "chart_version", "chart_hash"]);
      hash(output.manifest_hash, "BAZI_CHART_MANIFEST_HASH_INVALID");
      commonReport(output, "report_summary", "interpretation_blocks");
      stringArray(output.covered_semantic_anchor_refs, "BAZI_CHART_COVERAGE_INVALID", true);
      break;
    case "bazi_ai_full_analysis":
      exact(output, ["schema_version", "question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "BAZI_FULL_RESULT_FIELDS_INVALID");
      commonReport(output, "answer_summary", "answer_blocks");
      stringArray(output.covered_question_unit_refs, "BAZI_FULL_COVERAGE_INVALID", true);
      break;
    case "bazi_report_followup":
      exact(output, ["schema_version", "thread_ref", "parent_report_ref", "parent_raw_output_hash", "new_question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "BAZI_FOLLOWUP_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["thread_ref", "parent_report_ref", "parent_raw_output_hash"]);
      commonReport(output, "answer_summary", "answer_blocks");
      stringArray(output.covered_question_unit_refs, "BAZI_FOLLOWUP_COVERAGE_INVALID", true);
      break;
    case "qimen_professional_answer":
      exact(output, ["schema_version", "question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "index_review_receipts", "covered_question_unit_refs", "covered_candidate_refs"], "QIMEN_RESULT_FIELDS_INVALID");
      commonReport(output, "answer_summary", "answer_blocks");
      array(output.index_review_receipts, "QIMEN_INDEX_REVIEW_INVALID", true);
      stringArray(output.covered_question_unit_refs, "QIMEN_QUESTION_COVERAGE_INVALID", true);
      stringArray(output.covered_candidate_refs, "QIMEN_CANDIDATE_COVERAGE_INVALID", true);
      break;
    case "qimen_report_followup":
      exact(output, ["schema_version", "thread_ref", "parent_report_ref", "parent_raw_output_hash", "continuation_relation", "new_question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "index_review_receipts", "covered_question_unit_refs", "covered_candidate_refs"], "QIMEN_FOLLOWUP_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["parent_report_ref", "parent_raw_output_hash"]);
      if (output.thread_ref !== task.continuation_ref || output.continuation_relation !== "same_conversation_followup") throw new Error("QIMEN_FOLLOWUP_RELATION_INVALID");
      commonReport(output, "answer_summary", "answer_blocks");
      array(output.index_review_receipts, "QIMEN_INDEX_REVIEW_INVALID", true);
      stringArray(output.covered_question_unit_refs, "QIMEN_QUESTION_COVERAGE_INVALID", true);
      stringArray(output.covered_candidate_refs, "QIMEN_CANDIDATE_COVERAGE_INVALID", true);
      break;
    case "hehun_ai_analysis":
      exact(output, ["schema_version", "case_manifest_ref", "case_manifest_hash", "question_snapshot", "relationship_summary", "relationship_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "HEHUN_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["case_manifest_ref", "case_manifest_hash"]);
      commonReport(output, "relationship_summary", "relationship_blocks");
      stringArray(output.covered_question_unit_refs, "HEHUN_COVERAGE_INVALID", true);
      break;
    case "hehun_report_followup":
      exact(output, ["schema_version", "thread_ref", "parent_report_ref", "parent_raw_output_hash", "new_question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "HEHUN_FOLLOWUP_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["thread_ref", "parent_report_ref", "parent_raw_output_hash"]);
      commonReport(output, "answer_summary", "answer_blocks");
      stringArray(output.covered_question_unit_refs, "HEHUN_FOLLOWUP_COVERAGE_INVALID", true);
      break;
    case "naming_from_existing_bazi_report":
      exact(output, ["schema_version", "requirement_manifest_ref", "requirement_manifest_hash", "naming_rationale", "candidates", "comparison_or_selection_rationale", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"], "NAMING_RESULT_FIELDS_INVALID");
      assertLocked(output, task, ["requirement_manifest_ref", "requirement_manifest_hash"]);
      dual(output.naming_rationale, "NAMING_RATIONALE_INVALID");
      dual(output.comparison_or_selection_rationale, "NAMING_COMPARISON_INVALID");
      array(output.candidates, "NAMING_CANDIDATES_INVALID", true);
      stringArray(output.uncertainties, "NAMING_UNCERTAINTIES_INVALID");
      stringArray(output.limitations, "NAMING_LIMITATIONS_INVALID");
      stringArray(output.safety_notes, "NAMING_SAFETY_INVALID");
      stringArray(output.covered_requirement_anchor_refs, "NAMING_COVERAGE_INVALID", true);
      break;
    case "naming_bazi_analysis_and_naming": {
      exact(output, ["schema_version", "bazi_analysis", "naming"], "NAMING_COMBINED_RESULT_FIELDS_INVALID");
      const bazi = object(output.bazi_analysis, "NAMING_BAZI_RESULT_INVALID");
      exact(bazi, ["schema_version", "chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref", "manifest_hash", "naming_requirement_manifest_ref", "naming_requirement_manifest_hash", "report_summary", "interpretation_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs", "covered_requirement_anchor_refs"], "NAMING_BAZI_RESULT_FIELDS_INVALID");
      if (bazi.schema_version !== "bazi-naming-basis-report-output.v1") throw new Error("NAMING_BAZI_SCHEMA_INVALID");
      for (const field of ["chart_ref", "chart_version", "chart_hash"] as const) {
        if (bazi[field] !== task.parameters[field]) throw new Error(`NAMING_BAZI_LOCKED_IDENTITY_INVALID:${field}`);
      }
      hash(bazi.manifest_hash, "NAMING_BAZI_MANIFEST_HASH_INVALID");
      hash(bazi.naming_requirement_manifest_hash, "NAMING_REQUIREMENT_HASH_INVALID");
      commonReport(bazi, "report_summary", "interpretation_blocks");
      stringArray(bazi.covered_semantic_anchor_refs, "NAMING_BAZI_COVERAGE_INVALID", true);
      stringArray(bazi.covered_requirement_anchor_refs, "NAMING_REQUIREMENT_COVERAGE_INVALID", true);
      const naming = object(output.naming, "NAMING_RESULT_INVALID");
      exact(naming, ["schema_version", "requirement_manifest_ref", "requirement_manifest_hash", "naming_rationale", "candidates", "comparison_or_selection_rationale", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"], "NAMING_RESULT_FIELDS_INVALID");
      if (naming.schema_version !== "naming-report-output.v2"
        || naming.requirement_manifest_ref !== bazi.naming_requirement_manifest_ref
        || naming.requirement_manifest_hash !== bazi.naming_requirement_manifest_hash) throw new Error("NAMING_SCHEMA_INVALID");
      dual(naming.naming_rationale, "NAMING_RATIONALE_INVALID");
      dual(naming.comparison_or_selection_rationale, "NAMING_COMPARISON_INVALID");
      array(naming.candidates, "NAMING_CANDIDATES_INVALID", true);
      stringArray(naming.uncertainties, "NAMING_UNCERTAINTIES_INVALID");
      stringArray(naming.limitations, "NAMING_LIMITATIONS_INVALID");
      stringArray(naming.safety_notes, "NAMING_SAFETY_INVALID");
      stringArray(naming.covered_requirement_anchor_refs, "NAMING_COVERAGE_INVALID", true);
      break;
    }
    case "public_knowledge_article_pipeline": {
      exact(output, ["schema_version", "research", "article", "image"], "PUBLIC_KNOWLEDGE_PACKAGE_FIELDS_INVALID");
      const research = object(output.research, "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
      parsePublicKnowledgeResearch(JSON.stringify(research));
      if ((research.decision === "decline" && (output.article !== null || output.image !== null))
        || (research.decision === "proceed" && (!output.article || (phase === "final" && !output.image)))) throw new Error("PUBLIC_KNOWLEDGE_PACKAGE_COMPLETENESS_INVALID");
      if (output.article) {
        const article = object(output.article, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
        parsePublicKnowledgeArticle(JSON.stringify(article));
      }
      if (output.image) {
        const image = object(output.image, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
        exact(image, ["schema_version", "artifact_id", "object_ref", "sha256", "receipt_hash", "bytes", "mime_type", "width", "height"], "PUBLIC_KNOWLEDGE_IMAGE_FIELDS_INVALID");
        if (image.schema_version !== "public-knowledge-agent-hero-image.v1" || image.mime_type !== "image/webp"
          || image.width !== 1200 || image.height !== 630 || !Number.isSafeInteger(image.bytes)
          || Number(image.bytes) < 1) throw new Error("PUBLIC_KNOWLEDGE_IMAGE_INVALID");
        text(image.artifact_id, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
        text(image.object_ref, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
        hash(image.sha256, "PUBLIC_KNOWLEDGE_IMAGE_HASH_INVALID");
        hash(image.receipt_hash, "PUBLIC_KNOWLEDGE_IMAGE_RECEIPT_INVALID");
      }
      break;
    }
    case "localization_report_translation":
    case "localization_article_translation":
      exact(output, ["schema_version", "action_id", "source_resource_id", "source_version", "source_sha256", "target_locale", "localized_structured_payload"], "LOCALIZATION_RESULT_FIELDS_INVALID");
      if (output.action_id !== task.product_id) throw new Error("LOCALIZATION_ACTION_ID_INVALID");
      assertLocked(output, task, ["source_resource_id", "source_version", "source_sha256", "target_locale"]);
      break;
    case "payment_screenshot_observation":
      exact(output, ["schema_version", "page_kind", "payment_app", "success_visible", "visible_amount_minor_units", "reason_code"], "PAYMENT_OBSERVATION_FIELDS_INVALID");
      if (!["payment_success", "other"].includes(String(output.page_kind))
        || !["alipay", "wechat", "unknown"].includes(String(output.payment_app))
        || typeof output.success_visible !== "boolean"
        || !(output.visible_amount_minor_units === null || Number.isSafeInteger(output.visible_amount_minor_units))) throw new Error("PAYMENT_OBSERVATION_INVALID");
      text(output.reason_code, "PAYMENT_OBSERVATION_REASON_INVALID");
      break;
  }
  return Object.freeze(output);
}

export const parseProductResult = assertRouteResultPayload;

export function parseRouteResult(task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> {
  if (task.action_id === "accuracy_challenge" || task.action_id === "quality_reflection") {
    return parseReviewOutput(raw);
  }
  return assertRouteResultPayload(task, parsePluginJsonObject(raw, "AGENT_ROUTE_RESULT"));
}
