import type { GptProviderContinuation } from "../../capabilities/gpt/index.js";
import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import type {
  ProductPlugin,
  SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  advanceLane,
  applyExactProfile,
  createSeoExecutor,
  focusContinuation,
  generateImage,
  prepareAttachedTurnPrefix,
  releaseLane,
  requireExactProfileEvidence,
  submitTextTurn,
} from "./seo-gpt-calls.js";
import {
  PLUGIN_ID,
  articlePrompt,
  attachmentFiles,
  continuationProvider,
  expectedUploadedFiles,
  objectValue,
  productSkillHash,
  providerDisplayNames,
  receiveArticle,
  receiveResearch,
  receptionSidecar,
  researchPrompt,
  reviewPrompt,
  textHash,
  textValue,
  turnMarker,
  type SeoTurnCheckpoint,
} from "./seo-turn-contract.js";
import {
  parseProductResult,
  parseRouteResult,
} from "./result-contract.js";

type SeoFlow = ReturnType<typeof createSeoExecutor>;
type ResearchTurn = Readonly<{
  checkpoint: SeoTurnCheckpoint;
  continuationRef: string;
  provider: GptProviderContinuation;
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
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.attemptId);
  const stepId = "corpus_research";
  const marker = turnMarker(task, context.gpt.attemptId, stepId);
  const prompt = researchPrompt(task, marker, providerDisplayNames(files, context.gpt.attemptId));
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 12, input: { promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  const recovered = context.gpt.readContinuationForTurn(marker)?.provider;
  const recoveryProvider = recovered?.prior_task_id === task.job_id
    && recovered.prior_turn_marker === marker
    && recovered.prior_prompt_hash === textHash(prompt) ? recovered : undefined;
  await prepareAttachedTurnPrefix({
    flow, stepId, files, uploadedFiles,
    recoverOnly: Boolean(submitFacts.mutation || submitFacts.evidence),
  });
  const checkpoint = await submitTextTurn({
    flow, stepId, prompt, marker, files: uploadedFiles,
    ordinals: [10, 11, 12, 13, 14, 15],
    ...(recoveryProvider ? { recoveryProvider } : {}),
  });
  const provider = continuationProvider(task, checkpoint);
  const persisted = await flow.execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-persist",
    child: "persist_gpt_continuation", actionOrdinal: 16,
    input: {
      authorizationRef: task.business_identity.authorization_ref,
      jobId: task.job_id,
      ownerRef: task.business_identity.owner_ref,
      pluginId: PLUGIN_ID,
      subjectRef: task.business_identity.subject_ref,
      provider,
    },
  });
  const value = objectValue(persisted.value, "SEO_CONTINUATION_PERSIST_INVALID");
  return Object.freeze({
    checkpoint,
    continuationRef: textValue(value.continuationRef, "SEO_CONTINUATION_PERSIST_INVALID"),
    provider,
    result: receiveResearch(task, context.gpt.attemptId, checkpoint),
  });
};

const produceArticleTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  continuationRef: string,
  researchProvider: GptProviderContinuation,
): Promise<ArticleTurn> => {
  const stepId = "article_synthesis";
  const marker = turnMarker(task, context.gpt.attemptId, stepId);
  const prompt = articlePrompt(task, marker);
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 27, input: { promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  const recovering = Boolean(submitFacts.mutation || submitFacts.evidence);
  const lane = await focusContinuation(
    flow, task, stepId, continuationRef, researchProvider, [17, 18, 19],
  );
  let advanced = false;
  try {
    if (recovering) await requireExactProfileEvidence(flow, stepId, [20, 21, 22, 23, 24]);
    else await applyExactProfile(flow.execute, stepId, [20, 21, 22, 23, 24]);
    const checkpoint = await submitTextTurn({
      flow, stepId, prompt, marker, files: [], ordinals: [25, 26, 27, 28, 29, 30],
    });
    const result = receiveArticle(task, context.gpt.attemptId, checkpoint);
    await advanceLane(flow.execute, task, stepId, lane, checkpoint, 31);
    advanced = true;
    return Object.freeze({ checkpoint, result });
  } finally {
    if (!advanced) await releaseLane(flow.execute, task, stepId, lane, 32);
  }
};

const completeDeclinedResearch = (
  context: SharedExecutionContext,
  flow: SeoFlow,
  research: Readonly<Record<string, unknown>>,
) => context.complete({
  payload: {
    schema_version: "public-knowledge-article-package.v1",
    research, article: null, image: null,
    _agent_reception: receptionSidecar(research, null),
  },
  evidence_refs: flow.evidenceRefs(),
});

const executeArticleProduction = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  const flow = createSeoExecutor(task, context);
  const research = await produceResearchTurn(task, context, flow);
  if (research.result.decision === "decline") {
    return completeDeclinedResearch(context, flow, research.result);
  }
  const article = await produceArticleTurn(
    task, context, flow, research.continuationRef, research.provider,
  );
  const imageStep = "article_image_generation";
  const image = await generateImage({
    flow, task, stepId: imageStep,
    marker: turnMarker(task, context.gpt.attemptId, imageStep),
    continuationRef: research.continuationRef,
    expectedProvider: continuationProvider(task, article.checkpoint),
  });
  return context.complete({
    payload: {
      schema_version: "public-knowledge-article-package.v1",
      research: research.result, article: article.result, image: null,
      _agent_reception: receptionSidecar(research.result, article.result),
    },
    evidence_refs: flow.evidenceRefs(),
    generated_image: image,
  });
};

const executeReview = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const stepId = task.action_id;
  const marker = turnMarker(task, context.gpt.attemptId, stepId);
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.attemptId);
  const prompt = reviewPrompt(task, marker, providerDisplayNames(files, context.gpt.attemptId));
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 12, input: { promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  await prepareAttachedTurnPrefix({
    flow, stepId, files, uploadedFiles,
    recoverOnly: Boolean(submitFacts.mutation || submitFacts.evidence),
  });
  const checkpoint = await submitTextTurn({
    flow, stepId, prompt, marker, files: uploadedFiles,
    ordinals: [10, 11, 12, 13, 14, 15],
  });
  return context.complete({
    payload: parseRouteResult(task, checkpoint.semanticText),
    evidence_refs: flow.evidenceRefs(),
  });
};

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: PLUGIN_ID,
  pluginVersion: 14,
  skillHash: productSkillHash,
  checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
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
