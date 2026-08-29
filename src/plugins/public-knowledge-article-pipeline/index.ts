import {
  buildGptExecutionProfile,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import {
  readProductSkill,
  type GeneratedImageArtifact,
  type ProductGptTools,
  type ProductPlugin,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  parseProductResult,
  parsePublicKnowledgeArticle,
  parsePublicKnowledgeResearch,
  parseRouteResult,
} from "./result-contract.js";

const skill = readProductSkill(import.meta.url);
const PLUGIN_ID = "public-knowledge-article-pipeline";
const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:gpt-5.6-sol-pro-standard`,
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:seo-production`,
  acceptanceVersion: "v1",
});
const WAIT_TIMEOUT_MS = 3_600_000;

type SeoChild = ProductGptTools["execute"];
type SeoTurnCheckpoint = Readonly<{
  rawText: string;
  rawHash: ProductionHash;
  canonicalConversationUrl: string;
  turnMarker: string;
}>;

const objectValue = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
};
const textValue = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
};
const hashValue = (value: unknown, code: string): ProductionHash => {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) throw new Error(code);
  return value as ProductionHash;
};
const providerValue = (value: unknown): GptProviderContinuation => {
  const provider = objectValue(value, "SEO_CONTINUATION_PROVIDER_INVALID");
  return Object.freeze({
    provider_page_url: textValue(provider.provider_page_url, "SEO_CONTINUATION_PROVIDER_INVALID"),
    prior_task_id: textValue(provider.prior_task_id, "SEO_CONTINUATION_PROVIDER_INVALID"),
    prior_raw_output_hash: hashValue(provider.prior_raw_output_hash, "SEO_CONTINUATION_PROVIDER_INVALID"),
    prior_turn_marker: textValue(provider.prior_turn_marker, "SEO_CONTINUATION_PROVIDER_INVALID"),
  });
};
const laneValue = (value: unknown): GptContinuationLane => {
  const lane = objectValue(value, "SEO_CONTINUATION_LANE_INVALID");
  if (!Number.isSafeInteger(lane.lane_version)) throw new Error("SEO_CONTINUATION_LANE_INVALID");
  return Object.freeze({
    continuation_ref: textValue(lane.continuation_ref, "SEO_CONTINUATION_LANE_INVALID"),
    lane_version: Number(lane.lane_version),
    provider: providerValue(lane.provider),
  });
};

const turnMarker = (task: WebsiteAgentTask, attemptId: string, stepId: string): string =>
  `[GRASSEYE:${hashCanonical({ job_id: task.job_id, attempt_id: attemptId, product_step_id: stepId }).slice(7, 31)}]`;

const promptEnvelope = (task: WebsiteAgentTask, marker: string, instruction: string): string => [
  skill.text,
  "",
  `当前授权动作：${task.action_id}`,
  `当前业务参数：${JSON.stringify(task.parameters)}`,
  instruction,
  `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`,
].join("\n");

const researchPrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "读取且只读取本轮两个附件：ready-corpus-archive.json 与 article-package-result-contract.json。",
  "从冻结 READY 语料与现役文章目录中研究一个可公开、可引用、可核验、且不存在实质重复的问题。",
  "材料不足或没有实质新意时必须 decision=decline；否则 decision=proceed。",
  "严格返回 public-knowledge-research-output.v3 的全部且仅有合同字段。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

const articlePrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "仅依据本 conversation 已 checkpoint 的 public-knowledge-research-output.v3 研究结论写成文章。",
  "不得重新选题、不得引入未在研究中出现的来源或主张；引用 identity 与顺序必须保持一致。",
  "严格返回 public-knowledge-article-output.v3 的全部且仅有合同字段。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

const imagePrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "仅依据本 conversation 已完成的研究和文章，生成一张原创横向文章主图。",
  "只生成一张图片：无文字、无印章、无书名，不冒充古籍原页、文物、真实人物或史料照片。",
  "本轮唯一业务输出是一张可下载的生成图片。",
].join("\n"));

const reviewPrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "读取且只读取本轮 subject_result 与 review_context 两个附件。",
  task.action_id === "accuracy_challenge"
    ? "只检查公开性、来源、主张、引文与事实准确性；不得改写文章或替 Website 裁决。"
    : "只检查独立性、表达、读者价值、合同摩擦与质量风险；不得改写文章或替 Website 裁决。",
  "严格返回 website-agent-review-output.v1：仅含 decision 与 issues；decision 只能是 no_issue 或 issues。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

