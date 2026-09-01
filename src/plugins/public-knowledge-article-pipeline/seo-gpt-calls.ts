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
  ProductGptFactQuery,
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

export const preservePostSubmitReadback = (error: unknown, submit: ExactGptCallFacts): never => {
  const typed = typedExecutionFailure(error);
  const code = failureCode(error);
  if (!typed || typed.mutationOutcome !== "no" || code.startsWith("GPT_PROVIDER_TERMINAL_")) throw error;
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
  const facts = async (
    input: Omit<SeoCall, "sessionKey">,
    lookupKind: NonNullable<ProductGptFactQuery["lookupKind"]> = "current_attempt",
  ): Promise<ExactGptCallFacts> => {
    const result = await context.gpt.readCallFacts({ ...input, lookupKind });
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
  return Object.freeze({
    evidenceRefs,
    execute,
    facts,
    recordRecoveredEvidence: recordEvidence,
    requireEvidence,
  });
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

export const confirmedDeadline = (submit: ExactGptCallFacts): string => {
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
      artifactRef: artifactRefs[0],
      evidenceRef: checkpoint.evidenceRef,
      evidenceHash: checkpoint.evidenceHash,
      canonicalConversationUrl, promptHash, turnMarker: input.marker,
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
  releaseOrdinal: number,
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
  let handedOff = false;
  try {
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
    handedOff = true;
    return lane;
  } finally {
    if (!handedOff) await releaseLane(flow.execute, task, stepId, lane, releaseOrdinal);
  }
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
  checkpoint: Readonly<{
    canonicalConversationUrl: string;
    promptHash: ProductionHash;
    rawOutputHash: ProductionHash;
    turnMarker: string;
  }>,
  currentCheckpoint: Readonly<Record<string, unknown>>,
  actionOrdinal: number,
): Promise<void> => {
  await execute({
    sessionKey: "", productStepId: stepId, callId: "continuation-advance",
    child: "advance_gpt_continuation_lane", actionOrdinal,
    input: {
      currentCheckpoint, jobId: task.job_id, lane, pluginId: PLUGIN_ID,
      provider: {
        provider_page_url: checkpoint.canonicalConversationUrl,
        prior_task_id: task.job_id,
        prior_prompt_hash: checkpoint.promptHash,
        prior_raw_output_hash: checkpoint.rawOutputHash,
        prior_turn_marker: checkpoint.turnMarker,
      },
    },
  });
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
