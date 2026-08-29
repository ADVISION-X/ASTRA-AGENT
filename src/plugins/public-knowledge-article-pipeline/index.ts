import { createHash } from "node:crypto";

import {
  buildGptExecutionProfile,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptAttachmentProviderDisplayName,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import {
  readProductSkill,
  type ExactGptCallFacts,
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
  publicKnowledgeTurnContract,
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
const SEO_CHILD_HANDOFF_DELAY_MS = 2_000;

type SeoChild = ProductGptTools["execute"];
type SeoCall = Parameters<SeoChild>[0];
type SeoTurnCheckpoint = Readonly<{
  rawText: string;
  rawHash: ProductionHash;
  canonicalConversationUrl: string;
  turnMarker: string;
}>;
type SeoUploadedAttachment = Readonly<Record<string, unknown>> & Readonly<{
  providerDisplayName: string;
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
const textHash = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const uploadedAttachmentFiles = (value: unknown, code: string): readonly SeoUploadedAttachment[] => {
  const files = objectValue(value, code).files;
  if (!Array.isArray(files) || files.length === 0) throw new Error(code);
  return files.map((file) => {
    const attachment = objectValue(file, code);
    return Object.freeze({
      ...attachment,
      providerDisplayName: textValue(attachment.providerDisplayName, code),
    });
  });
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
  `当前业务事实：${JSON.stringify(task.action_id === "produce_article"
    ? { domain_id: task.parameters.domain_id, locale: task.parameters.locale }
    : { review_action: task.action_id })}`,
  instruction,
  `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`,
].join("\n");

const researchPrompt = (
  task: WebsiteAgentTask,
  marker: string,
  providerDisplayNames: readonly string[],
): string => promptEnvelope(task, marker, [
  `读取且只读取本轮两个附件：${providerDisplayNames.join(" 与 ")}。`,
  "从冻结 READY 语料与现役文章目录中研究一个可公开、可引用、可核验、且不存在实质重复的问题。",
  "材料不足或没有实质新意时必须 decision=decline；否则 decision=proceed。",
  `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("research"))}`,
  "严格返回当前 research 子合同的全部且仅有字段；本回合不得返回 article package。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

const articlePrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "仅依据本 conversation 已 checkpoint 的 public-knowledge-research-output.v3 研究结论写成文章。",
  "不得重新选题、不得引入未在研究中出现的来源或主张；引用 identity 与顺序必须保持一致。",
  `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("article"))}`,
  "严格返回当前 article 子合同的全部且仅有字段。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

const imagePrompt = (task: WebsiteAgentTask, marker: string): string => promptEnvelope(task, marker, [
  "仅依据本 conversation 已完成的研究和文章，生成一张横向文章主图。",
  "本轮唯一业务输出是一张可下载的生成图片。",
].join("\n"));

const reviewPrompt = (
  task: WebsiteAgentTask,
  marker: string,
  providerDisplayNames: readonly string[],
): string => promptEnvelope(task, marker, [
  `读取且只读取本轮两个附件：${providerDisplayNames.join(" 与 ")}。`,
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

const providerDisplayNames = (
  files: readonly Readonly<Record<string, unknown>>[],
  attemptId: string,
): readonly string[] => files.map((file) => gptAttachmentProviderDisplayName(
  textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
  attemptId,
  textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
));

const expectedUploadedFiles = (
  files: readonly Readonly<Record<string, unknown>>[],
  attemptId: string,
): readonly SeoUploadedAttachment[] => files.map((file) => Object.freeze({
  artifactRef: textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
  displayName: textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
  providerDisplayName: gptAttachmentProviderDisplayName(
    textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
    attemptId,
    textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
  ),
  sha256: hashValue(file.sha256, "SEO_ATTACHMENT_HASH_INVALID"),
  bytes: file.bytes,
}));

const createSeoExecutor = (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const sessionKey = `${PLUGIN_ID}:${task.job_id}:${context.gpt.attemptId}`;
  const evidenceByOrdinal = new Map<number, string>();
  const browserEvidenceSteps = new Set<string>();
  const anchoredSteps = new Set<string>();
  let priorChildCompleted = false;
  const recordEvidence = (actionOrdinal: number, evidenceRef: string): void => {
    const current = evidenceByOrdinal.get(actionOrdinal);
    if (current && current !== evidenceRef) throw new Error("SEO_EVIDENCE_SEQUENCE_CONFLICT");
    evidenceByOrdinal.set(actionOrdinal, evidenceRef);
  };
  const facts = async (input: Omit<SeoCall, "sessionKey">): Promise<ExactGptCallFacts> => {
    const result = await context.gpt.readCallFacts(input);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.child];
    if (contract.requiredTargetKind === "chatgpt" && result.evidence) {
      browserEvidenceSteps.add(input.productStepId);
    }
    if (result.mutation) anchoredSteps.add(input.productStepId);
    if (result.evidence) recordEvidence(input.actionOrdinal, result.evidence.evidenceRef);
    return result;
  };
  const execute: SeoChild = async (input) => {
    await facts(input);
    const contract = GPT_CHILD_CAPABILITY_CONTRACTS[input.child];
    if (contract.requiredTargetKind === "chatgpt"
      && browserEvidenceSteps.has(input.productStepId)
      && !anchoredSteps.has(input.productStepId)) {
      throw new Error("SEO_EXACT_TARGET_REHYDRATION_UNAVAILABLE");
    }
    if (priorChildCompleted) {
      await new Promise<void>((resolve) => setTimeout(resolve, SEO_CHILD_HANDOFF_DELAY_MS));
    }
    const result = await context.gpt.execute({ ...input, sessionKey });
    priorChildCompleted = true;
    recordEvidence(input.actionOrdinal, result.evidenceRef);
    return result;
  };
  const requireEvidence = async (input: Omit<SeoCall, "sessionKey">): Promise<void> => {
    const current = await facts(input);
    if (!current.evidence) throw new Error("SEO_PROGRESSIVE_PREFIX_EVIDENCE_MISSING");
  };
  const evidenceRefs = (): readonly string[] => Object.freeze(
    [...evidenceByOrdinal.entries()].sort((left, right) => left[0] - right[0]).map((entry) => entry[1]),
  );
  return Object.freeze({ evidenceRefs, execute, facts, requireEvidence });
};

type SeoProfileOrdinals = readonly [number, number, number, number, number];

const applyExactProfile = async (
  execute: SeoChild,
  stepId: string,
  ordinals: SeoProfileOrdinals,
): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-open", child: "open_gpt_execution_profile", actionOrdinal: ordinals[0], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-selector-open", child: "open_gpt_model_selector_v2", actionOrdinal: ordinals[1], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-select", child: "select_exact_gpt_model_v2", actionOrdinal: ordinals[2], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "reasoning-select", child: "ensure_exact_gpt_reasoning_tier", actionOrdinal: ordinals[3], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-close", child: "close_gpt_execution_profile", actionOrdinal: ordinals[4], input: { profile: MODEL_PROFILE } });
};

const requireExactProfileEvidence = async (
  flow: ReturnType<typeof createSeoExecutor>,
  stepId: string,
  ordinals: SeoProfileOrdinals,
): Promise<void> => {
  await flow.requireEvidence({ productStepId: stepId, callId: "profile-open", child: "open_gpt_execution_profile", actionOrdinal: ordinals[0], input: { profile: MODEL_PROFILE } });
  await flow.requireEvidence({ productStepId: stepId, callId: "model-selector-open", child: "open_gpt_model_selector_v2", actionOrdinal: ordinals[1], input: { profile: MODEL_PROFILE } });
  await flow.requireEvidence({ productStepId: stepId, callId: "model-select", child: "select_exact_gpt_model_v2", actionOrdinal: ordinals[2], input: { profile: MODEL_PROFILE } });
  await flow.requireEvidence({ productStepId: stepId, callId: "reasoning-select", child: "ensure_exact_gpt_reasoning_tier", actionOrdinal: ordinals[3], input: { profile: MODEL_PROFILE } });
  await flow.requireEvidence({ productStepId: stepId, callId: "profile-close", child: "close_gpt_execution_profile", actionOrdinal: ordinals[4], input: { profile: MODEL_PROFILE } });
};

const submitTextTurn = async (input: Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  prompt: string;
  marker: string;
  files: readonly Readonly<Record<string, unknown>>[];
  ordinals: readonly [number, number, number, number, number, number];
}>): Promise<SeoTurnCheckpoint> => {
  const promptHash = textHash(input.prompt);
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: input.ordinals[0], input: { prompt: input.prompt } } as const;
  const draftReconcile = { productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: input.ordinals[1], input: { files: input.files, prompt: input.prompt, turnMarker: input.marker } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: input.ordinals[2], input: { promptHash, turnMarker: input.marker } } as const;
  const beforeSubmit = await input.flow.facts(turnSubmit);
  if (beforeSubmit.mutation || beforeSubmit.evidence) {
    await input.flow.requireEvidence(promptWrite);
    await input.flow.requireEvidence(draftReconcile);
  } else {
    await input.flow.execute({ sessionKey: "", ...promptWrite });
    await input.flow.execute({ sessionKey: "", ...draftReconcile });
  }
  await input.flow.execute({ sessionKey: "", ...turnSubmit });
  const confirmedSubmit = await input.flow.facts(turnSubmit);
  if (confirmedSubmit.mutation?.outcome !== "CONFIRMED" || !confirmedSubmit.mutation.terminalAt) {
    throw new Error("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
  }
  const absoluteDeadline = new Date(
    Date.parse(confirmedSubmit.mutation.terminalAt) + WAIT_TIMEOUT_MS,
  ).toISOString();
  const submitted = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile", child: "reconcile_gpt_turn_submission", actionOrdinal: input.ordinals[3], input: { timeoutMs: 60_000, turnMarker: input.marker } });
  const canonicalConversationUrl = textValue(objectValue(submitted.value, "SEO_SUBMISSION_INVALID").canonicalConversationUrl, "SEO_SUBMISSION_INVALID");
  const stable = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "text-wait", child: "wait_for_stable_gpt_text", actionOrdinal: input.ordinals[4], input: { absoluteDeadline, turnMarker: input.marker } });
  const stableValue = objectValue(stable.value, "SEO_TEXT_RESPONSE_INVALID");
  const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_TEXT_RESPONSE_INVALID");
  const responseHash = hashValue(stableValue.responseHash, "SEO_TEXT_RESPONSE_INVALID");
  const checkpoint = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "text-checkpoint", child: "checkpoint_gpt_text_response", actionOrdinal: input.ordinals[5], input: { assistantTurnId, expectedResponseHash: responseHash } });
  const checkpointValue = objectValue(checkpoint.value, "SEO_TEXT_CHECKPOINT_INVALID");
  return Object.freeze({
    rawText: textValue(checkpointValue.rawText, "SEO_TEXT_CHECKPOINT_INVALID"),
    rawHash: hashValue(checkpointValue.rawHash, "SEO_TEXT_CHECKPOINT_INVALID"),
    canonicalConversationUrl,
    turnMarker: input.marker,
  });
};

