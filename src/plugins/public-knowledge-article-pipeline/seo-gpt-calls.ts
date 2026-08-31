import {
  buildGptExecutionProfile,
  type GptContinuationLane,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import type {
  ProductionHash,
  WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import type {
  ExactGptCallFacts,
  GeneratedImageArtifact,
  SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  failureCode,
  postSubmitReadbackFault,
  typedExecutionFailure,
} from "../../lib/typed-failure.js";
import {
  PLUGIN_ID,
  fail,
  hashValue,
  imagePrompt,
  objectValue,
  textHash,
  textValue,
  type SeoCall,
  type SeoChild,
  type SeoTurnCheckpoint,
  type SeoUploadedAttachment,
} from "./seo-turn-contract.js";
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

const preservePostSubmitReadback = (error: unknown, submit: ExactGptCallFacts): never => {
  const typed = typedExecutionFailure(error);
  const code = failureCode(error);
  const terminalFailure = code === "GPT_RESPONSE_STABILITY_TIMEOUT"
    || code === "GPT_IMAGE_STABILITY_TIMEOUT"
    || code === "GPT_RESPONSE_WAIT_ABORTED"
    || code === "GPT_IMAGE_WAIT_ABORTED"
    || code.startsWith("GPT_PROVIDER_TERMINAL_")
    || code.startsWith("GPT_RATE_LIMIT_");
  if (!typed || typed.mutationOutcome !== "no" || terminalFailure) throw error;
  if (submit.mutation?.owner !== "browser"
    || submit.mutation.effectScope !== "provider_effect"
    || submit.mutation.outcome !== "CONFIRMED"
    || !submit.mutation.terminalAt
    || submit.evidence?.owner !== "forensics-persistence"
    || submit.evidence.readbackVerified !== true) throw error;
  throw postSubmitReadbackFault(code, {
    causeCode: code,
    exactCallIdentityHash: submit.exactCallIdentityHash,
    terminalAt: submit.mutation.terminalAt,
    readbackDeadlineAt: confirmedDeadline(submit),
    evidenceRef: submit.evidence.evidenceRef,
    evidenceHash: submit.evidence.evidenceHash,
  });
};

const uploadedAttachmentFiles = (value: unknown, code: string): readonly SeoUploadedAttachment[] => {
  const files = objectValue(value, code).files;
  if (!Array.isArray(files) || files.length === 0) fail(code);
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
    prior_prompt_hash: hashValue(provider.prior_prompt_hash, "SEO_CONTINUATION_PROVIDER_INVALID"),
    prior_raw_output_hash: hashValue(provider.prior_raw_output_hash, "SEO_CONTINUATION_PROVIDER_INVALID"),
    prior_turn_marker: textValue(provider.prior_turn_marker, "SEO_CONTINUATION_PROVIDER_INVALID"),
  });
};

const laneValue = (value: unknown): GptContinuationLane => {
  const lane = objectValue(value, "SEO_CONTINUATION_LANE_INVALID");
  if (!Number.isSafeInteger(lane.lane_version)) fail("SEO_CONTINUATION_LANE_INVALID");
  return Object.freeze({
    continuation_ref: textValue(lane.continuation_ref, "SEO_CONTINUATION_LANE_INVALID"),
    lane_version: Number(lane.lane_version),
    provider: providerValue(lane.provider),
  });
};

export const createSeoExecutor = (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  const sessionKey = `${PLUGIN_ID}:${task.job_id}:${context.gpt.attemptId}`;
  const evidenceByOrdinal = new Map<number, string>();
  let priorChildCompleted = false;
  const recordEvidence = (actionOrdinal: number, evidenceRef: string): void => {
    const current = evidenceByOrdinal.get(actionOrdinal);
    if (current && current !== evidenceRef) fail("SEO_EVIDENCE_SEQUENCE_CONFLICT");
    evidenceByOrdinal.set(actionOrdinal, evidenceRef);
  };
  const facts = async (input: Omit<SeoCall, "sessionKey">): Promise<ExactGptCallFacts> => {
    const result = await context.gpt.readCallFacts(input);
    if (result.evidence) recordEvidence(input.actionOrdinal, result.evidence.evidenceRef);
    return result;
  };
  const execute: SeoChild = async (input) => {
    await facts(input);
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
    if (!current.evidence) fail("SEO_PROGRESSIVE_PREFIX_EVIDENCE_MISSING");
  };
  const evidenceRefs = (): readonly string[] => Object.freeze(
    [...evidenceByOrdinal.entries()].sort((left, right) => left[0] - right[0]).map((entry) => entry[1]),
  );
  return Object.freeze({ evidenceRefs, execute, facts, requireEvidence });
};

