import type {
  ExactGptContinuationReadback,
  GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import type { WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import type {
  GeneratedImageArtifact,
  PriorResultRejection,
  ProductPlugin,
  SharedExecutionContext,
} from "../../mediator/product-plugin-contract.js";
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
  researchPrompt,
  reviewPrompt,
} from "./seo-turn-prompts.js";
import {
  parseProductResult,
  parseRouteResult,
} from "./result-contract.js";

type RevisionStartStep = "research" | "article" | null;

const revisionStartStep = (task: WebsiteAgentTask, rejection: PriorResultRejection | null): RevisionStartStep => {
  if (!rejection) return null;
  if (rejection.job_id !== task.job_id || task.action_id !== "produce_article") {
    fail("PUBLIC_KNOWLEDGE_RESULT_REVISION_FEEDBACK_INVALID");
  }
  return rejection.reason_codes.some((reason) => reason !== "PUBLIC_KNOWLEDGE_ARTICLE_REJECTED")
    ? "research" : "article";
};

type SeoFlow = ReturnType<typeof createSeoExecutor>;
type FrontierReadback = Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>;
type ExactGptTextCheckpointReadback = FrontierReadback["originCheckpoint"];
type ExactGptGeneratedImageCheckpointReadback = Extract<
  FrontierReadback["currentCheckpoint"],
  { checkpointKind: "generated_image" }
>;
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
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.jobId);
  const stepId = "corpus_research";
  const marker = turnMarker(task, stepId);
  const prompt = researchPrompt(
    task, marker, context.routePolicy, context.productSkill, context.priorResultRejection,
  );
  const textTurn = {
    flow, stepId, prompt, marker, files: uploadedFiles,
    ordinals: [11, 12, 13, 14, 15, 16],
  } as const;
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 13, input: { files: uploadedFiles, promptHash: textHash(prompt), turnMarker: marker } } as const;
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
    flow, stepId, files,
    recoverOnly: Boolean(submitFacts.mutation || submitFacts.evidence),
  });
  const checkpointInput = {
    ...textTurn,
    ...(recoveryProvider ? { recoveryProvider } : {}),
  } as const;
  const checkpoint = await submitTextTurn(checkpointInput);
  const provider = continuationProvider(task, checkpoint);
  const currentCheckpoint = continuationTextCheckpoint(context.gpt.attemptId, checkpoint);
  const { checkpointKind: _checkpointKind, ...originCheckpoint } = currentCheckpoint;
  const persisted = await flow.execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-persist",
    child: "persist_gpt_continuation", actionOrdinal: 17,
    input: {
      authorizationRef: task.business_identity.authorization_ref,
      jobId: task.job_id,
      ownerRef: task.business_identity.owner_ref,
      pluginId: PLUGIN_ID,
      subjectRef: task.business_identity.subject_ref,
      provider,
      currentCheckpoint,
      frontier: {
        frontierRef,
        originCheckpoint,
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
    result: receiveResearch(task, context.gpt.attemptId, checkpoint, context.routePolicy),
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
  flow.recordRecoveredEvidence(16, checkpoint.evidenceRef);
  return Object.freeze({
    checkpoint,
    continuationRef: readback.continuationRef,
    provider: readback.originProvider,
    currentProvider: readback.currentProvider,
    currentCheckpoint: readback.currentCheckpoint,
    result: receiveResearch(
      task, readback.originCheckpoint.sourceAttemptId, checkpoint, context.routePolicy,
    ),
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
  const marker = turnMarker(task, stepId);
  const prompt = articlePrompt(
    task, marker, context.routePolicy, context.productSkill, context.priorResultRejection,
  );
  const textTurn = {
    flow, stepId, prompt, marker, files: [], ordinals: [27, 28, 29, 30, 31, 32],
  } as const;
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 29, input: { files: [], promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  const recovering = Boolean(submitFacts.mutation || submitFacts.evidence);
  let recoveredTurn: ArticleTurn | null = null;
  if (recovering) {
    await requireExactProfileEvidence(flow, stepId, [21, 22, 23, 24, 25, 26]);
    const checkpoint = await submitTextTurn(textTurn);
    recoveredTurn = Object.freeze({
      checkpoint,
      sourceAttemptId: context.gpt.attemptId,
      result: receiveArticle(task, context.gpt.attemptId, checkpoint, context.routePolicy),
    });
  }
  const lane = await focusContinuation(
    flow, task, stepId, continuationRef, researchProvider, [18, 19, 20], 34,
  );
  let advanced = false;
  try {
    if (!recoveredTurn) {
      await applyExactProfile(flow.execute, stepId, [21, 22, 23, 24, 25, 26]);
      const checkpoint = await submitTextTurn(textTurn);
      recoveredTurn = Object.freeze({
        checkpoint,
        sourceAttemptId: context.gpt.attemptId,
        result: receiveArticle(task, context.gpt.attemptId, checkpoint, context.routePolicy),
      });
    }
    const turn = recoveredTurn;
    await advanceLane(flow.execute, task, stepId, lane, {
      canonicalConversationUrl: turn.checkpoint.canonicalConversationUrl,
      promptHash: turn.checkpoint.promptHash,
      rawOutputHash: turn.checkpoint.semanticTextHash,
      turnMarker: turn.checkpoint.turnMarker,
    }, continuationTextCheckpoint(context.gpt.attemptId, turn.checkpoint), 33);
    advanced = true;
    return turn;
  } finally {
    if (!advanced) await releaseLane(flow.execute, task, stepId, lane, 34);
  }
};

const recoverArticleTurn = (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: SeoFlow,
  checkpoint: ExactGptTextCheckpointReadback,
): ArticleTurn => {
  const restored = checkpointFromReadback(checkpoint);
  flow.recordRecoveredEvidence(32, restored.evidenceRef);
  return Object.freeze({
    checkpoint: restored,
    sourceAttemptId: checkpoint.sourceAttemptId,
    result: receiveArticle(task, checkpoint.sourceAttemptId, restored, context.routePolicy),
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
  const draft = Object.freeze({
    schema_version: "public-knowledge-article-package.v1",
    research, article, image: null,
    _agent_reception: receptionSidecar(research, article),
  });
  const receipt = await context.uploadGeneratedImage(image);
  const payload = Object.freeze({ ...draft, image: Object.freeze({
    schema_version: "public-knowledge-agent-hero-image.v1",
    ...receipt,
  }) });
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
) => {
  const payload = {
    schema_version: "public-knowledge-article-package.v1",
    research, article: null, image: null,
    _agent_reception: receptionSidecar(research, null),
  };
  return context.complete({
    payload: parseProductResult(task, payload, context.routePolicy, "final"),
    evidence_refs: flow.evidenceRefs(),
  });
};

const executeArticleProduction = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  const flow = createSeoExecutor(task, context);
  const revisionStart = revisionStartStep(task, context.priorResultRejection);
  const frontierRef = researchFrontierRef(
    task,
    revisionStart === "research" ? context.priorResultRejection!.receipt_hash : null,
  );
  const research = revisionStart === "research"
    ? await produceResearchTurn(task, context, flow, frontierRef)
    : await recoverResearchTurn(task, context, flow, frontierRef)
      ?? await produceResearchTurn(task, context, flow, frontierRef);
  if (research.result.decision === "decline") {
    return completeDeclinedResearch(task, context, flow, research.result);
  }
  if (revisionStart === null && research.currentCheckpoint.checkpointKind === "generated_image") {
    const article = recoverArticleTurn(
      task, context, flow, research.currentCheckpoint.predecessorTextCheckpoint,
    );
    flow.recordRecoveredEvidence(45, research.currentCheckpoint.evidenceRef);
    return completeArticlePackage(
      task, context, flow, research.result, article.result, imageFromReadback(research.currentCheckpoint),
    );
  }
  const currentTextCheckpoint = research.currentCheckpoint.checkpointKind === "text"
    ? research.currentCheckpoint : null;
  const currentIsResearch = Boolean(currentTextCheckpoint
    && sameProvider(research.currentProvider, research.provider)
    && currentTextCheckpoint.semanticTextHash === research.checkpoint.semanticTextHash
    && currentTextCheckpoint.artifactRef === research.checkpoint.artifactRef);
  const article = currentIsResearch || revisionStart !== null
    ? await produceArticleTurn(task, context, flow, research.continuationRef,
      revisionStart === "article" ? research.currentProvider : research.provider)
    : recoverArticleTurn(task, context, flow,
      currentTextCheckpoint ?? fail("SEO_ARTICLE_CHECKPOINT_INVALID"));
  const imageStep = "article_image_generation";
  const image = await generateImage({
    flow, task, stepId: imageStep,
    marker: turnMarker(task, imageStep),
    continuationRef: research.continuationRef,
    expectedProvider: continuationProvider(task, article.checkpoint),
    sourceAttemptId: context.gpt.attemptId,
    predecessorCheckpoint: article.checkpoint,
    predecessorSourceAttemptId: article.sourceAttemptId,
    productSkill: context.productSkill,
    priorResultRejection: context.priorResultRejection,
  });
  return completeArticlePackage(task, context, flow, research.result, article.result, image);
};

const executeReview = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const stepId = task.action_id;
  const marker = turnMarker(task, stepId);
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.jobId);
  const prompt = reviewPrompt(task, marker, context.productSkill);
  const textTurn = {
    flow, stepId, prompt, marker, files: uploadedFiles,
    ordinals: [11, 12, 13, 14, 15, 16],
  } as const;
  const submitCall = { productStepId: stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 13, input: { files: uploadedFiles, promptHash: textHash(prompt), turnMarker: marker } } as const;
  const submitFacts = await flow.facts(submitCall);
  await prepareAttachedTurnPrefix({
    flow, stepId, files,
    recoverOnly: Boolean(submitFacts.mutation || submitFacts.evidence),
  });
  const checkpoint = await submitTextTurn(textTurn);
  return context.complete({
    payload: parseRouteResult(task, checkpoint.semanticText, context.routePolicy),
    evidence_refs: flow.evidenceRefs(),
  });
};

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: PLUGIN_ID,
  pluginVersion: 22,
  checkpointSchemaVersion: 2,
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
