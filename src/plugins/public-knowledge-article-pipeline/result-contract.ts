import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

type ContractObject = Readonly<Record<string, unknown>>;

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
    throw new Error("PUBLIC_KNOWLEDGE_RESULT_CONTRACT_INVALID");
  }
  return contract;
};

export const publicKnowledgeTurnContract = (turn: "research" | "article"): ContractObject =>
  contractSection(publicKnowledgeResultContract(), turn, "PUBLIC_KNOWLEDGE_TURN_CONTRACT_MISSING");

const exactTextObject = (
  value: unknown,
  contract: ContractObject,
  code: string,
): Record<string, unknown> => {
  const row = result.object(value, code);
  result.exact(row, contractFields(contract, code), code);
  return row;
};

const citations = (value: unknown, researchContract: ContractObject, code: string): void => {
  const citationContract = contractSection(researchContract, "citation", code);
  for (const candidate of result.array(value, code)) {
    const citation = exactTextObject(candidate, citationContract, code);
    if (!/^\[?[SC][1-9][0-9]*\]?$/iu.test(result.text(citation.citation_id, code))) throw new Error(code);
    result.text(citation.book_id, code);
    result.text(citation.locator, code);
  }
};

const topicManifest = (value: unknown, researchContract: ContractObject): void => {
  const code = "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID";
  const topicContract = contractSection(researchContract, "topic_manifest", code);
  const topic = exactTextObject(value, topicContract, code);
  for (const field of ["primary_question", "answer_scope", "excluded_scope", "primary_cluster_id"] as const) {
    result.text(topic[field], code);
  }
  if (!contractValues(topicContract, "reader_level_values", code).includes(String(topic.reader_level))) {
    throw new Error(code);
  }
  for (const field of ["secondary_cluster_ids", "concept_keys", "relation_keys", "method_scope"] as const) {
    result.stringArray(topic[field], code);
  }
};

const researchCollections = (
  output: Readonly<Record<string, unknown>>,
  researchContract: ContractObject,
): void => {
  citations(output.citations, researchContract, "PUBLIC_KNOWLEDGE_RESEARCH_CITATIONS_INVALID");
  result.stringArray(output.closest_existing_article_ids, "PUBLIC_KNOWLEDGE_CLOSEST_ARTICLES_INVALID");
  const uncertaintyContract = contractSection(
    researchContract, "uncertainty", "PUBLIC_KNOWLEDGE_UNCERTAINTY_INVALID",
  );
  for (const candidate of result.array(output.uncertainties, "PUBLIC_KNOWLEDGE_UNCERTAINTIES_INVALID")) {
    const code = "PUBLIC_KNOWLEDGE_UNCERTAINTY_INVALID";
    const uncertainty = exactTextObject(candidate, uncertaintyContract, code);
    for (const field of ["uncertainty_id", "topic", "detail", "impact"] as const) result.text(uncertainty[field], code);
    if (!contractValues(uncertaintyContract, "status_values", code).includes(String(uncertainty.status))) {
      throw new Error(code);
    }
  }
  const claimContract = contractSection(researchContract, "claim", "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID");
  const claimKinds = new Set(contractValues(
    claimContract, "claim_kind_values", "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID",
  ));
  for (const candidate of result.array(output.research_claim_units, "PUBLIC_KNOWLEDGE_RESEARCH_CLAIMS_INVALID")) {
    const code = "PUBLIC_KNOWLEDGE_RESEARCH_CLAIM_INVALID";
    const claim = exactTextObject(candidate, claimContract, code);
    result.text(claim.claim_id, code);
    result.text(claim.summary, code);
    if (!claimKinds.has(String(claim.claim_kind))) throw new Error(code);
    for (const field of ["conditions", "exceptions", "supporting_citations", "counter_citations", "uncertainty_refs"] as const) {
      result.stringArray(claim[field], code);
    }
  }
  const relationContract = contractSection(researchContract, "relation", "PUBLIC_KNOWLEDGE_RELATION_INVALID");
  const relationKinds = new Set(contractValues(
    relationContract, "relation_kind_values", "PUBLIC_KNOWLEDGE_RELATION_INVALID",
  ));
  for (const candidate of result.array(output.relation_assertions, "PUBLIC_KNOWLEDGE_RELATIONS_INVALID")) {
    const code = "PUBLIC_KNOWLEDGE_RELATION_INVALID";
    const relation = exactTextObject(candidate, relationContract, code);
    result.text(relation.target_article_id, code);
    if (!relationKinds.has(String(relation.relation_kind))) throw new Error(code);
    result.stringArray(relation.supporting_claim_ids, code, true);
  }
};