const focusContinuation = async (
  flow: ReturnType<typeof createSeoExecutor>,
  task: WebsiteAgentTask,
  stepId: string,
  continuationRef: string,
  expectedProvider: GptProviderContinuation,
  expectedLaneVersion: number,
  ordinals: readonly [number, number, number],
  recoverOnly = false,
): Promise<GptContinuationLane> => {
  const acquireCall = {
    productStepId: stepId, callId: "continuation-acquire",
    child: "acquire_gpt_continuation_lane", actionOrdinal: ordinals[0],
    input: {
      allowedSourcePluginIds: [PLUGIN_ID], authorizationRef: task.business_identity.authorization_ref,
      continuationRef, jobId: task.job_id, ownerRef: task.business_identity.owner_ref,
      pluginId: PLUGIN_ID, subjectRef: task.business_identity.subject_ref,
    },
  } as const;
  const lane: GptContinuationLane = Object.freeze({
    continuation_ref: continuationRef,
    lane_version: expectedLaneVersion,
    provider: expectedProvider,
  });
  if (recoverOnly) {
    await flow.requireEvidence(acquireCall);
  } else {
    const acquired = laneValue((await flow.execute({ sessionKey: "", ...acquireCall })).value);
    if (JSON.stringify(acquired) !== JSON.stringify(lane)) {
      throw new Error("SEO_CONTINUATION_LANE_DRIFT");
    }
  }
  const focusCall = { productStepId: stepId, callId: "conversation-focus", child: "focus_exact_gpt_conversation", actionOrdinal: ordinals[1], input: { canonicalConversationUrl: lane.provider.provider_page_url } } as const;
  const verifyCall = { productStepId: stepId, callId: "conversation-verify", child: "verify_gpt_conversation_identity", actionOrdinal: ordinals[2], input: { canonicalConversationUrl: lane.provider.provider_page_url, timeoutMs: 60_000, turnMarker: lane.provider.prior_turn_marker } } as const;
  if (recoverOnly) {
    await flow.requireEvidence(focusCall);
    await flow.requireEvidence(verifyCall);
  } else {
    await flow.execute({ sessionKey: "", ...focusCall });
    await flow.execute({ sessionKey: "", ...verifyCall });
  }
  return lane;
};

