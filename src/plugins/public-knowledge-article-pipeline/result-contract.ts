import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

type ContractObject = Readonly<Record<string, unknown>>;
export type PublicKnowledgeReceptionReceipt = Readonly<{
  jobId: string;
  attemptId: string;
  turnMarker: string;
  assistantTurnId: string;
  artifactRef: string;
  rawDomHash: string;
  semanticTextHash: string;
}>;

type NormalizationStep = Readonly<{
  path: string;
  from: "string" | "string[]" | "object";
  to: "string" | "string[]" | "object[]";
}>;

export type PublicKnowledgeReceptionTrace = Readonly<{
  schema_version: "agent-lossless-normalization.v1";
  job_id: string | null;
  attempt_id: string | null;
  turn_marker: string | null;
  assistant_turn_id: string | null;
  artifact_ref: string | null;
  raw_dom_hash: string | null;
  semantic_text_hash: string | null;
  transformations: readonly NormalizationStep[];
}>;

const receptionByOutput = new WeakMap<object, PublicKnowledgeReceptionTrace>();

const RESEARCH_STRING_ARRAY_PATHS = new Set([
  "topic_manifest.secondary_cluster_ids",
  "topic_manifest.concept_keys",
  "topic_manifest.relation_keys",
  "topic_manifest.method_scope",
  "closest_existing_article_ids",
  "research_claim_units.*.conditions",
  "research_claim_units.*.exceptions",
  "research_claim_units.*.supporting_citations",
  "research_claim_units.*.counter_citations",
  "research_claim_units.*.uncertainty_refs",
  "relation_assertions.*.supporting_claim_ids",
]);

const RESEARCH_OBJECT_ARRAY_PATHS = new Set([
  "citations", "uncertainties", "research_claim_units", "relation_assertions",
]);

const RESEARCH_STRING_PATHS = new Set([
  "schema_version", "decision", "editorial_intent", "catalog_comparison_note", "research_markdown",
  "novelty_basis", "topic_manifest.primary_question", "topic_manifest.answer_scope",
  "topic_manifest.excluded_scope", "topic_manifest.primary_cluster_id", "topic_manifest.reader_level",
  "citations.*.citation_id", "citations.*.book_id", "citations.*.locator",
  "uncertainties.*.uncertainty_id", "uncertainties.*.topic", "uncertainties.*.status",
  "uncertainties.*.detail", "uncertainties.*.impact", "research_claim_units.*.claim_id",
  "research_claim_units.*.claim_kind", "research_claim_units.*.summary",
  "relation_assertions.*.target_article_id", "relation_assertions.*.relation_kind",
]);

const ARTICLE_STRING_ARRAY_PATHS = new Set(["safety_notes"]);
const ARTICLE_OBJECT_ARRAY_PATHS = new Set(["citations", "claim_coverage"]);
const ARTICLE_STRING_PATHS = new Set([
  "schema_version", "title", "editor_note", "article_markdown",
  "citations.*.citation_id", "citations.*.book_id", "citations.*.locator",
  "claim_coverage.*.claim_id", "claim_coverage.*.status", "claim_coverage.*.reason_if_omitted",
]);

const contractObject = (value: unknown, code: string): ContractObject => result.object(value, code);
const contractText = (contract: ContractObject, key: string, code: string): string =>
  result.text(contract[key], code);
const contractFields = (contract: ContractObject, code: string): readonly string[] =>
  result.stringArray(contract.exact_fields, code, true);
const contractValues = (contract: ContractObject, key: string, code: string): readonly string[] =>
  result.stringArray(contract[key], code, true);
const contractSection = (contract: ContractObject, key: string, code: string): ContractObject =>
  contractObject(contract[key], code);

const publicKnowledgeResultContract = (): ContractObject => {
  const route = productionRoutePolicy("public_knowledge_article_pipeline", "produce_article");
  const contract = contractObject(route.result_contract, "PUBLIC_KNOWLEDGE_RESULT_CONTRACT_MISSING");
  result.exact(contract as Record<string, unknown>, [
    "schema_version", "package", "research", "article", "image",
  ], "PUBLIC_KNOWLEDGE_RESULT_CONTRACT_INVALID");
  if (contract.schema_version !== "public-knowledge-article-package-contract.v1") {
    result.fail("PUBLIC_KNOWLEDGE_RESULT_CONTRACT_INVALID");
  }
  return contract;
};

export const publicKnowledgeTurnContract = (turn: "research" | "article"): ContractObject =>
  contractSection(publicKnowledgeResultContract(), turn, "PUBLIC_KNOWLEDGE_TURN_CONTRACT_MISSING");