const attachmentFiles = (context: SharedExecutionContext) => context.materials
  .slice().sort((left, right) => left.ordinal - right.ordinal).map((material) => Object.freeze({
    artifactRef: material.material_id,
    filePath: material.local_path,
    displayName: material.display_name,
    sha256: material.sha256,
    bytes: material.bytes,
  }));

const createSeoExecutor = (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const sessionKey = `${PLUGIN_ID}:${task.job_id}:${context.gpt.attemptId}`;
  const evidenceRefs: string[] = [];
  let actionOrdinal = 0;
  const execute: SeoChild = async (input) => {
    const result = await context.gpt.execute({ ...input, sessionKey, actionOrdinal: ++actionOrdinal });
    evidenceRefs.push(result.evidenceRef);
    return result;
  };
  return Object.freeze({ evidenceRefs, execute });
};

const applyExactProfile = async (execute: SeoChild, stepId: string): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-open", child: "open_gpt_execution_profile", actionOrdinal: 0, input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-selector-open", child: "open_gpt_model_selector_v2", actionOrdinal: 0, input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-select", child: "select_exact_gpt_model_v2", actionOrdinal: 0, input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "reasoning-select", child: "ensure_exact_gpt_reasoning_tier", actionOrdinal: 0, input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-close", child: "close_gpt_execution_profile", actionOrdinal: 0, input: { profile: MODEL_PROFILE } });
};

const submitTextTurn = async (input: Readonly<{
  execute: SeoChild;
  stepId: string;
  prompt: string;
  marker: string;
  files: readonly Readonly<Record<string, unknown>>[];
}>): Promise<SeoTurnCheckpoint> => {
  const written = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 0, input: { prompt: input.prompt } });
  const promptHash = hashValue(objectValue(written.value, "SEO_PROMPT_WRITE_INVALID").hash, "SEO_PROMPT_WRITE_INVALID");
  await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: 0, input: { files: input.files, prompt: input.prompt, turnMarker: input.marker } });
  await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 0, input: { promptHash, turnMarker: input.marker } });
  const submitted = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile", child: "reconcile_gpt_turn_submission", actionOrdinal: 0, input: { timeoutMs: 60_000, turnMarker: input.marker } });
  const canonicalConversationUrl = textValue(objectValue(submitted.value, "SEO_SUBMISSION_INVALID").canonicalConversationUrl, "SEO_SUBMISSION_INVALID");
  const stable = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "text-wait", child: "wait_for_stable_gpt_text", actionOrdinal: 0, input: { timeoutMs: WAIT_TIMEOUT_MS, turnMarker: input.marker } });
  const stableValue = objectValue(stable.value, "SEO_TEXT_RESPONSE_INVALID");
  const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_TEXT_RESPONSE_INVALID");
  const responseHash = hashValue(stableValue.responseHash, "SEO_TEXT_RESPONSE_INVALID");
  const checkpoint = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "text-checkpoint", child: "checkpoint_gpt_text_response", actionOrdinal: 0, input: { assistantTurnId, expectedResponseHash: responseHash } });
  const checkpointValue = objectValue(checkpoint.value, "SEO_TEXT_CHECKPOINT_INVALID");
  return Object.freeze({
    rawText: textValue(checkpointValue.rawText, "SEO_TEXT_CHECKPOINT_INVALID"),
    rawHash: hashValue(checkpointValue.rawHash, "SEO_TEXT_CHECKPOINT_INVALID"),
    canonicalConversationUrl,
    turnMarker: input.marker,
  });
};

const focusContinuation = async (
  execute: SeoChild,
  task: WebsiteAgentTask,
  stepId: string,
  continuationRef: string,
): Promise<GptContinuationLane> => {
  const acquired = await execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-acquire",
    child: "acquire_gpt_continuation_lane", actionOrdinal: 0,
    input: {
      allowedSourcePluginIds: [PLUGIN_ID], authorizationRef: task.business_identity.authorization_ref,
      continuationRef, jobId: task.job_id, ownerRef: task.business_identity.owner_ref,
      pluginId: PLUGIN_ID, subjectRef: task.business_identity.subject_ref,
    },
  });
  const lane = laneValue(acquired.value);
  await execute({ sessionKey: "", productStepId: stepId, callId: "conversation-focus", child: "focus_exact_gpt_conversation", actionOrdinal: 0, input: { canonicalConversationUrl: lane.provider.provider_page_url } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "conversation-verify", child: "verify_gpt_conversation_identity", actionOrdinal: 0, input: { canonicalConversationUrl: lane.provider.provider_page_url, timeoutMs: 60_000, turnMarker: lane.provider.prior_turn_marker } });
  return lane;
};

