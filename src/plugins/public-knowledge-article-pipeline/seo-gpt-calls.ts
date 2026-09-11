import {
  buildGptExecutionProfile,
} from "../../capabilities/gpt/index.js";
import type { WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import type {
  SharedExecutionContext,
} from "../../mediator/product-plugin-contract.js";
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
import {
  executeAndReadConfirmedSubmit,
  SEO_PROVIDER_PROBE_BUDGET_MS,
  type SeoConfirmedSubmit,
} from "./seo-submit-readback.js";
const MODEL_PROFILE = buildGptExecutionProfile({
  profileRef: `${PLUGIN_ID}:gpt-5.6-sol-high`,
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: {
    selectionPolicy: "exact",
    requestedTier: "high",
  },
  executorIdentityRef: PLUGIN_ID,
  acceptanceRef: `${PLUGIN_ID}:seo-production`,
  acceptanceVersion: "v1",
});
const uploadedAttachmentFiles = (value: unknown, code: string): readonly SeoUploadedAttachment[] => {
  const files = objectValue(value, code).files;
  if (!Array.isArray(files) || files.length === 0) fail(code);
  return files.map((file) => {
    const attachment = objectValue(file, code);
    if (!Number.isSafeInteger(attachment.bytes) || Number(attachment.bytes) < 0) fail(code);
    return Object.freeze({
      artifactRef: textValue(attachment.artifactRef, code),
      displayName: textValue(attachment.displayName, code),
      providerDisplayName: textValue(attachment.providerDisplayName, code),
      sha256: hashValue(attachment.sha256, code),
      bytes: Number(attachment.bytes),
    });
  });
};

 export const createSeoExecutor = (task: WebsiteAgentTask, context: SharedExecutionContext) => {
  if (context.gpt.jobId !== task.job_id) fail("SEO_GPT_JOB_IDENTITY_MISMATCH");
  const sessionKey = `${PLUGIN_ID}:${task.job_id}:${context.gpt.attemptId}`;
  const evidenceRefs: string[] = [];
  const execute: SeoChild = async (input) => {
    const result = await context.gpt.execute({ ...input, sessionKey });
    evidenceRefs.push(...result.artifactRefs);
    return result;
  };
  const readConfirmedSubmit = async (
    input: Extract<SeoCall, { child: "submit_exact_gpt_turn_once" }>,
  ): Promise<SeoConfirmedSubmit | null> => {
    const result = await context.gpt.readConfirmedSubmit({ ...input, sessionKey });
    if (result) evidenceRefs.push(...result.artifactRefs);
    return result;
  };
  return Object.freeze({
    evidenceRefs: () => Object.freeze([...evidenceRefs]),
    execute,
    readConfirmedSubmit,
  });
};

type SeoProfileOrdinals = readonly [number, number, number, number, number, number];

export const applyExactProfile = async (
  execute: SeoChild,
  stepId: string,
  ordinals: SeoProfileOrdinals,
): Promise<void> => {
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-open", child: "open_gpt_execution_profile", actionOrdinal: ordinals[0], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-selector-open", child: "open_gpt_model_selector_v2", actionOrdinal: ordinals[1], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "model-select", child: "select_exact_gpt_model_v2", actionOrdinal: ordinals[2], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-open-after-model", child: "open_gpt_execution_profile", actionOrdinal: ordinals[3], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "reasoning-select", child: "ensure_gpt_reasoning_requirement", actionOrdinal: ordinals[4], input: { profile: MODEL_PROFILE } });
  await execute({ sessionKey: "", productStepId: stepId, callId: "profile-close", child: "close_gpt_execution_profile", actionOrdinal: ordinals[5], input: { profile: MODEL_PROFILE } });
};

export type SeoTextTurnInput = Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  prompt: string;
  marker: string;
  files: readonly SeoUploadedAttachment[];
  ordinals: readonly [number, number, number, number, number, number];
  prepare(): Promise<void>;
}>;

 const checkpointSubmittedTextTurn = async (
  input: SeoTextTurnInput,
  promptHash: `sha256:${string}`,
  submit: SeoConfirmedSubmit,
): Promise<SeoTurnCheckpoint> => {
    const { canonicalConversationUrl, userTurnId } = submit.value;
    const checkpointCall = {
      productStepId: input.stepId, callId: "text-checkpoint",
      child: "checkpoint_gpt_text_response", actionOrdinal: input.ordinals[4],
      input: {
        probeBudgetMs: SEO_PROVIDER_PROBE_BUDGET_MS, canonicalConversationUrl,
        expectedPromptHash: promptHash, userTurnId, turnMarker: input.marker,
      },
    } as const;
    const checkpoint = await input.flow.execute({ sessionKey: "", ...checkpointCall });
    const value = objectValue(checkpoint.value, "SEO_TEXT_CHECKPOINT_INVALID");
    const assistantTurnId = textValue(value.assistantTurnId, "SEO_TEXT_CHECKPOINT_INVALID");
    const artifactRefs = checkpoint.artifactRefs;
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
};

