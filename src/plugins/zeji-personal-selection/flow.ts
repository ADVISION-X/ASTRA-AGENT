import { buildGptExecutionProfile, gptAttachmentProviderDisplayName,
  type ProductGptAnyCallInput,
  type ProductGptChildResult } from "../../capabilities/gpt/index.js";
import { hashCanonical, sha256, productResultValidation as result,
  type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { zejiPrompt } from "./prompt.js";
import { parseZejiResult } from "./result-contract.js";

const profile = buildGptExecutionProfile({ profileRef: "zeji-personal-selection:latest-reasoning-4",
  startModelDisplayName: "最新", requestedReasoningValue: 4,
  executorIdentityRef: "zeji-personal-selection", acceptanceRef: "zeji-personal-selection:production", acceptanceVersion: "v1" });

function attachmentFiles(context: SharedExecutionContext) {
  return [...context.materials].sort((a, b) => a.ordinal - b.ordinal).map(material => ({
    artifactRef: material.material_id, displayName: material.display_name, sha256: material.sha256, bytes: material.bytes,
  }));
}

function executionCalls(task: WebsiteAgentTask, context: SharedExecutionContext) {
  const evidence: string[] = [], sessionKey = `zeji-personal-selection:${task.job_id}:${context.gpt.attemptId}`;
  const run = async (call: ProductGptAnyCallInput) => {
    const receipt = await context.gpt.execute({ ...call, sessionKey });
    evidence.push(...receipt.artifactRefs);
    return receipt;
  };
  return { run, evidence, sessionKey };
}
type Calls = ReturnType<typeof executionCalls>;

async function preparePage(task: WebsiteAgentTask, context: SharedExecutionContext, calls: Calls) {
  const productStepId = task.action_id, files = attachmentFiles(context);
  await calls.run({ productStepId, callId: "new-chat", actionOrdinal: 1,
    child: "prepare_clean_gpt_chat", input: { timeoutMs: 60_000 } });
  await calls.run({ productStepId, callId: "profile-open", actionOrdinal: 2, child: "open_gpt_execution_profile", input: { profile } });
  await calls.run({ productStepId, callId: "selector-open", actionOrdinal: 3, child: "open_gpt_model_selector_v3", input: { profile } });
  await calls.run({ productStepId, callId: "select-model", actionOrdinal: 4, child: "select_gpt_model_from_start_v3", input: { profile } });
  await calls.run({ productStepId, callId: "select-reasoning", actionOrdinal: 5, child: "select_gpt_reasoning_from_start_v3", input: { profile } });
  await calls.run({ productStepId, callId: "profile-close", actionOrdinal: 6, child: "close_gpt_execution_profile", input: { profile } });
  await calls.run({ productStepId, callId: "attachments-open", actionOrdinal: 7, child: "open_gpt_attachment_control", input: {} });
  await calls.run({ productStepId, callId: "attachments-add", actionOrdinal: 8, child: "attach_approved_gpt_files_once", input: { files } });
  const reconciled = await calls.run({ productStepId, callId: "attachments-check", actionOrdinal: 9,
    child: "reconcile_gpt_attachment_set", input: { files, timeoutMs: 60_000 } }) as ProductGptChildResult<"reconcile_gpt_attachment_set">;
  const expected = files.map(file => ({ ...file,
    providerDisplayName: gptAttachmentProviderDisplayName(file.displayName, context.gpt.jobId, file.artifactRef) }));
  if (hashCanonical(reconciled.value.files) !== hashCanonical(expected)) throw new Error("ZEJI_ATTACHMENT_SET_MISMATCH");
}

function assertConfirmed(submit: ProductGptChildResult<"submit_exact_gpt_turn_once">) {
  if (submit.effectReceipt?.effectScope !== "provider_effect" || submit.effectReceipt.outcome !== "CONFIRMED"
    || !submit.effectReceipt.terminalAt || !Number.isFinite(Date.parse(submit.effectReceipt.terminalAt))) {
    throw new Error("ZEJI_CONFIRMED_SUBMIT_REQUIRED");
  }
}

export async function executeZejiFlow(task: WebsiteAgentTask, context: SharedExecutionContext) {
  if (task.product_id !== "zeji_personal_selection" || context.routePolicy.product_id !== task.product_id
    || context.routePolicy.action_id !== task.action_id) throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const calls = executionCalls(task, context), productStepId = task.action_id;
  const marker = `[GRASSEYE:${hashCanonical({ job_id: task.job_id, product_step_id: productStepId }).slice(7, 31)}]`;
  const prompt = zejiPrompt(task, context, marker);
  const files = attachmentFiles(context).map(file => ({ ...file,
    providerDisplayName: gptAttachmentProviderDisplayName(file.displayName, context.gpt.jobId, file.artifactRef) }));
  const submitCall = { productStepId, callId: "turn-submit", actionOrdinal: 11,
    child: "submit_exact_gpt_turn_once", input: { files, promptHash: sha256(prompt) } } as const;
  let submit = await context.gpt.readConfirmedSubmit({ ...submitCall, sessionKey: calls.sessionKey });
  if (submit) calls.evidence.push(...submit.artifactRefs);
  else {
    await preparePage(task, context, calls);
    await calls.run({ productStepId, callId: "prompt-write", actionOrdinal: 10,
      child: "write_exact_gpt_prompt", input: { prompt } });
    submit = await calls.run(submitCall) as ProductGptChildResult<"submit_exact_gpt_turn_once">;
  }
  assertConfirmed(submit);
  const providerEffectIdentityHash = submit.effectReceipt?.providerEffectIdentityHash;
  result.hash(providerEffectIdentityHash, "ZEJI_PROVIDER_EFFECT_IDENTITY_REQUIRED");
  const locator = await calls.run({ productStepId, callId: "conversation-url", actionOrdinal: 12,
    child: "get_submitted_gpt_conversation_url", input: { submitCallId: "turn-submit",
      providerEffectIdentityHash: providerEffectIdentityHash!, timeoutMs: 15_000 } }) as ProductGptChildResult<"get_submitted_gpt_conversation_url">;
  const checkpoint = await calls.run({ productStepId, callId: "text-checkpoint", actionOrdinal: 12,
    child: "checkpoint_gpt_text_response", input: { probeBudgetMs: 3_600_000,
      canonicalConversationUrl: locator.value.canonicalConversationUrl, userTurnId: locator.value.userTurnId, turnMarker: marker } }) as ProductGptChildResult<"checkpoint_gpt_text_response">;
  if (checkpoint.artifactRefs.length !== 1) throw new Error("ZEJI_RAW_ANSWER_ARTIFACT_REQUIRED");
  result.hash(checkpoint.value.rawDomHash, "ZEJI_RAW_ANSWER_HASH_REQUIRED");
  const payload = parseZejiResult(task, checkpoint.value.semanticText, context.routePolicy);
  return context.complete({ payload, evidence_refs: calls.evidence });
}