const releaseLane = async (execute: SeoChild, task: WebsiteAgentTask, stepId: string, lane: GptContinuationLane): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "continuation-release", child: "release_gpt_continuation_lane", actionOrdinal: 0, input: { jobId: task.job_id, lane } });
};

const advanceLane = async (
  execute: SeoChild,
  task: WebsiteAgentTask,
  stepId: string,
  lane: GptContinuationLane,
  checkpoint: Pick<SeoTurnCheckpoint, "canonicalConversationUrl" | "rawHash" | "turnMarker">,
): Promise<void> => {
  await execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-advance",
    child: "advance_gpt_continuation_lane", actionOrdinal: 0,
    input: {
      jobId: task.job_id, lane, pluginId: PLUGIN_ID,
      provider: {
        provider_page_url: checkpoint.canonicalConversationUrl,
        prior_task_id: task.job_id,
        prior_raw_output_hash: checkpoint.rawHash,
        prior_turn_marker: checkpoint.turnMarker,
      },
    },
  });
};

const generateImage = async (input: Readonly<{
  execute: SeoChild;
  task: WebsiteAgentTask;
  marker: string;
  stepId: string;
  continuationRef: string;
}>): Promise<GeneratedImageArtifact> => {
  const lane = await focusContinuation(input.execute, input.task, input.stepId, input.continuationRef);
  let advanced = false;
  try {
    await applyExactProfile(input.execute, input.stepId);
    const prompt = imagePrompt(input.task, input.marker);
    const written = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 0, input: { prompt } });
    const promptHash = hashValue(objectValue(written.value, "SEO_IMAGE_PROMPT_INVALID").hash, "SEO_IMAGE_PROMPT_INVALID");
    await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: 0, input: { files: [], prompt, turnMarker: input.marker } });
    await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 0, input: { promptHash, turnMarker: input.marker } });
    const submitted = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile", child: "reconcile_gpt_turn_submission", actionOrdinal: 0, input: { timeoutMs: 60_000, turnMarker: input.marker } });
    const canonicalConversationUrl = textValue(objectValue(submitted.value, "SEO_IMAGE_SUBMISSION_INVALID").canonicalConversationUrl, "SEO_IMAGE_SUBMISSION_INVALID");
    const stable = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "image-wait", child: "wait_for_stable_gpt_image", actionOrdinal: 0, input: { timeoutMs: WAIT_TIMEOUT_MS, turnMarker: input.marker } });
    const stableValue = objectValue(stable.value, "SEO_IMAGE_RESPONSE_INVALID");
    const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_IMAGE_RESPONSE_INVALID");
    const responseHash = hashValue(stableValue.responseHash, "SEO_IMAGE_RESPONSE_INVALID");
    const checkpoint = await input.execute({ sessionKey: "", productStepId: input.stepId, callId: "image-checkpoint", child: "checkpoint_gpt_generated_image", actionOrdinal: 0, input: { assistantTurnId } });
    const artifact = objectValue(checkpoint.value, "SEO_IMAGE_ARTIFACT_INVALID");
    if (artifact.mediaType !== "image/webp" || artifact.width !== 1200 || artifact.height !== 630
      || !Number.isSafeInteger(artifact.bytes) || Number(artifact.bytes) < 1) throw new Error("SEO_IMAGE_ARTIFACT_INVALID");
    const generated: GeneratedImageArtifact = Object.freeze({
      artifact_id: textValue(artifact.artifactId, "SEO_IMAGE_ARTIFACT_INVALID"),
      local_path: textValue(artifact.localPath, "SEO_IMAGE_ARTIFACT_INVALID"),
      original_local_path: textValue(artifact.originalLocalPath, "SEO_IMAGE_ARTIFACT_INVALID"),
      sha256: hashValue(artifact.sha256, "SEO_IMAGE_ARTIFACT_INVALID"),
      original_sha256: hashValue(artifact.originalSha256, "SEO_IMAGE_ARTIFACT_INVALID"),
      bytes: Number(artifact.bytes), media_type: "image/webp", width: 1200, height: 630,
    });
    await advanceLane(input.execute, input.task, input.stepId, lane, {
      canonicalConversationUrl, rawHash: responseHash, turnMarker: input.marker,
    });
    advanced = true;
    return generated;
  } finally {
    if (!advanced) await releaseLane(input.execute, input.task, input.stepId, lane);
  }
};