const releaseLane = async (execute: SeoChild, task: WebsiteAgentTask, stepId: string, lane: GptContinuationLane, actionOrdinal: number): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "continuation-release", child: "release_gpt_continuation_lane", actionOrdinal, input: { jobId: task.job_id, lane } });
};

const advanceLane = async (
  execute: SeoChild,
  task: WebsiteAgentTask,
  stepId: string,
  lane: GptContinuationLane,
  checkpoint: Pick<SeoTurnCheckpoint, "canonicalConversationUrl" | "rawHash" | "turnMarker">,
  actionOrdinal: number,
): Promise<void> => {
  await execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-advance",
    child: "advance_gpt_continuation_lane", actionOrdinal,
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
  flow: ReturnType<typeof createSeoExecutor>;
  task: WebsiteAgentTask;
  marker: string;
  stepId: string;
  continuationRef: string;
  expectedProvider: GptProviderContinuation;
}>): Promise<GeneratedImageArtifact> => {
  const prompt = imagePrompt(input.task, input.marker);
  const promptHash = textHash(prompt);
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 40, input: { prompt } } as const;
  const draftReconcile = { productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: 41, input: { files: [], prompt, turnMarker: input.marker } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 42, input: { promptHash, turnMarker: input.marker } } as const;
  const beforeSubmit = await input.flow.facts(turnSubmit);
  const recovering = Boolean(beforeSubmit.mutation || beforeSubmit.evidence);
  const lane = await focusContinuation(
    input.flow, input.task, input.stepId, input.continuationRef,
    input.expectedProvider, 2, [32, 33, 34], recovering,
  );
  let advanced = false;
  try {
    if (recovering) {
      await requireExactProfileEvidence(input.flow, input.stepId, [35, 36, 37, 38, 39]);
      await input.flow.requireEvidence(promptWrite);
      await input.flow.requireEvidence(draftReconcile);
    } else {
      await applyExactProfile(input.flow.execute, input.stepId, [35, 36, 37, 38, 39]);
      await input.flow.execute({ sessionKey: "", ...promptWrite });
      await input.flow.execute({ sessionKey: "", ...draftReconcile });
    }
    await input.flow.execute({ sessionKey: "", ...turnSubmit });
    const confirmedSubmit = await input.flow.facts(turnSubmit);
    if (confirmedSubmit.mutation?.outcome !== "CONFIRMED" || !confirmedSubmit.mutation.terminalAt) {
      throw new Error("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
    }
    const absoluteDeadline = new Date(
      Date.parse(confirmedSubmit.mutation.terminalAt) + WAIT_TIMEOUT_MS,
    ).toISOString();
    const submitted = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile", child: "reconcile_gpt_turn_submission", actionOrdinal: 43, input: { timeoutMs: 60_000, turnMarker: input.marker } });
    const canonicalConversationUrl = textValue(objectValue(submitted.value, "SEO_IMAGE_SUBMISSION_INVALID").canonicalConversationUrl, "SEO_IMAGE_SUBMISSION_INVALID");
    const stable = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "image-wait", child: "wait_for_stable_gpt_image", actionOrdinal: 44, input: { absoluteDeadline, turnMarker: input.marker } });
    const stableValue = objectValue(stable.value, "SEO_IMAGE_RESPONSE_INVALID");
    const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_IMAGE_RESPONSE_INVALID");
    const responseHash = hashValue(stableValue.responseHash, "SEO_IMAGE_RESPONSE_INVALID");
    const checkpoint = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "image-checkpoint", child: "checkpoint_gpt_generated_image", actionOrdinal: 45, input: { assistantTurnId } });
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
    await advanceLane(input.flow.execute, input.task, input.stepId, lane, {
      canonicalConversationUrl, rawHash: responseHash, turnMarker: input.marker,
    }, 46);
    advanced = true;
    return generated;
  } finally {
    if (!advanced) await releaseLane(input.flow.execute, input.task, input.stepId, lane, 47);
  }
};

