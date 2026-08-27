import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const researchProvider = { labelKey: "seo_research", profileRef: "public-knowledge-article-pipeline:research:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;
const articleProvider = { ...researchProvider, labelKey: "seo_article", profileRef: "public-knowledge-article-pipeline:article:gpt-5.6-sol-pro" } as const;

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "public_knowledge_article_pipeline", actionId: "produce_article" },
    { productId: "public_knowledge_article_pipeline", actionId: "accuracy_challenge" },
    { productId: "public_knowledge_article_pipeline", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce_article") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核原公开知识文章的来源、主张、公开性和表达，只输出有来源的 finding。", material_roles: ["subject_result", "review_context", "corpus_material"], gpt_flow: freshGptTurnFlow, provider: researchProvider });
      return context.complete({ payload: { findings: finding.raw_text }, evidence_refs: combineEvidence(finding) });
    }
    const research = await context.runTurn({ step_id: "research", instruction: "从获准资料中提取可公开、可引用、可核验的研究笔记；逐项标明来源，不写成文章。", material_roles: ["topic_brief", "corpus_material"], gpt_flow: freshGptTurnFlow, provider: researchProvider });
    const article = await context.runTurn({ step_id: "compose_article", instruction: "依据已完成研究写成独立、清晰的知识文章；不得把无来源断言写成事实，也不得执行发布动作。", material_roles: ["topic_brief", "editorial_requirements"], gpt_flow: continuationGptTurnFlow, same_conversation_as: research, provider: articleProvider });
    const image = await context.runTurn({ step_id: "create_image", instruction: "为这篇文章生成一张不含文字、不冒充古籍原图、适合 1200x630 展示的原创配图。", material_roles: ["image_brief"], gpt_flow: freshGptTurnFlow, output_kind: "generated_image", provider: articleProvider });
    return context.complete({ payload: { research: research.raw_text, article: article.raw_text, image: image.raw_text }, evidence_refs: combineEvidence(research, article, image), continuation: article.provider_continuation });
  },
};
