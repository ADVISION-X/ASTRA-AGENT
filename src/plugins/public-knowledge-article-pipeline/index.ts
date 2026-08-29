import { executionFailure } from "../../lib/typed-failure.js";
import { readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: "public-knowledge-article-pipeline", pluginVersion: 8, skillHash: skill.hash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "public_knowledge_article_pipeline", actionId: "produce_article" },
    { productId: "public_knowledge_article_pipeline", actionId: "accuracy_challenge" },
    { productId: "public_knowledge_article_pipeline", actionId: "quality_reflection" },
  ],
  async execute(task) {
    throw executionFailure("failed", `PRODUCT_FLOW_NOT_IMPLEMENTED:public-knowledge-article-pipeline:${task.action_id}`);
  },
};