const prepareAttachedTurnPrefix = async (input: Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  files: readonly Readonly<Record<string, unknown>>[];
  uploadedFiles: readonly SeoUploadedAttachment[];
  recoverOnly: boolean;
}>): Promise<void> => {
  const freshChat = { productStepId: input.stepId, callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 1, input: { timeoutMs: 60_000 } } as const;
  const attachmentOpen = { productStepId: input.stepId, callId: "attachment-control-open", child: "open_gpt_attachment_control", actionOrdinal: 7, input: {} } as const;
  const attachmentsAttach = { productStepId: input.stepId, callId: "attachments-attach", child: "attach_approved_gpt_files_once", actionOrdinal: 8, input: { files: input.files } } as const;
  const attachmentsReconcile = { productStepId: input.stepId, callId: "attachments-reconcile", child: "reconcile_gpt_attachment_set", actionOrdinal: 9, input: { files: input.files, timeoutMs: 60_000 } } as const;
  if (input.recoverOnly) {
    await input.flow.requireEvidence(freshChat);
    await requireExactProfileEvidence(input.flow, input.stepId, [2, 3, 4, 5, 6]);
    await input.flow.requireEvidence(attachmentOpen);
    await input.flow.requireEvidence(attachmentsAttach);
    await input.flow.requireEvidence(attachmentsReconcile);
    return;
  }
  await input.flow.execute({ sessionKey: "", ...freshChat });
  await applyExactProfile(input.flow.execute, input.stepId, [2, 3, 4, 5, 6]);
  await input.flow.execute({ sessionKey: "", ...attachmentOpen });
  await input.flow.execute({ sessionKey: "", ...attachmentsAttach });
  const reconciled = await input.flow.execute({ sessionKey: "", ...attachmentsReconcile });
  const actual = uploadedAttachmentFiles(reconciled.value, "SEO_ATTACHMENT_RECONCILIATION_INVALID");
  if (JSON.stringify(actual) !== JSON.stringify(input.uploadedFiles)) {
    throw new Error("SEO_ATTACHMENT_RECONCILIATION_INVALID");
  }
};

