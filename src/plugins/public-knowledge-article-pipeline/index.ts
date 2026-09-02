import type { GptProviderContinuation } from "../../capabilities/gpt/index.js";
import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import type {
  ExactGptGeneratedImageCheckpointReadback,
  ExactGptTextCheckpointReadback,
  GeneratedImageArtifact,
  ProductPlugin,
  SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  advanceLane,
  applyExactProfile,
  createSeoExecutor,
  focusContinuation,
  prepareAttachedTurnPrefix,
  releaseLane,
  requireExactProfileEvidence,
  submitTextTurn,
} from "./seo-gpt-calls.js";
import { generateImage } from "./seo-image-call.js";
import {
  PLUGIN_ID,
  continuationTextCheckpoint,
  continuationProvider,
  fail,
  objectValue,
  receiveArticle,
  receiveResearch,
  receptionSidecar,
  researchFrontierRef,
  textHash,
  textValue,
  turnMarker,
  type SeoTurnCheckpoint,
} from "./seo-turn-contract.js";
import {
  articlePrompt,
  attachmentFiles,
  expectedUploadedFiles,
  productSkillHash,
  providerDisplayNames,
  researchPrompt,
  reviewPrompt,
} from "./seo-turn-prompts.js";
import {
  parseProductResult,
  parseRouteResult,
} from "./result-contract.js";

type SeoFlow = ReturnType<typeof createSeoExecutor>;
type ResearchTurn = Readonly<{
  checkpoint: SeoTurnCheckpoint;
  continuationRef: string;
  provider: GptProviderContinuation;
  currentProvider: GptProviderContinuation;
  currentCheckpoint: ExactGptTextCheckpointReadback | ExactGptGeneratedImageCheckpointReadback;
  result: Readonly<Record<string, unknown>>;
}>;
type ArticleTurn = Readonly<{
  checkpoint: SeoTurnCheckpoint;
  sourceAttemptId: string;
  result: Readonly<Record<string, unknown>>;
}>;

const checkpointFromReadback = (checkpoint: ExactGptTextCheckpointReadback): SeoTurnCheckpoint => Object.freeze({
  assistantTurnId: checkpoint.assistantTurnId,
  rawDomHtml: checkpoint.rawDomHtml,
  rawDomHash: checkpoint.rawDomHash,
  semanticText: checkpoint.semanticText,
  semanticTextHash: checkpoint.semanticTextHash,
  artifactRef: checkpoint.artifactRef,
  evidenceRef: checkpoint.evidenceRef,
  evidenceHash: checkpoint.evidenceHash,
  canonicalConversationUrl: checkpoint.canonicalConversationUrl,
  promptHash: checkpoint.promptHash,
  turnMarker: checkpoint.turnMarker,
});

const sameProvider = (left: GptProviderContinuation, right: GptProviderContinuation): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const imageFromReadback = (checkpoint: ExactGptGeneratedImageCheckpointReadback): GeneratedImageArtifact =>
  Object.freeze({
    artifact_id: `airesult_${checkpoint.webpSha256.slice(7, 39)}`,
    webp_bytes: checkpoint.webpBytes,
    original_bytes: checkpoint.originalBytes,
    sha256: checkpoint.webpSha256,
    original_sha256: checkpoint.originalSha256,
    bytes: checkpoint.webpBytes.byteLength,
    media_type: "image/webp",
    width: 1200,
    height: 630,
  });

const produceResearchTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  frontierRef: `sha256:${string}`,
): Promise<ResearchTurn> => {
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.attemptId);
  const stepId = "corpus_research";
  const marker = turnMarker(task, context.gpt.attemptId, stepId);
  const prompt = researchPrompt(task, marker, providerDisplayNames(files, context.gpt.attemptId));
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 12, input: { promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  const recoveredReadback = await context.gpt.readContinuationExact({
    lookupKind: "turn_marker", turnMarker: marker,
  });
  const recovered = recoveredReadback?.lookupKind === "turn_marker"
    ? recoveredReadback.lane.provider : undefined;
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
      currentCheckpoint: continuationTextCheckpoint(context.gpt.attemptId, checkpoint),
      frontier: {
        frontierRef,
        originCheckpoint: {
          sourceAttemptId: context.gpt.attemptId,
          assistantTurnId: checkpoint.assistantTurnId,
          artifactRef: checkpoint.artifactRef,
          rawDomHash: checkpoint.rawDomHash,
          semanticTextHash: checkpoint.semanticTextHash,
          canonicalConversationUrl: checkpoint.canonicalConversationUrl,
          promptHash: checkpoint.promptHash,
          turnMarker: checkpoint.turnMarker,
          evidenceRef: checkpoint.evidenceRef,
          evidenceHash: checkpoint.evidenceHash,
        },
      },
    },
  });
  const value = objectValue(persisted.value, "SEO_CONTINUATION_PERSIST_INVALID");
  return Object.freeze({
    checkpoint,
    continuationRef: textValue(value.continuationRef, "SEO_CONTINUATION_PERSIST_INVALID"),
    provider,
    currentProvider: provider,
    currentCheckpoint: Object.freeze({
      ...continuationTextCheckpoint(context.gpt.attemptId, checkpoint),
      rawDomHtml: checkpoint.rawDomHtml,
      semanticText: checkpoint.semanticText,
    }),
    result: receiveResearch(task, context.gpt.attemptId, checkpoint),
  });
};