const executeArticleProduction = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const files = attachmentFiles(context);
  const researchStep = "corpus_research";
  const researchMarker = turnMarker(task, context.gpt.attemptId, researchStep);
  await flow.execute({ sessionKey: "", productStepId: researchStep, callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 0, input: { timeoutMs: 60_000 } });
  await applyExactProfile(flow.execute, researchStep);
  await flow.execute({ sessionKey: "", productStepId: researchStep, callId: "attachment-control-open", child: "open_gpt_attachment_control", actionOrdinal: 0, input: {} });
  await flow.execute({ sessionKey: "", productStepId: researchStep, callId: "attachments-attach", child: "attach_approved_gpt_files_once", actionOrdinal: 0, input: { files } });
  await flow.execute({ sessionKey: "", productStepId: researchStep, callId: "attachments-reconcile", child: "reconcile_gpt_attachment_set", actionOrdinal: 0, input: { files } });
  const researchCheckpoint = await submitTextTurn({
    execute: flow.execute, stepId: researchStep, prompt: researchPrompt(task, researchMarker), marker: researchMarker, files,
  });
  const persisted = await flow.execute({
    sessionKey: "", productStepId: researchStep, callId: "continuation-persist", child: "persist_gpt_continuation", actionOrdinal: 0,
    input: {
      authorizationRef: task.business_identity.authorization_ref, jobId: task.job_id,
      ownerRef: task.business_identity.owner_ref, pluginId: PLUGIN_ID,
      subjectRef: task.business_identity.subject_ref,
      provider: {
        provider_page_url: researchCheckpoint.canonicalConversationUrl,
        prior_task_id: task.job_id,
        prior_raw_output_hash: researchCheckpoint.rawHash,
        prior_turn_marker: researchCheckpoint.turnMarker,
      },
    },
  });
  const continuationRef = textValue(objectValue(persisted.value, "SEO_CONTINUATION_PERSIST_INVALID").continuationRef, "SEO_CONTINUATION_PERSIST_INVALID");
  const research = parsePublicKnowledgeResearch(researchCheckpoint.rawText);
  if (research.decision === "decline") {
    return context.complete({
      payload: { schema_version: "public-knowledge-article-package.v1", research, article: null, image: null },
      evidence_refs: flow.evidenceRefs,
    });
  }

  const articleStep = "article_synthesis";
  const articleMarker = turnMarker(task, context.gpt.attemptId, articleStep);
  const articleLane = await focusContinuation(flow.execute, task, articleStep, continuationRef);
  let articleAdvanced = false;
  let article: Readonly<Record<string, unknown>>;
  try {
    await applyExactProfile(flow.execute, articleStep);
    const checkpoint = await submitTextTurn({
      execute: flow.execute, stepId: articleStep, prompt: articlePrompt(task, articleMarker), marker: articleMarker, files: [],
    });
    article = parsePublicKnowledgeArticle(checkpoint.rawText);
    await advanceLane(flow.execute, task, articleStep, articleLane, checkpoint);
    articleAdvanced = true;
  } finally {
    if (!articleAdvanced) await releaseLane(flow.execute, task, articleStep, articleLane);
  }

  const image = await generateImage({
    execute: flow.execute, task, stepId: "article_image_generation",
    marker: turnMarker(task, context.gpt.attemptId, "article_image_generation"), continuationRef,
  });
  return context.complete({
    payload: { schema_version: "public-knowledge-article-package.v1", research, article, image: null },
    evidence_refs: flow.evidenceRefs,
    generated_image: image,
  });
};

const executeReview = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const stepId = task.action_id;
  const marker = turnMarker(task, context.gpt.attemptId, stepId);
  const files = attachmentFiles(context);
  await flow.execute({ sessionKey: "", productStepId: stepId, callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 0, input: { timeoutMs: 60_000 } });
  await applyExactProfile(flow.execute, stepId);
  await flow.execute({ sessionKey: "", productStepId: stepId, callId: "attachment-control-open", child: "open_gpt_attachment_control", actionOrdinal: 0, input: {} });
  await flow.execute({ sessionKey: "", productStepId: stepId, callId: "attachments-attach", child: "attach_approved_gpt_files_once", actionOrdinal: 0, input: { files } });
  await flow.execute({ sessionKey: "", productStepId: stepId, callId: "attachments-reconcile", child: "reconcile_gpt_attachment_set", actionOrdinal: 0, input: { files } });
  const checkpoint = await submitTextTurn({
    execute: flow.execute, stepId, prompt: reviewPrompt(task, marker), marker, files,
  });
  const payload = parseRouteResult(task, checkpoint.rawText);
  return context.complete({ payload, evidence_refs: flow.evidenceRefs });
};

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: PLUGIN_ID, pluginVersion: 9, skillHash: skill.hash, checkpointSchemaVersion: 2,
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