type SeoProfileOrdinals = readonly [number, number, number, number, number];

export const applyExactProfile = async (
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

export const requireExactProfileEvidence = async (
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

type TextTurnInput = Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  prompt: string;
  marker: string;
  files: readonly Readonly<Record<string, unknown>>[];
  ordinals: readonly [number, number, number, number, number, number];
  recoveryProvider?: GptProviderContinuation;
}>;

const confirmedDeadline = (submit: ExactGptCallFacts): string => {
  if (submit.mutation?.outcome !== "CONFIRMED" || !submit.mutation.terminalAt) {
    fail("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
  }
  const confirmedAt = Date.parse(submit.mutation.terminalAt);
  if (!Number.isFinite(confirmedAt)) fail("SEO_PROVIDER_EFFECT_TERMINAL_FACT_MISSING");
  return new Date(confirmedAt + WAIT_TIMEOUT_MS).toISOString();
};

const submittedConversationUrl = async (
  input: TextTurnInput,
  promptHash: `sha256:${string}`,
): Promise<string> => {
  const call = {
    productStepId: input.stepId, callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission", actionOrdinal: input.ordinals[3],
    input: { expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker: input.marker },
  } as const;
  const submitted = await input.flow.execute({ sessionKey: "", ...call });
  return textValue(
    objectValue(submitted.value, "SEO_SUBMISSION_INVALID").canonicalConversationUrl,
    "SEO_SUBMISSION_INVALID",
  );
};

const checkpointSubmittedTextTurn = async (
  input: TextTurnInput,
  promptHash: `sha256:${string}`,
  confirmedSubmit: ExactGptCallFacts,
): Promise<SeoTurnCheckpoint> => {
  try {
    const canonicalConversationUrl = await submittedConversationUrl(input, promptHash);
    const stable = await input.flow.execute({
      sessionKey: "", productStepId: input.stepId, callId: "text-wait",
      child: "wait_for_stable_gpt_text", actionOrdinal: input.ordinals[4],
      input: {
        absoluteDeadline: confirmedDeadline(confirmedSubmit), canonicalConversationUrl,
        expectedPromptHash: promptHash, turnMarker: input.marker,
      },
    });
    const stableValue = objectValue(stable.value, "SEO_TEXT_RESPONSE_INVALID");
    const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_TEXT_RESPONSE_INVALID");
    const responseHash = hashValue(stableValue.responseHash, "SEO_TEXT_RESPONSE_INVALID");
    if (input.recoveryProvider && (promptHash !== input.recoveryProvider.prior_prompt_hash
      || responseHash !== input.recoveryProvider.prior_raw_output_hash)) {
      fail("SEO_RECOVERED_RESPONSE_HASH_MISMATCH");
    }
    const checkpointCall = {
      productStepId: input.stepId, callId: "text-checkpoint",
      child: "checkpoint_gpt_text_response", actionOrdinal: input.ordinals[5],
      input: {
        assistantTurnId, canonicalConversationUrl, expectedPromptHash: promptHash,
        expectedResponseHash: responseHash, turnMarker: input.marker,
      },
    } as const;
    const checkpoint = await input.flow.execute({ sessionKey: "", ...checkpointCall });
    const checkpointFacts = await input.flow.facts(checkpointCall);
    const value = objectValue(checkpoint.value, "SEO_TEXT_CHECKPOINT_INVALID");
    const artifactRefs = checkpointFacts.evidence?.artifactRefs ?? [];
    if (artifactRefs.length !== 1 || !artifactRefs[0]) fail("SEO_TEXT_ARTIFACT_RECEIPT_INVALID");
    return Object.freeze({
      assistantTurnId,
      rawDomHtml: textValue(value.rawDomHtml, "SEO_TEXT_CHECKPOINT_INVALID"),
      rawDomHash: hashValue(value.rawDomHash, "SEO_TEXT_CHECKPOINT_INVALID"),
      semanticText: textValue(value.semanticText, "SEO_TEXT_CHECKPOINT_INVALID"),
      semanticTextHash: hashValue(value.semanticTextHash, "SEO_TEXT_CHECKPOINT_INVALID"),
      artifactRef: artifactRefs[0], canonicalConversationUrl, promptHash, turnMarker: input.marker,
    });
  } catch (error) {
    return preservePostSubmitReadback(error, confirmedSubmit);
  }
};

export const submitTextTurn = async (input: TextTurnInput): Promise<SeoTurnCheckpoint> => {
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
  confirmedDeadline(confirmedSubmit);
  return checkpointSubmittedTextTurn(input, promptHash, confirmedSubmit);
};

export const focusContinuation = async (
  flow: ReturnType<typeof createSeoExecutor>,
  task: WebsiteAgentTask,
  stepId: string,
  continuationRef: string,
  expectedProvider: GptProviderContinuation,
  ordinals: readonly [number, number, number],
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
  const lane = laneValue((await flow.execute({ sessionKey: "", ...acquireCall })).value);
  if (lane.continuation_ref !== continuationRef
    || JSON.stringify(lane.provider) !== JSON.stringify(expectedProvider)) {
    fail("SEO_CONTINUATION_LANE_DRIFT");
  }
  await flow.execute({
    sessionKey: "", productStepId: stepId, callId: "conversation-focus",
    child: "focus_exact_gpt_conversation", actionOrdinal: ordinals[1],
    input: { canonicalConversationUrl: lane.provider.provider_page_url },
  });
  await flow.execute({
    sessionKey: "", productStepId: stepId, callId: "conversation-verify",
    child: "verify_gpt_conversation_identity", actionOrdinal: ordinals[2],
    input: {
      canonicalConversationUrl: lane.provider.provider_page_url,
      expectedPromptHash: lane.provider.prior_prompt_hash,
      expectedResponseHash: lane.provider.prior_raw_output_hash,
      timeoutMs: 60_000,
      turnMarker: lane.provider.prior_turn_marker,
    },
  });
  return lane;
};

export const releaseLane = async (
  execute: SeoChild,
  task: WebsiteAgentTask,
  stepId: string,
  lane: GptContinuationLane,
  actionOrdinal: number,
): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "continuation-release", child: "release_gpt_continuation_lane", actionOrdinal, input: { jobId: task.job_id, lane } });
};

