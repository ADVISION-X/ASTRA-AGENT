import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parsePublicKnowledgeResearch = (raw: string): Readonly<Record<string, unknown>> => {
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH");
  result.exact(output as Record<string, unknown>, ["schema_version", "decision", "topic_manifest", "editorial_intent", "catalog_comparison_note", "research_markdown", "citations", "uncertainties", "research_claim_units", "closest_existing_article_ids", "relation_assertions", "novelty_basis"], "PUBLIC_KNOWLEDGE_RESEARCH_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-research-output.v3"
    || (output.decision !== "proceed" && output.decision !== "decline")) throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  for (const field of ["editorial_intent", "catalog_comparison_note", "research_markdown", "novelty_basis"] as const) {
    result.text(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  for (const field of ["citations", "uncertainties", "research_claim_units", "closest_existing_article_ids", "relation_assertions"] as const) {
    result.array(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  result.object(output.topic_manifest, "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID");
  return Object.freeze(output);
};

export const parsePublicKnowledgeArticle = (raw: string): Readonly<Record<string, unknown>> => {
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE");
  result.exact(output as Record<string, unknown>, ["schema_version", "title", "editor_note", "article_markdown", "citations", "claim_coverage", "safety_notes"], "PUBLIC_KNOWLEDGE_ARTICLE_FIELDS_INVALID");
  if (output.schema_version !== "public-knowledge-article-output.v3") throw new Error("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const field of ["title", "editor_note", "article_markdown"] as const) result.text(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  for (const field of ["citations", "claim_coverage", "safety_notes"] as const) result.array(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
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