const executeArticleProduction = async (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const flow = createSeoExecutor(task, context);
  const files = attachmentFiles(context);
  const uploadedFiles = expectedUploadedFiles(files, context.gpt.attemptId);
  const researchStep = "corpus_research";
  const researchMarker = turnMarker(task, context.gpt.attemptId, researchStep);
  const researchPromptValue = researchPrompt(
    task, researchMarker, providerDisplayNames(files, context.gpt.attemptId),
  );
  const researchSubmit = { productStepId: researchStep, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 12, input: { promptHash: textHash(researchPromptValue), turnMarker: researchMarker } } as const;
  const researchSubmitFacts = await flow.facts(researchSubmit);
  await prepareAttachedTurnPrefix({
    flow, stepId: researchStep, files, uploadedFiles,
    recoverOnly: Boolean(researchSubmitFacts.mutation || researchSubmitFacts.evidence),
  });
  const researchCheckpoint = await submitTextTurn({
    flow, stepId: researchStep, prompt: researchPromptValue,
    marker: researchMarker, files: uploadedFiles, ordinals: [10, 11, 12, 13, 14, 15],
  });
  const researchProvider: GptProviderContinuation = Object.freeze({
    provider_page_url: researchCheckpoint.canonicalConversationUrl,
    prior_task_id: task.job_id,
    prior_raw_output_hash: researchCheckpoint.rawHash,
    prior_turn_marker: researchCheckpoint.turnMarker,
  });
  const persisted = await flow.execute({
    sessionKey: "", productStepId: researchStep, callId: "continuation-persist", child: "persist_gpt_continuation", actionOrdinal: 16,
    input: {
      authorizationRef: task.business_identity.authorization_ref, jobId: task.job_id,
      ownerRef: task.business_identity.owner_ref, pluginId: PLUGIN_ID,
      subjectRef: task.business_identity.subject_ref,
      provider: researchProvider,
    },
  });
  const continuationRef = textValue(objectValue(persisted.value, "SEO_CONTINUATION_PERSIST_INVALID").continuationRef, "SEO_CONTINUATION_PERSIST_INVALID");
  const research = parsePublicKnowledgeResearch(researchCheckpoint.rawText);
  if (research.decision === "decline") {
    return context.complete({
      payload: { schema_version: "public-knowledge-article-package.v1", research, article: null, image: null },
      evidence_refs: flow.evidenceRefs(),
    });
  }

  const articleStep = "article_synthesis";
  const articleMarker = turnMarker(task, context.gpt.attemptId, articleStep);
  const articlePromptValue = articlePrompt(task, articleMarker);
  const articleSubmit = { productStepId: articleStep, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 27, input: { promptHash: textHash(articlePromptValue), turnMarker: articleMarker } } as const;
  const articleSubmitFacts = await flow.facts(articleSubmit);
  const articleRecovering = Boolean(articleSubmitFacts.mutation || articleSubmitFacts.evidence);
  const articleLane = await focusContinuation(
    flow, task, articleStep, continuationRef, researchProvider, 1, [17, 18, 19], articleRecovering,
  );
  let articleAdvanced = false;
  let article: Readonly<Record<string, unknown>>;
  let articleCheckpoint: SeoTurnCheckpoint;
  try {
    if (articleRecovering) await requireExactProfileEvidence(flow, articleStep, [20, 21, 22, 23, 24]);
    else await applyExactProfile(flow.execute, articleStep, [20, 21, 22, 23, 24]);
    const checkpoint = await submitTextTurn({
      flow, stepId: articleStep, prompt: articlePromptValue, marker: articleMarker,
      files: [], ordinals: [25, 26, 27, 28, 29, 30],
    });
    articleCheckpoint = checkpoint;
    article = parsePublicKnowledgeArticle(checkpoint.rawText);
    await advanceLane(flow.execute, task, articleStep, articleLane, checkpoint, 31);
    articleAdvanced = true;
  } finally {
    if (!articleAdvanced) await releaseLane(flow.execute, task, articleStep, articleLane, 32);
  }

  const image = await generateImage({
    flow, task, stepId: "article_image_generation",
    marker: turnMarker(task, context.gpt.attemptId, "article_image_generation"), continuationRef,
    expectedProvider: Object.freeze({
      provider_page_url: articleCheckpoint.canonicalConversationUrl,
      prior_task_id: task.job_id,
      prior_raw_output_hash: articleCheckpoint.rawHash,
      prior_turn_marker: articleCheckpoint.turnMarker,
    }),
  });
  return context.complete({
    payload: { schema_version: "public-knowledge-article-package.v1", research, article, image: null },
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
  const payload = parseRouteResult(task, checkpoint.rawText);
  return context.complete({ payload, evidence_refs: flow.evidenceRefs() });
};

export const publicKnowledgeArticlePipelinePlugin: ProductPlugin = {
  pluginId: PLUGIN_ID, pluginVersion: 14, skillHash: skill.hash, checkpointSchemaVersion: 2,
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