export const advanceLane = async (
  execute: SeoChild,
  task: WebsiteAgentTask,
  stepId: string,
  lane: GptContinuationLane,
  checkpoint: Pick<SeoTurnCheckpoint, "canonicalConversationUrl" | "promptHash" | "semanticTextHash" | "turnMarker">,
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
        prior_prompt_hash: checkpoint.promptHash,
        prior_raw_output_hash: checkpoint.semanticTextHash,
        prior_turn_marker: checkpoint.turnMarker,
      },
    },
  });
};

type ImageTurnInput = Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  task: WebsiteAgentTask;
  marker: string;
  stepId: string;
  continuationRef: string;
  expectedProvider: GptProviderContinuation;
}>;

const prepareImageSubmit = async (
  input: ImageTurnInput,
  prompt: string,
  promptHash: ProductionHash,
  recovering: boolean,
): Promise<ExactGptCallFacts> => {
  const promptWrite = { productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt", actionOrdinal: 40, input: { prompt } } as const;
  const draftReconcile = { productStepId: input.stepId, callId: "draft-reconcile", child: "reconcile_gpt_draft", actionOrdinal: 41, input: { files: [], prompt, turnMarker: input.marker } } as const;
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 42, input: { promptHash, turnMarker: input.marker } } as const;
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
  const confirmed = await input.flow.facts(turnSubmit);
  confirmedDeadline(confirmed);
  return confirmed;
};

const imageArtifact = (value: unknown): GeneratedImageArtifact => {
  const artifact = objectValue(value, "SEO_IMAGE_ARTIFACT_INVALID");
  if (artifact.mediaType !== "image/webp" || artifact.width !== 1200 || artifact.height !== 630
    || !Number.isSafeInteger(artifact.bytes) || Number(artifact.bytes) < 1) fail("SEO_IMAGE_ARTIFACT_INVALID");
  return Object.freeze({
    artifact_id: textValue(artifact.artifactId, "SEO_IMAGE_ARTIFACT_INVALID"),
    local_path: textValue(artifact.localPath, "SEO_IMAGE_ARTIFACT_INVALID"),
    original_local_path: textValue(artifact.originalLocalPath, "SEO_IMAGE_ARTIFACT_INVALID"),
    sha256: hashValue(artifact.sha256, "SEO_IMAGE_ARTIFACT_INVALID"),
    original_sha256: hashValue(artifact.originalSha256, "SEO_IMAGE_ARTIFACT_INVALID"),
    bytes: Number(artifact.bytes), media_type: "image/webp", width: 1200, height: 630,
  });
};