const recoverResearchTurn = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  frontierRef: `sha256:${string}`,
): Promise<ResearchTurn | null> => {
  const readback = await context.gpt.readContinuationExact({
    lookupKind: "frontier_ref", frontierRef,
    authorization: {
      kind: "origin_authorization",
      originAuthorizationRef: task.business_identity.authorization_ref,
    },
  });
  if (!readback) return null;
  if (readback.lookupKind !== "frontier_ref") fail("SEO_RESEARCH_FRONTIER_READBACK_INVALID");
  const checkpoint = checkpointFromReadback(readback.originCheckpoint);
  flow.recordRecoveredEvidence(15, checkpoint.evidenceRef);
  return Object.freeze({
    checkpoint,
    continuationRef: readback.continuationRef,
    provider: readback.originProvider,
    currentProvider: readback.currentProvider,
    currentCheckpoint: readback.currentCheckpoint,
    result: receiveResearch(task, readback.originCheckpoint.sourceAttemptId, checkpoint),
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
    flow, task, stepId, continuationRef, researchProvider, [17, 18, 19], 32,
  );
  let advanced = false;
  try {
    if (recovering) await requireExactProfileEvidence(flow, stepId, [20, 21, 22, 23, 24]);
    else await applyExactProfile(flow.execute, stepId, [20, 21, 22, 23, 24]);
    const checkpoint = await submitTextTurn({
      flow, stepId, prompt, marker, files: [], ordinals: [25, 26, 27, 28, 29, 30],
    });
    const result = receiveArticle(task, context.gpt.attemptId, checkpoint);
    await advanceLane(flow.execute, task, stepId, lane, {
      canonicalConversationUrl: checkpoint.canonicalConversationUrl,
      promptHash: checkpoint.promptHash,
      rawOutputHash: checkpoint.semanticTextHash,
      turnMarker: checkpoint.turnMarker,
    }, continuationTextCheckpoint(context.gpt.attemptId, checkpoint), 31);
    advanced = true;
    return Object.freeze({ checkpoint, sourceAttemptId: context.gpt.attemptId, result });
  } finally {
    if (!advanced) await releaseLane(flow.execute, task, stepId, lane, 32);
  }
};

const recoverArticleTurn = (
  task: WebsiteAgentTask,
  flow: SeoFlow,
  checkpoint: ExactGptTextCheckpointReadback,
): ArticleTurn => {
  const restored = checkpointFromReadback(checkpoint);
  flow.recordRecoveredEvidence(30, restored.evidenceRef);
  return Object.freeze({
    checkpoint: restored,
    sourceAttemptId: checkpoint.sourceAttemptId,
    result: receiveArticle(task, checkpoint.sourceAttemptId, restored),
  });
};

const completeArticlePackage = (
  context: SharedExecutionContext,
  flow: SeoFlow,
  research: Readonly<Record<string, unknown>>,
  article: Readonly<Record<string, unknown>>,
  image: GeneratedImageArtifact,
) => context.complete({
  payload: {
    schema_version: "public-knowledge-article-package.v1",
    research, article, image: null,
    _agent_reception: receptionSidecar(research, article),
  },
  evidence_refs: flow.evidenceRefs(),
  generated_image: image,
});

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
  const frontierRef = researchFrontierRef(task);
  const research = await recoverResearchTurn(task, context, flow, frontierRef)
    ?? await produceResearchTurn(task, context, flow, frontierRef);
  if (research.result.decision === "decline") {
    return completeDeclinedResearch(context, flow, research.result);
  }
  if (research.currentCheckpoint.checkpointKind === "generated_image") {
    const article = recoverArticleTurn(
      task, flow, research.currentCheckpoint.predecessorTextCheckpoint,
    );
    flow.recordRecoveredEvidence(45, research.currentCheckpoint.evidenceRef);
    return completeArticlePackage(
      context, flow, research.result, article.result, imageFromReadback(research.currentCheckpoint),
    );
  }
  const currentIsResearch = sameProvider(research.currentProvider, research.provider)
    && research.currentCheckpoint.semanticTextHash === research.checkpoint.semanticTextHash
    && research.currentCheckpoint.artifactRef === research.checkpoint.artifactRef;
  const article = currentIsResearch
    ? await produceArticleTurn(task, context, flow, research.continuationRef, research.provider)
    : recoverArticleTurn(task, flow, research.currentCheckpoint);
  const imageStep = "article_image_generation";
  const image = await generateImage({
    flow, task, stepId: imageStep,
    marker: turnMarker(task, article.sourceAttemptId, imageStep),
    continuationRef: research.continuationRef,
    expectedProvider: continuationProvider(task, article.checkpoint),
    sourceAttemptId: context.gpt.attemptId,
    predecessorCheckpoint: article.checkpoint,
    predecessorSourceAttemptId: article.sourceAttemptId,
  });
  return completeArticlePackage(context, flow, research.result, article.result, image);
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
  pluginVersion: 16,
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