export const parsePublicKnowledgeResearch = (raw: string): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract("research");
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH");
  result.exact(
    output as Record<string, unknown>,
    contractFields(contract, "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID"),
    "PUBLIC_KNOWLEDGE_RESEARCH_FIELDS_INVALID",
  );
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
    || !contractValues(contract, "decision_values", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
      .includes(String(output.decision))) {
    throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  for (const field of ["editorial_intent", "catalog_comparison_note", "research_markdown", "novelty_basis"] as const) {
    result.text(output[field], "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  if (!contractValues(contract, "novelty_basis_values", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
    .includes(String(output.novelty_basis))) {
    throw new Error("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  topicManifest(output.topic_manifest, contract);
  researchCollections(output, contract);
  return Object.freeze(output);
};

export const parsePublicKnowledgeArticle = (raw: string): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract("article");
  const output = result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE");
  result.exact(
    output as Record<string, unknown>,
    contractFields(contract, "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID"),
    "PUBLIC_KNOWLEDGE_ARTICLE_FIELDS_INVALID",
  );
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID")) {
    throw new Error("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  for (const field of ["title", "editor_note", "article_markdown"] as const) {
    result.text(output[field], "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  citations(output.citations, publicKnowledgeTurnContract("research"), "PUBLIC_KNOWLEDGE_ARTICLE_CITATIONS_INVALID");
  result.stringArray(output.safety_notes, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  const coverageContract = contractSection(
    contract, "claim_coverage", "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID",
  );
  const coverageStatuses = contractValues(
    coverageContract, "status_values", "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID",
  );
  for (const candidate of result.array(output.claim_coverage, "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID")) {
    const code = "PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID";
    const coverage = exactTextObject(candidate, coverageContract, code);
    result.text(coverage.claim_id, code);
    if (!coverageStatuses.includes(String(coverage.status))) throw new Error(code);
    if (coverage.status === "addressed") {
      if (coverage.reason_if_omitted !== null) throw new Error(code);
    } else {
      result.text(coverage.reason_if_omitted, code);
    }
  }
  return Object.freeze(output);
};

const validatePublicKnowledgeImage = (value: unknown): void => {
  const code = "PUBLIC_KNOWLEDGE_IMAGE_INVALID";
  const contract = contractSection(publicKnowledgeResultContract(), "image", code);
  const image = exactTextObject(value, contract, code);
  if (image.schema_version !== contractText(contract, "schema_version", code)
    || image.mime_type !== contractText(contract, "mime_type", code)
    || image.width !== contract.width || image.height !== contract.height
    || !Number.isSafeInteger(image.bytes) || Number(image.bytes) < 1) throw new Error(code);
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
  if (task.product_id !== "public_knowledge_article_pipeline") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const contract = publicKnowledgeResultContract();
  const packageContract = contractSection(contract, "package", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID");
  const output = exactTextObject(value, packageContract, "PUBLIC_KNOWLEDGE_PACKAGE_FIELDS_INVALID");
  if (output.schema_version !== route.result_schema_version
    || output.schema_version !== contractText(packageContract, "schema_version", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID")) {
    throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  }
  const research = result.object(output.research, "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  parsePublicKnowledgeResearch(JSON.stringify(research));
  const nullFields = contractValues(
    packageContract, "decline_requires_null", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID",
  );
  const nonNullFields = contractValues(
    packageContract, "proceed_requires_non_null", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID",
  );
  if ((research.decision === "decline" && nullFields.some((field) => output[field] !== null))
    || (research.decision === "proceed"
      && (!output.article || (phase === "final" && nonNullFields.some((field) => !output[field]))))) {
    throw new Error("PUBLIC_KNOWLEDGE_PACKAGE_COMPLETENESS_INVALID");
  }
  if (output.article) {
    parsePublicKnowledgeArticle(JSON.stringify(result.object(output.article, "PUBLIC_KNOWLEDGE_ARTICLE_INVALID")));
  }
  if (output.image) validatePublicKnowledgeImage(output.image);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"), "final");
