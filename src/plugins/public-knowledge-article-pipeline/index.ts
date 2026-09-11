import type {
  GeneratedImageArtifact,
  ProductPlugin,
  SharedExecutionContext,
  WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import {
  applyExactProfile,
  createSeoExecutor,
  prepareAttachedTurnPrefix,
  submitTextTurn,
} from "./seo-gpt-calls.js";
import { generateImage } from "./seo-image-call.js";
import {
  PLUGIN_ID,
  receiveArticle,
  receiveResearch,
  receptionSidecar,
  turnMarker,
  type SeoTurnCheckpoint,
} from "./seo-turn-contract.js";
import {
  articlePrompt,
  attachmentFiles,
  expectedUploadedFiles,
  researchPrompt,
  reviewPrompt,
} from "./seo-turn-prompts.js";
import { parseProductResult, parseRouteResult } from "./result-contract.js";

type SeoFlow = ReturnType<typeof createSeoExecutor>;
type ResearchTurn = Readonly<{
  checkpoint: SeoTurnCheckpoint;
  result: Readonly<Record<string, unknown>>;
}>;
type ArticleTurn = Readonly<{
  checkpoint: SeoTurnCheckpoint;
  result: Readonly<Record<string, unknown>>;
}>;

const produceResearchTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
): Promise<ResearchTurn> => {
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.jobId);
  const stepId = "corpus_research";
  const marker = turnMarker(task, stepId);
  const checkpoint = await submitTextTurn({
    flow,
    stepId,
    marker,
    files: uploadedFiles,
    prompt: researchPrompt(task, marker, context.routePolicy, context.productSkill),
    ordinals: [11, 12, 13, 14, 15, 16],
    prepare: () => prepareAttachedTurnPrefix({ flow, stepId, files }),
  });
  return Object.freeze({
    checkpoint,
    result: receiveResearch(task, context.gpt.attemptId, checkpoint, context.routePolicy),
  });
};

const produceArticleTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  research: Readonly<Record<string, unknown>>,
): Promise<ArticleTurn> => {
  const stepId = "article_synthesis";
  const marker = turnMarker(task, stepId);
  const checkpoint = await submitTextTurn({
    flow,
    stepId,
    marker,
    files: [],
    prompt: articlePrompt(task, marker, context.routePolicy, context.productSkill, research),
    ordinals: [27, 28, 29, 30, 31, 32],
    prepare: () => applyExactProfile(flow.execute, stepId, [21, 22, 23, 24, 25, 26]),
  });
  return Object.freeze({
    checkpoint,
    result: receiveArticle(task, context.gpt.attemptId, checkpoint, context.routePolicy),
  });
};

const completeArticlePackage = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  research: Readonly<Record<string, unknown>>,
  article: Readonly<Record<string, unknown>>,
  image: GeneratedImageArtifact,
) => {
  const receipt = await context.uploadGeneratedImage(image);
  const payload = Object.freeze({
    schema_version: "public-knowledge-article-package.v1",
    research,
    article,
    image: Object.freeze({ schema_version: "public-knowledge-agent-hero-image.v1", ...receipt }),
    _agent_reception: receptionSidecar(research, article),
  });
  return context.complete({
    payload: parseProductResult(task, payload, context.routePolicy, "final"),
    evidence_refs: flow.evidenceRefs(),
  });
};

const completeDeclinedResearch = (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  research: Readonly<Record<string, unknown>>,
) => context.complete({
  payload: parseProductResult(task, {
    schema_version: "public-knowledge-article-package.v1",
    research,
    article: null,
    image: null,
    _agent_reception: receptionSidecar(research, null),
  }, context.routePolicy, "final"),
  evidence_refs: flow.evidenceRefs(),
});

const executeArticleProduction = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  const flow = createSeoExecutor(task, context);
  const research = await produceResearchTurn(task, context, flow);
  if (research.result.decision === "decline") {
    return completeDeclinedResearch(task, context, flow, research.result);
  }
  const article = await produceArticleTurn(task, context, flow, research.result);
  const stepId = "article_image_generation";
  const image = await generateImage({
    flow,
    task,
    stepId,
    marker: turnMarker(task, stepId),
    article: article.result,
    productSkill: context.productSkill,
  });
  return completeArticlePackage(task, context, flow, research.result, article.result, image);
};

const executeReview = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const stepId = task.action_id;
  const marker = turnMarker(task, stepId);
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.jobId);
  const checkpoint = await submitTextTurn({
    flow,
    stepId,
    marker,
    files: uploadedFiles,
    prompt: reviewPrompt(task, marker, context.productSkill),
    ordinals: [11, 12, 13, 14, 15, 16],
    prepare: () => prepareAttachedTurnPrefix({ flow, stepId, files }),
  });
  return context.complete({
    payload: parseRouteResult(task, checkpoint.semanticText, context.routePolicy),
    evidence_refs: flow.evidenceRefs(),
  });
};

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: PLUGIN_ID,
  pluginVersion: 25,
  accepts: [
    { productId: "public_knowledge_article_pipeline", actionId: "produce_article" },
    { productId: "public_knowledge_article_pipeline", actionId: "accuracy_challenge" },
    { productId: "public_knowledge_article_pipeline", actionId: "quality_reflection" },
  ],
  execute(task, context) {
    return task.action_id === "produce_article"
      ? executeArticleProduction(task, context)
      : executeReview(task, context);
  },
};
