import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parsePublicKnowledgeArticle, parsePublicKnowledgeResearch, parseRouteResult } from "./result-contract.js";

const skill = readProductSkill(import.meta.url);
const researchProvider = { labelKey: "seo_research", profileRef: "public-knowledge-article-pipeline:research:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;
const articleProvider = { ...researchProvider, labelKey: "seo_article", profileRef: "public-knowledge-article-pipeline:article:gpt-5.6-sol-pro" } as const;

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 7,
  skillHash: skill.hash,
  checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "public_knowledge_article_pipeline", actionId: "produce_article" },
    { productId: "public_knowledge_article_pipeline", actionId: "accuracy_challenge" },
    { productId: "public_knowledge_article_pipeline", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    if (task.action_id !== "produce_article") {
      const finding = await context.runTurn({ step_id: task.action_id, instruction: "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段）。", material_roles: ["subject_result", "review_context"], provider: researchProvider });
      return context.complete({ payload: parseRouteResult(task, finding.raw_text), evidence_refs: combineEvidence(finding) });
    }
    const research = await context.runTurn({
      step_id: "corpus_research",
      instruction: "只使用 ready_corpus_archive 的冻结语料与现役文章目录完成研究。先比较已有主题与覆盖范围，再选择一个对普通读者有独立价值、可由当前来源闭合且不存在实质重复的问题；逐项给出 topic_manifest、editorial_intent、catalog_comparison_note、可回查 citations、uncertainties、research_claim_units、closest_existing_article_ids、relation_assertions 与 novelty_basis。材料不足、没有实质新意、无法公开或无法核验时必须 decision=decline；否则 decision=proceed。严格按 result_contract 返回 public-knowledge-research-output.v3 合法 JSON，不要代码围栏、解释或额外字段。",
      material_roles: ["ready_corpus_archive", "result_contract"],
      provider: researchProvider,
    });
    const researchPayload = parsePublicKnowledgeResearch(research.raw_text);
    if (researchPayload.decision === "decline") {
      return context.complete({
        payload: { schema_version: "public-knowledge-article-package.v1", research: researchPayload, article: null, image: null },
        evidence_refs: combineEvidence(research),
        continuation: research.provider_continuation,
      });
    }
    const article = await context.runTurn({
      step_id: "article_synthesis",
      instruction: "依据同一会话中已经完成并 checkpoint 的研究写成一篇独立、清晰的简体中文知识文章。标题、editor_note、article_markdown、citations、claim_coverage 与 safety_notes 必须逐项闭合；清楚区分原典、历史语境、流派观点、当前解释、推断与不确定性，不得把未被研究材料支持的断言写成事实，不堆关键词，不作收录或排名承诺。严格返回 public-knowledge-article-output.v3 合法 JSON，不要代码围栏、解释或额外字段。",
      material_roles: [],
      same_conversation_as: research,
      provider: articleProvider,
    });
    const articlePayload = parsePublicKnowledgeArticle(article.raw_text);
    const image = await context.runTurn({
      step_id: "article_image_generation",
      instruction: "依据同一会话中刚完成的文章只生成一张原创横向主图。画面必须与文章核心主题一致，不含文字、书名、印章、引用或商业 CTA，不冒充古籍原页、历史文物、真实人物或史料照片，不使用玄学恐吓画面。只生成图片，不输出第二张图。",
      material_roles: [],
      same_conversation_as: article,
      output_kind: "generated_image",
      provider: articleProvider,
    });
    if (!image.generated_image) throw new Error("PUBLIC_KNOWLEDGE_GENERATED_IMAGE_REQUIRED");
    return context.complete({
      payload: { schema_version: "public-knowledge-article-package.v1", research: researchPayload, article: articlePayload, image: null },
      generated_image: image.generated_image,
      evidence_refs: combineEvidence(research, article, image),
      continuation: image.provider_continuation,
    });
  },
};
