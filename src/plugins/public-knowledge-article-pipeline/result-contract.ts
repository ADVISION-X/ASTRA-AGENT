import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

type ContractObject = Readonly<Record<string, unknown>>;

const contractObject = (value: unknown, code: string): ContractObject => result.object(value, code);
const contractText = (contract: ContractObject, key: string, code: string): string =>
  result.text(contract[key], code);
const contractValues = (contract: ContractObject, key: string, code: string): readonly string[] =>
  result.stringArray(contract[key], code, true);
const contractSection = (contract: ContractObject, key: string, code: string): ContractObject =>
  contractObject(contract[key], code);

const publicKnowledgeResultContract = (route: ProductionRoutePolicy): ContractObject => {
  const contract = contractObject(route.result_contract, "PUBLIC_KNOWLEDGE_RESULT_CONTRACT_MISSING");
  result.exact(contract as Record<string, unknown>, [
    "schema_version", "package", "research", "article", "image",
  ], "PUBLIC_KNOWLEDGE_RESULT_CONTRACT_INVALID");
  if (contract.schema_version !== "public-knowledge-article-package-contract.v1") {
    result.fail("PUBLIC_KNOWLEDGE_RESULT_CONTRACT_INVALID");
  }
  return contract;
};

export const publicKnowledgeTurnContract = (
  route: ProductionRoutePolicy,
  turn: "research" | "article",
): ContractObject => contractSection(
  publicKnowledgeResultContract(route), turn, "PUBLIC_KNOWLEDGE_TURN_CONTRACT_MISSING",
);

export const parsePublicKnowledgeResearch = (
  raw: string,
  route: ProductionRoutePolicy,
): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract(route, "research");
  const output = Object.freeze(result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_RESEARCH"));
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
    || !contractValues(contract, "decision_values", "PUBLIC_KNOWLEDGE_RESEARCH_CONTRACT_INVALID")
      .includes(String(output.decision))) {
    result.fail("PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  }
  return Object.freeze(output);
};

export const parsePublicKnowledgeArticle = (
  raw: string,
  route: ProductionRoutePolicy,
): Readonly<Record<string, unknown>> => {
  const contract = publicKnowledgeTurnContract(route, "article");
  const output = Object.freeze(result.parseJsonObject(raw, "PUBLIC_KNOWLEDGE_ARTICLE"));
  if (output.schema_version !== contractText(contract, "schema_version", "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID")) {
    result.fail("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  return Object.freeze(output);
};

const validatePublicKnowledgeImage = (value: unknown, route: ProductionRoutePolicy): void => {
  const code = "PUBLIC_KNOWLEDGE_IMAGE_INVALID";
  const contract = contractSection(publicKnowledgeResultContract(route), "image", code);
  const image = result.object(value, code);
  result.exact(image, contractValues(contract, "exact_fields", code), code);
  if (image.schema_version !== contractText(contract, "schema_version", code)
    || image.mime_type !== contractText(contract, "mime_type", code)
    || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
    || !Number.isSafeInteger(image.bytes) || Number(image.bytes) < 1) result.fail(code);
  result.text(image.artifact_id, code);
  result.text(image.object_ref, code);
  result.hash(image.sha256, "PUBLIC_KNOWLEDGE_IMAGE_HASH_INVALID");
  result.hash(image.receipt_hash, "PUBLIC_KNOWLEDGE_IMAGE_RECEIPT_INVALID");
};

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  route: ProductionRoutePolicy,
  phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "public_knowledge_article_pipeline") result.fail("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return Object.freeze(
    result.object(value, "PUBLIC_KNOWLEDGE_REVIEW_OBJECT_REQUIRED"),
  );
  const contract = publicKnowledgeResultContract(route);
  const packageContract = contractSection(contract, "package", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID");
  const output = result.object(value, "PUBLIC_KNOWLEDGE_PACKAGE_INVALID");
  if (output.schema_version !== route.result_schema_version
    || output.schema_version !== contractText(packageContract, "schema_version", "PUBLIC_KNOWLEDGE_PACKAGE_CONTRACT_INVALID")) {
    result.fail("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  }
  const research = result.object(output.research, "PUBLIC_KNOWLEDGE_RESEARCH_INVALID");
  const researchContract = publicKnowledgeTurnContract(route, "research");
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
    const articleContract = publicKnowledgeTurnContract(route, "article");
    if (article.schema_version !== contractText(
      articleContract, "schema_version", "PUBLIC_KNOWLEDGE_ARTICLE_CONTRACT_INVALID",
    )) result.fail("PUBLIC_KNOWLEDGE_ARTICLE_INVALID");
  }
  if (output.image) validatePublicKnowledgeImage(output.image, route);
  return Object.freeze(output);
};

export const parseRouteResult = (
  task: WebsiteAgentTask,
  raw: string,
  route: ProductionRoutePolicy,
): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"), route, "final");
