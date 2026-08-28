import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parsePublicKnowledgeArticle, parsePublicKnowledgeResearch, parseRouteResult } from "./result-contract.js";
import { continuationGptTurnFlow, freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const researchProvider = { labelKey: "seo_research", profileRef: "public-knowledge-article-pipeline:research:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;
const articleProvider = { ...researchProvider, labelKey: "seo_article", profileRef: "public-knowledge-article-pipeline:article:gpt-5.6-sol-pro" } as const;

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 3,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "public_knowledge_article_pipeline", actionId: "produce_article" },
    { productId: "public_knowledge_article_pipeline", actionId: "accuracy_challenge" },
    { productId: "public_knowledge_article_pipeline", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce_article") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。", material_roles: ["subject_result", "review_context"], gpt_flow: freshGptTurnFlow, provider: researchProvider });
      return context.complete({ payload: parseRouteResult(task, finding.raw_text), evidence_refs: combineEvidence(finding) });
    }
    const research = await context.runTurn({ step_id: "research", instruction: "从 ready_corpus_archive 中提取可公开、可引用、可核验的研究结论；严格按 result_contract 返回 public-knowledge-research-output.v3 合法 JSON，不要代码围栏、解释或额外字段。", material_roles: ["ready_corpus_archive", "result_contract"], gpt_flow: freshGptTurnFlow, provider: researchProvider });
    const researchPayload = parsePublicKnowledgeResearch(research.raw_text);
    if (researchPayload.decision === "decline") {
      return context.complete({
        payload: { schema_version: "public-knowledge-article-package.v1", research: researchPayload, article: null, image: null },
        evidence_refs: combineEvidence(research),
        continuation: research.provider_continuation,
      });
    }
    const article = await context.runTurn({ step_id: "compose_article", instruction: "依据已完成研究写成独立、清晰的知识文章；严格按 result_contract 返回 public-knowledge-article-output.v3 合法 JSON，不得把无来源断言写成事实，不要代码围栏、解释或额外字段。", material_roles: ["ready_corpus_archive", "result_contract"], gpt_flow: continuationGptTurnFlow, same_conversation_as: research, provider: articleProvider });
    const articlePayload = parsePublicKnowledgeArticle(article.raw_text);
    const image = await context.runTurn({ step_id: "create_image", instruction: "为刚完成的文章生成一张不含文字、不冒充古籍原图、适合 1200x630 展示的原创配图；只生成一张图。", material_roles: [], gpt_flow: continuationGptTurnFlow, same_conversation_as: article, output_kind: "generated_image", provider: articleProvider });
    if (!image.generated_image) throw new Error("PUBLIC_KNOWLEDGE_GENERATED_IMAGE_REQUIRED");
    return context.complete({
      payload: { schema_version: "public-knowledge-article-package.v1", research: researchPayload, article: articlePayload, image: null },
      generated_image: image.generated_image,
      evidence_refs: combineEvidence(research, article, image),
      continuation: article.provider_continuation,
    });
  },
};