const normalizeTurn = (
  input: Readonly<Record<string, unknown>>,
  receipt: PublicKnowledgeReceptionReceipt | undefined,
  stringArrayPaths: ReadonlySet<string>,
  objectArrayPaths: ReadonlySet<string>,
  stringPaths: ReadonlySet<string>,
): Readonly<Record<string, unknown>> => {
  const transformations: NormalizationStep[] = [];
  const visit = (value: unknown, actualPath: string, schemaPath: string): unknown => {
    let normalized = value;
    if (stringArrayPaths.has(schemaPath) && typeof normalized === "string") {
      normalized = [normalized];
      transformations.push({ path: actualPath, from: "string", to: "string[]" });
    } else if (objectArrayPaths.has(schemaPath)
      && normalized !== null && typeof normalized === "object" && !Array.isArray(normalized)) {
      normalized = [normalized];
      transformations.push({ path: actualPath, from: "object", to: "object[]" });
    } else if (stringPaths.has(schemaPath) && Array.isArray(normalized)
      && normalized.length === 1 && typeof normalized[0] === "string") {
      normalized = normalized[0];
      transformations.push({ path: actualPath, from: "string[]", to: "string" });
    }
    if (Array.isArray(normalized)) {
      return normalized.map((item, index) => visit(
        item, `${actualPath}[${index}]`, schemaPath ? `${schemaPath}.*` : "*",
      ));
    }
    if (normalized !== null && typeof normalized === "object") {
      return Object.fromEntries(Object.entries(normalized as Record<string, unknown>).map(([key, item]) => [
        key,
        visit(item, actualPath ? `${actualPath}.${key}` : key, schemaPath ? `${schemaPath}.${key}` : key),
      ]));
    }
    return normalized;
  };
  const normalized = Object.freeze(visit(input, "", "") as Record<string, unknown>);
  receptionByOutput.set(normalized, Object.freeze({
    schema_version: "agent-lossless-normalization.v1",
    job_id: receipt?.jobId ?? null,
    attempt_id: receipt?.attemptId ?? null,
    turn_marker: receipt?.turnMarker ?? null,
    assistant_turn_id: receipt?.assistantTurnId ?? null,
    artifact_ref: receipt?.artifactRef ?? null,
    raw_dom_hash: receipt?.rawDomHash ?? null,
    semantic_text_hash: receipt?.semanticTextHash ?? null,
    transformations: Object.freeze(transformations),
  }));
  return normalized;
};

export const publicKnowledgeReceptionOf = (
  output: Readonly<Record<string, unknown>>,
): PublicKnowledgeReceptionTrace => receptionByOutput.get(output) ?? Object.freeze({
  schema_version: "agent-lossless-normalization.v1",
  job_id: null,
  attempt_id: null,
  turn_marker: null,
  assistant_turn_id: null,
  artifact_ref: null,
  raw_dom_hash: null,
  semantic_text_hash: null,
  transformations: Object.freeze([]),
  });

export const parsePublicKnowledgeResearch = (
  raw: string,
  receipt?: PublicKnowledgeReceptionReceipt,
): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract("research");
  const output = normalizeTurn(
    result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH"), receipt,
    RESEARCH_STRING_ARRAY_PATHS, RESEARCH_OBJECT_ARRAY_PATHS, RESEARCH_STRING_PATHS,
  );
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
    || !contractValues(contract, "decision_values", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
      .includes(String(output.decision))) {
    result.fail("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  return Object.freeze(output);
};

export const parsePublicKnowledgeArticle = (
  raw: string,
  receipt?: PublicKnowledgeReceptionReceipt,
): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract("article");
  const output = normalizeTurn(
    result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE"), receipt,
    ARTICLE_STRING_ARRAY_PATHS, ARTICLE_OBJECT_ARRAY_PATHS, ARTICLE_STRING_PATHS,
  );
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID")) {
    result.fail("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  return Object.freeze(output);
};

const validatePublicKnowledgeImage = (value: unknown): void => {
  const code = "PUBLIC_KNOWLEDGE_IMAGE_INVALID";
  const contract = contractSection(publicKnowledgeResultContract(), "image", code);
  const image = result.object(value, code);
  if (image.schema_version !== contractText(contract, "schema_version", code)
    || image.mime_type !== contractText(contract, "mime_type", code)
    || image.width !== contract.width || image.height !== contract.height
    || !Number.isSafeInteger(image.bytes) || Number(image.bytes) < 1) result.fail(code);
  result.text(image.artifact_id, code);
  result.text(image.object_ref, code);
  result.hash(image.sha256, "PUBLIC_KNOWLEDGE_IMAGE_HASH_INVALID");
  result.hash(image.receipt_hash, "PUBLIC_KNOWLEDGE_IMAGE_RECEIPT_INVALID");
};

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "public_knowledge_article_pipeline") result.fail("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return Object.freeze(
    result.object(value, "PUBLIC_KNOWLEDGE_REVIEW_OBJECT_REQUIRED"),
  );
  const contract = publicKnowledgeResultContract();
  const packageContract = contractSection(contract, "package", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID");
  const output = result.object(value, "PUBLIC_KNOWLEDGE_PACKAGE_INVALID");
  if (output.schema_version !== route.result_schema_version
    || output.schema_version !== contractText(packageContract, "schema_version", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID")) {
    result.fail("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  }
  const research = result.object(output.research, "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  const researchContract = publicKnowledgeTurnContract("research");
  if (research.schema_version !== contractText(
    researchContract, "schema_version", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID",
  ) || !contractValues(
    researchContract, "decision_values", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID",
  ).includes(String(research.decision))) result.fail("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  const nullFields = contractValues(
    packageContract, "decline_requires_null", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID",
  );
  const nonNullFields = contractValues(
    packageContract, "proceed_requires_non_null", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID",
  );
  if ((research.decision === "decline" && nullFields.some((field) => output[field] !== null))
    || (research.decision === "proceed"
      && (!output.article || (phase === "final" && nonNullFields.some((field) => !output[field]))))) {
    result.fail("PUBLIC_KNOWLEDGE_PACKAGE_COMPLETENESS_INVALID");
  }
  if (output.article) {
    const article = result.object(output.article, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
    const articleContract = publicKnowledgeTurnContract("article");
    if (article.schema_version !== contractText(
      articleContract, "schema_version", "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID",
    )) result.fail("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  if (output.image) validatePublicKnowledgeImage(output.image);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"), "final");