const checkpointSubmittedImage = async (
  input: ImageTurnInput,
  promptHash: ProductionHash,
  confirmedSubmit: ExactGptCallFacts,
): Promise<Readonly<{
  canonicalConversationUrl: string;
  responseHash: ProductionHash;
  generated: GeneratedImageArtifact;
}>> => {
  try {
    const submitted = await input.flow.execute({ sessionKey: "", productStepId: input.stepId, callId: "submission-reconcile", child: "reconcile_gpt_turn_submission", actionOrdinal: 43, input: { expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker: input.marker } });
    const canonicalConversationUrl = textValue(
      objectValue(submitted.value, "SEO_IMAGE_SUBMISSION_INVALID").canonicalConversationUrl,
      "SEO_IMAGE_SUBMISSION_INVALID",
    );
    const stable = await input.flow.execute({
      sessionKey: "", productStepId: input.stepId, callId: "image-wait",
      child: "wait_for_stable_gpt_image", actionOrdinal: 44,
      input: {
        absoluteDeadline: confirmedDeadline(confirmedSubmit), canonicalConversationUrl,
        expectedPromptHash: promptHash, turnMarker: input.marker,
      },
    });
    const stableValue = objectValue(stable.value, "SEO_IMAGE_RESPONSE_INVALID");
    const assistantTurnId = textValue(stableValue.assistantTurnId, "SEO_IMAGE_RESPONSE_INVALID");
    const responseHash = hashValue(stableValue.responseHash, "SEO_IMAGE_RESPONSE_INVALID");
    const checkpoint = await input.flow.execute({
      sessionKey: "", productStepId: input.stepId, callId: "image-checkpoint",
      child: "checkpoint_gpt_generated_image", actionOrdinal: 45,
      input: {
        assistantTurnId, canonicalConversationUrl, expectedPromptHash: promptHash,
        expectedResponseHash: responseHash, turnMarker: input.marker,
      },
    });
    return Object.freeze({
      canonicalConversationUrl,
      responseHash,
      generated: imageArtifact(checkpoint.value),
    });
  } catch (error) {
    return preservePostSubmitReadback(error, confirmedSubmit);
  }
};

export const generateImage = async (input: ImageTurnInput): Promise<GeneratedImageArtifact> => {
  const prompt = imagePrompt(input.task, input.marker);
  const promptHash = textHash(prompt);
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: 42, input: { promptHash, turnMarker: input.marker } } as const;
  const beforeSubmit = await input.flow.facts(turnSubmit);
  const lane = await focusContinuation(
    input.flow, input.task, input.stepId, input.continuationRef,
    input.expectedProvider, [32, 33, 34],
  );
  let advanced = false;
  try {
    const confirmed = await prepareImageSubmit(
      input, prompt, promptHash, Boolean(beforeSubmit.mutation || beforeSubmit.evidence),
    );
    const checkpoint = await checkpointSubmittedImage(input, promptHash, confirmed);
    await advanceLane(input.flow.execute, input.task, input.stepId, lane, {
      canonicalConversationUrl: checkpoint.canonicalConversationUrl,
      promptHash, semanticTextHash: checkpoint.responseHash, turnMarker: input.marker,
    }, 46);
    advanced = true;
    return checkpoint.generated;
  } finally {
    if (!advanced) await releaseLane(input.flow.execute, input.task, input.stepId, lane, 47);
  }
};

export const prepareAttachedTurnPrefix = async (input: Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  files: readonly Readonly<Record<string, unknown>>[];
  uploadedFiles: readonly SeoUploadedAttachment[];
  recoverOnly: boolean;
}>): Promise<void> => {
  const freshChat = { productStepId: input.stepId, callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 1, input: { timeoutMs: 60_000 } } as const;
  const attachmentOpen = { productStepId: input.stepId, callId: "attachment-control-open", child: "open_gpt_attachment_control", actionOrdinal: 7, input: {} } as const;
  const attachmentsAttach = { productStepId: input.stepId, callId: "attachments-attach", child: "attach_approved_gpt_files_once", actionOrdinal: 8, input: { files: input.files } } as const;
  const attachmentsReconcile = { productStepId: input.stepId, callId: "attachments-reconcile", child: "reconcile_gpt_attachment_set", actionOrdinal: 9, input: { files: input.files, timeoutMs: 600_000 } } as const;
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
    fail("SEO_ATTACHMENT_RECONCILIATION_INVALID");
  }
};