const prepareTextDraft = async (
  input: SeoTextTurnInput,
): Promise<void> => {
  const promptWrite = {
    productStepId: input.stepId, callId: "prompt-write", child: "write_exact_gpt_prompt",
    actionOrdinal: input.ordinals[0], input: { prompt: input.prompt },
  } as const;
  await input.flow.execute({ sessionKey: "", ...promptWrite });
};

const executeTextSubmit = async (
  input: SeoTextTurnInput,
  turnSubmit: Extract<SeoCall, { child: "submit_exact_gpt_turn_once" }>,
): Promise<SeoConfirmedSubmit> => {
  return executeAndReadConfirmedSubmit({
    read: () => input.flow.readConfirmedSubmit(turnSubmit),
    prepare: async () => {
      await input.prepare();
      await prepareTextDraft(input);
    },
    execute: () => input.flow.execute({ sessionKey: "", ...turnSubmit }) as Promise<SeoConfirmedSubmit>,
  });
};

export const submitTextTurn = async (input: SeoTextTurnInput): Promise<SeoTurnCheckpoint> => {
  const promptHash = textHash(input.prompt);
  const turnSubmit = { productStepId: input.stepId, callId: "turn-submit", child: "submit_exact_gpt_turn_once", actionOrdinal: input.ordinals[2], input: { files: input.files, promptHash } } as const;
  const confirmedSubmit = await executeTextSubmit(input, turnSubmit);
  return checkpointSubmittedTextTurn(input, promptHash, confirmedSubmit);
};

export const prepareAttachedTurnPrefix = async (input: Readonly<{
  flow: ReturnType<typeof createSeoExecutor>;
  stepId: string;
  files: readonly Omit<SeoUploadedAttachment, "providerDisplayName">[];
}>): Promise<void> => {
  const freshChat = { productStepId: input.stepId, callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 1, input: { timeoutMs: 60_000 } } as const;
  const attachmentOpen = { productStepId: input.stepId, callId: "attachment-control-open", child: "open_gpt_attachment_control", actionOrdinal: 8, input: {} } as const;
  const attachmentsAttach = { productStepId: input.stepId, callId: "attachments-attach", child: "attach_approved_gpt_files_once", actionOrdinal: 9, input: { files: input.files } } as const;
  const attachmentsReconcile = { productStepId: input.stepId, callId: "attachments-reconcile", child: "reconcile_gpt_attachment_set", actionOrdinal: 10, input: { files: input.files, timeoutMs: 600_000 } } as const;
  await input.flow.execute({ sessionKey: "", ...freshChat });
  await applyExactProfile(input.flow.execute, input.stepId, [2, 3, 4, 5, 6, 7]);
  await input.flow.execute({ sessionKey: "", ...attachmentOpen });
  await input.flow.execute({ sessionKey: "", ...attachmentsAttach });
  const reconciled = await input.flow.execute({ sessionKey: "", ...attachmentsReconcile });
  const actual = uploadedAttachmentFiles(reconciled.value, "SEO_ATTACHMENT_RECONCILIATION_INVALID");
  const approved = actual.map(({ providerDisplayName: _providerDisplayName, ...file }) => file);
  if (JSON.stringify(approved) !== JSON.stringify(input.files)) {
    fail("SEO_ATTACHMENT_RECONCILIATION_INVALID");
  }
};
