import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

const exactTextObject = (
  value: unknown,
  keys: readonly string[],
  code: string,
): Record<string, unknown> => {
  const row = result.object(value, code);
  result.exact(row, keys, code);
  return row;
};

const citations = (value: unknown, code: string): void => {
  for (const candidate of result.array(value, code)) {
    const citation = exactTextObject(candidate, ["citation_id", "book_id", "locator"], code);
    if (!/^\[?[SC][1-9][0-9]*\]?$/iu.test(result.text(citation.citation_id, code))) throw new Error(code);
    result.text(citation.book_id, code);
    result.text(citation.locator, code);
  }
};

const topicManifest = (value: unknown): void => {
  const topic = exactTextObject(value, [
    "primary_question", "answer_scope", "excluded_scope", "primary_cluster_id",
    "secondary_cluster_ids", "reader_level", "concept_keys", "relation_keys", "method_scope",
  ], "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  for (const field of ["primary_question", "answer_scope", "excluded_scope", "primary_cluster_id"] as const) {
    result.text(topic[field], "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  }
  if (!["introductory", "intermediate", "advanced"].includes(String(topic.reader_level))) {
    throw new Error("PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  }
  for (const field of ["secondary_cluster_ids", "concept_keys", "relation_keys", "method_scope"] as const) {
    result.stringArray(topic[field], "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  }
};

const researchCollections = (output: Readonly<Record<string, unknown>>): void => {
  citations(output.citations, "PUBLIC_KNOWLEDGE_RESEARCH_CITATIONS_INVALID");
  result.stringArray(output.closest_existing_article_ids, "PUBLIC_KNOWLEDGE_CLOSEST_ARTICLES_INVALID");
  for (const candidate of result.array(output.uncertainties, "PUBLIC_KNOWLEDGE_UNCERTAINTIES_INVALID")) {
    const uncertainty = exactTextObject(candidate, ["uncertainty_id", "topic", "status", "detail", "impact"], "PUBLIC_KNOWLEDGE_UNCERTAINTY_INVALID");
    for (const field of ["uncertainty_id", "topic", "detail", "impact"] as const) result.text(uncertainty[field], "PUBLIC_KNOWLEDGE_UNCERTAINTY_INVALID");
    if (!["resolved", "open", "conflicting"].includes(String(uncertainty.status))) throw new Error("PUBLIC_KNOWLEDGE_UNCERTAINTY_INVALID");
  }
  const claimKinds = new Set(["definition", "relationship", "method", "condition", "exception", "comparison", "disagreement", "warning", "boundary", "uncertainty", "source_exegesis"]);
  for (const candidate of result.array(output.research_claim_units, "PUBLIC_KNOWLEDGE_RESEARCH_CLAIMS_INVALID")) {
    const claim = exactTextObject(candidate, ["claim_id", "claim_kind", "summary", "conditions", "exceptions", "supporting_citations", "counter_citations", "uncertainty_refs"], "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
    result.text(claim.claim_id, "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
    result.text(claim.summary, "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
    if (!claimKinds.has(String(claim.claim_kind))) throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
    for (const field of ["conditions", "exceptions", "supporting_citations", "counter_citations", "uncertainty_refs"] as const) {
      result.stringArray(claim[field], "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
    }
  }
  const relationKinds = new Set(["prerequisite", "broader_question", "narrower_question", "contrast", "exception", "source_disagreement", "method_alternative", "common_error"]);
  for (const candidate of result.array(output.relation_assertions, "PUBLIC_KNOWLEDGE_RELATIONS_INVALID")) {
    const relation = exactTextObject(candidate, ["target_article_id", "relation_kind", "supporting_claim_ids"], "PUBLIC_KNOWLEDGE_RELATION_INVALID");
    result.text(relation.target_article_id, "PUBLIC_KNOWLEDGE_RELATION_INVALID");
    if (!relationKinds.has(String(relation.relation_kind))) throw new Error("PUBLIC_KNOWLEDGE_RELATION_INVALID");
    result.stringArray(relation.supporting_claim_ids, "PUBLIC_KNOWLEDGE_RELATION_INVALID", true);
  }
};

export const parsePublicKnowledgeResearch = (raw: string): Readonly<Record<string, unknown>> => {
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH");
  result.exact(output as Record<string, unknown>, ["schema_version", "decision", "topic_manifest", "editorial_intent", "catalog_comparison_note", "research_markdown", "citations", "uncertainties", "research_claim_units", "closest_existing_article_ids", "relation_assertions", "novelty_basis"], "PUBLIC_KNOWLEDGE_RESEARCH_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-research-output.v3"
    || (output.decision !== "proceed" && output.decision !== "decline")) throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  for (const field of ["editorial_intent", "catalog_comparison_note", "research_markdown", "novelty_basis"] as const) {
    result.text(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  if (!["independent_question", "narrower_condition", "broader_scope", "new_relationship", "new_source_conflict", "new_method_boundary", "new_source_exegesis", "not_applicable"].includes(String(output.novelty_basis))) {
    throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  topicManifest(output.topic_manifest);
  researchCollections(output);
  return Object.freeze(output);
};

export const parsePublicKnowledgeArticle = (raw: string): Readonly<Record<string, unknown>> => {
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE");
  result.exact(output as Record<string, unknown>, ["schema_version", "title", "editor_note", "article_markdown", "citations", "claim_coverage", "safety_notes"], "PUBLIC_KNOWLEDGE_ARTICLE_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-article-output.v3") throw new Error("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const field of ["title", "editor_note", "article_markdown"] as const) result.text(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  citations(output.citations, "PUBLIC_KNOWLEDGE_ARTICLE_CITATIONS_INVALID");
  result.stringArray(output.safety_notes, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const candidate of result.array(output.claim_coverage, "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID")) {
    const coverage = exactTextObject(candidate, ["claim_id", "status", "reason_if_omitted"], "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID");
    result.text(coverage.claim_id, "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID");
    if (coverage.status === "addressed") {
      if (coverage.reason_if_omitted !== null) throw new Error("PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID");
    } else if (coverage.status === "intentionally_omitted") {
      result.text(coverage.reason_if_omitted, "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID");
    } else throw new Error("PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID");
  }
  return Object.freeze(output);
};

const validatePublicKnowledgeImage = (value: unknown): void => {
  const image = result.object(value, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
  result.exact(image, ["schema_version", "artifact_id", "object_ref", "sha256", "receipt_hash", "bytes", "mime_type", "width", "height"], "PUBLIC_KNOWLEDGE_IMAGE_FIELDS_INVALID");
  if (image.schema_version !== "public-knowledge-agent-hero-image.v1" || image.mime_type !== "image/webp"
    || image.width !== 1200 || image.height !== 630 || !Number.isSafeInteger(image.bytes)
    || Number(image.bytes) < 1) throw new Error("PUBLIC_KNOWLEDGE_IMAGE_INVALID");
  result.text(image.artifact_id, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
  result.text(image.object_ref, "PUBLIC_KNOWLEDGE_IMAGE_INVALID");
  result.hash(image.sha256, "PUBLIC_KNOWLEDGE_IMAGE_HASH_INVALID");
  result.hash(image.receipt_hash, "PUBLIC_KNOWLEDGE_IMAGE_RECEIPT_INVALID");
};

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "public_knowledge_article_pipeline") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "research", "article", "image"], "PUBLIC_KNOWLEDGE_PACKAGE_FIELDS_INVALID");
  const research = result.object(output.research, "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  parsePublicKnowledgeResearch(JSON.stringify(research));
  if ((research.decision === "decline" && (output.article !== null || output.image !== null))
    || (research.decision === "proceed" && (!output.article || (phase === "final" && !output.image)))) {
    throw new Error("PUBLIC_KNOWLEDGE_PACKAGE_COMPLETENESS_INVALID");
  }
  if (output.article) parsePublicKnowledgeArticle(JSON.stringify(result.object(output.article, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID")));
  if (output.image) validatePublicKnowledgeImage(output.image);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"), "final");
